#!/usr/bin/env node
// ビルドした WebAssembly 版を ShogiHome WASM ABI (shogihome-wasm-engine/1) の
// 成果物の構成にまとめる。
// cf. https://github.com/sunfish-shogi/shogihome/blob/main/specs/wasm-engine-abi.md
//
// 使い方: node script/wasm_package.mjs <glue.js> <output dir>
//
// マニフェスト (engine.json) の name / author / options は、ビルドしたエンジンを
// 実際に起動して "usi" コマンドの応答から作る。エンジンのオプションを変更しても
// マニフェストを手で直す必要はない。
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const [gluePath, outputDir] = process.argv.slice(2);
if (!gluePath || !outputDir) {
  console.error("usage: node script/wasm_package.mjs <glue.js> <output dir>");
  process.exit(1);
}

const moduleName = path.basename(gluePath);
const wasmName = moduleName.replace(/\.js$/, ".wasm");
const wasmPath = path.join(path.dirname(gluePath), wasmName);

// --- エンジンを起動して usi の応答を得る

async function queryEngine() {
  const { default: createEngine } = await import(pathToFileURL(path.resolve(gluePath)).href);
  const engine = await createEngine({
    printErr: (line) => console.error(line),
  });
  const lines = [];
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("usiok が返ってこない")), 10000);
    engine.addMessageListener((line) => {
      lines.push(line);
      if (line === "usiok") {
        clearTimeout(timer);
        resolve();
      }
    });
    engine.postMessage("usi");
  });
  engine.terminate();
  return lines;
}

// "option name <name> type <type> [default <v>] [min <v>] [max <v>] [var <v>]..." を解析する。
function parseOption(line) {
  const tokens = line.split(" ").slice(1);
  const option = {};
  const vars = [];
  for (let i = 0; i < tokens.length; i++) {
    const key = tokens[i];
    // default の値は空文字列のことがある。(例: "type string default ")
    const value = tokens[i + 1] ?? "";
    switch (key) {
      case "name":
        option.name = value;
        i++;
        break;
      case "type":
        option.type = value;
        i++;
        break;
      case "default":
        option.default = value;
        i++;
        break;
      case "min":
        option.min = Number(value);
        i++;
        break;
      case "max":
        option.max = Number(value);
        i++;
        break;
      case "var":
        vars.push(value);
        i++;
        break;
    }
  }
  if (option.type === "spin") {
    option.default = Number(option.default);
  }
  if (option.type === "combo") {
    option.vars = vars;
  }
  if (option.type === "button") {
    delete option.default;
  }
  return option;
}

// ソースコードの入手先。コピーレフトのライセンスでは必須。
// ビルドしたコミットを指せるならそれを指す。
function sourceURL() {
  const base = process.env.KH_SOURCE_URL || "https://github.com/sunfish-shogi/KomoringHeights";
  try {
    const commit = execFileSync("git", ["-c", "safe.directory=*", "rev-parse", "HEAD"], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (/^[0-9a-f]{40}$/.test(commit)) {
      return `${base}/tree/${commit}`;
    }
  } catch {
    // git が無い環境では base をそのまま使う。
  }
  return base;
}

function badge() {
  const size = fs.statSync(wasmPath).size + fs.statSync(gluePath).size;
  return `${Math.max(1, Math.round(size / (1024 * 1024)))}MB`;
}

const lines = await queryEngine();
const idName = lines.find((line) => line.startsWith("id name "))?.substring("id name ".length);
const idAuthor = lines.find((line) => line.startsWith("id author "))?.substring("id author ".length);
if (!idName || !idAuthor) {
  console.error("id name / id author が返ってこない");
  process.exit(1);
}
const options = lines.filter((line) => line.startsWith("option ")).map(parseOption);

const manifest = {
  abi: "shogihome-wasm-engine/1",
  module: moduleName,
  moduleFormat: "esm",
  name: idName,
  author: idAuthor,
  badge: badge(),
  // 探索スレッドに pthread を使うため SharedArrayBuffer が必要。
  requiresCrossOriginIsolation: true,
  licenses: [
    {
      spdx: "GPL-3.0-only",
      file: "LICENSE.txt",
      source: sourceURL(),
    },
  ],
  options,
  presets: [
    {
      // id は ShogiHome の利用者の設定に保存されるので、一度公開したら変更してはならない。
      id: "komoring-heights-wasm-v1",
      displayName: "KomoringHeights",
      values: {},
      tags: ["mate"],
    },
  ],
};

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
fs.copyFileSync(gluePath, path.join(outputDir, moduleName));
fs.copyFileSync(wasmPath, path.join(outputDir, wasmName));
fs.chmodSync(path.join(outputDir, wasmName), 0o644);
fs.copyFileSync(path.join(repoRoot, "Copying.txt"), path.join(outputDir, "LICENSE.txt"));
fs.writeFileSync(path.join(outputDir, "engine.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`WebAssembly engine package: ${outputDir}`);
for (const file of fs.readdirSync(outputDir)) {
  console.log(`  ${file}`);
}
