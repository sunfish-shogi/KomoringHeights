#!/bin/bash
# -*- coding: utf-8 -*-
# WebAssembly 版 (ShogiHome WASM ABI 準拠) のビルド
# Emscripten の Docker イメージ上でビルドする。
#
# 成果物は build/wasm/komoring-heights/ に生成される。
# このディレクトリを ShogiHome の public/engines/ 以下に配置すると組み込みエンジンとして使える。
# cf. https://github.com/sunfish-shogi/shogihome/blob/main/specs/wasm-engine-abi.md
set -euo pipefail

EMSDK_IMAGE=${EMSDK_IMAGE:-emscripten/emsdk:6.0.6}
REPO_ROOT=$(cd "$(dirname "$0")/.." && pwd)

docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp \
  -v "${REPO_ROOT}:/src" \
  -w /src \
  "${EMSDK_IMAGE}" \
  bash script/wasm_build_in_docker.sh
