#!/usr/bin/env node
// ビルドした WebAssembly 版を ShogiHome WASM ABI (shogihome-wasm-engine/1) の
// 成果物の構成にまとめる。
// cf. https://github.com/sunfish-shogi/shogihome/blob/main/specs/wasm-engine-abi.md
//
// 使い方: node script/wasm_package.mjs <glue.js> <output dir>
//
// マニフェスト (engine.json) の name / author / options は、成果物のディレクトリに
// コピーしたエンジンを実際に起動して "usi" コマンドの応答から作る。エンジンのオプションを
// 変更してもマニフェストを手で直す必要はない。また、成果物にファイルが欠けていれば
// ここで起動に失敗するので気付ける。
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
const baseName = moduleName.replace(/\.js$/, "");
const buildDir = path.dirname(gluePath);

// --- エンジンを起動して usi の応答を得る

async function queryEngine(modulePath) {
  const { default: createEngine } = await import(pathToFileURL(path.resolve(modulePath)).href);
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

// git コマンドを実行する。失敗した場合は undefined を返す。
function git(...args) {
  try {
    return execFileSync("git", ["-c", "safe.directory=*", ...args], {
      cwd: repoRoot,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return undefined;
  }
}

// リモートリポジトリの URL を https の URL に変換する。
//   git@github.com:owner/repo.git -> https://github.com/owner/repo
//   https://github.com/owner/repo.git -> https://github.com/owner/repo
function toHttpsURL(remote) {
  const ssh = /^git@([^:]+):(.+?)(\.git)?$/.exec(remote);
  if (ssh) {
    return `https://${ssh[1]}/${ssh[2]}`;
  }
  try {
    const url = new URL(remote);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    return `https://${url.host}${url.pathname.replace(/\.git$/, "").replace(/\/$/, "")}`;
  } catch {
    return undefined;
  }
}

// ソースコードの入手先。コピーレフトのライセンスでは必須。
// KH_SOURCE_URL が無ければ、ビルドしたリポジトリの origin を使う。
// ビルドしたコミットを指せるならそれを指す。
function sourceURL() {
  const remote = git("remote", "get-url", "origin");
  const base =
    process.env.KH_SOURCE_URL ||
    (remote && toHttpsURL(remote)) ||
    "https://github.com/komori-n/KomoringHeights";
  const commit = git("rev-parse", "HEAD");
  if (commit && /^[0-9a-f]{40}$/.test(commit)) {
    return `${base}/tree/${commit}`;
  }
  return base;
}

function badge() {
  const size = fs
    .readdirSync(outputDir)
    .filter((file) => file.startsWith(baseName + "."))
    .reduce((sum, file) => sum + fs.statSync(path.join(outputDir, file)).size, 0);
  return `${Math.max(1, Math.round(size / (1024 * 1024)))}MB`;
}

// --- 成果物をコピーする

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
// グルーコード・wasm に加えて、Emscripten 3.1.58 より前の版でビルドした場合に出力される
// pthread 用のスクリプト (<module>.worker.js) などもコピーする。
for (const file of fs.readdirSync(buildDir)) {
  if (file.startsWith(baseName + ".") && /\.(js|mjs|wasm)$/.test(file)) {
    fs.copyFileSync(path.join(buildDir, file), path.join(outputDir, file));
    fs.chmodSync(path.join(outputDir, file), 0o644);
  }
}
if (!fs.existsSync(path.join(outputDir, baseName + ".wasm"))) {
  console.error(`${baseName}.wasm が見つからない`);
  process.exit(1);
}
fs.copyFileSync(path.join(repoRoot, "Copying.txt"), path.join(outputDir, "LICENSE.txt"));

// --- マニフェストを作る

const lines = await queryEngine(path.join(outputDir, moduleName));
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

fs.writeFileSync(path.join(outputDir, "engine.json"), JSON.stringify(manifest, null, 2) + "\n");

console.log(`WebAssembly engine package: ${outputDir}`);
for (const file of fs.readdirSync(outputDir)) {
  console.log(`  ${file}`);
}
