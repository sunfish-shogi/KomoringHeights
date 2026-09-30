#!/bin/bash
# -*- coding: utf-8 -*-
# WebAssembly 版 (ShogiHome WASM ABI 準拠) のビルド
# Emscripten の Docker イメージ上で実行する。通常は wasm_build.sh から呼び出す。
set -euo pipefail

cd "$(dirname "$0")/.."

JOBS=$(nproc 2>/dev/null || echo 4)
PACKAGE_DIR=build/wasm/komoring-heights

pushd source > /dev/null
make clean COMPILER=em++ TARGET_CPU=WASM YANEURAOU_EDITION=USER_ENGINE
make -j"${JOBS}" normal COMPILER=em++ TARGET_CPU=WASM YANEURAOU_EDITION=USER_ENGINE
popd > /dev/null

node script/wasm_package.mjs source/komoring-heights.js "${PACKAGE_DIR}"
