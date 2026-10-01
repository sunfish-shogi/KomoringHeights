![Make CI (MSYS2 for Windows)](https://github.com/komori-n/KomoringHeights/workflows/Make%20CI%20(MSYS2%20for%20Windows)/badge.svg?event=push)
![Make CI (MinGW for Windows)](https://github.com/komori-n/KomoringHeights/workflows/Make%20CI%20(MinGW%20for%20Windows)/badge.svg?event=push)
![Make CI (for Ubuntu Linux)](https://github.com/komori-n/KomoringHeights/workflows/Make%20CI%20(for%20Ubuntu%20Linux)/badge.svg?event=push)
![Make CI (for Mac)](https://github.com/komori-n/KomoringHeights/workflows/Make%20CI%20(for%20Mac)/badge.svg?event=push)
![NDK CI (for Android)](https://github.com/komori-n/KomoringHeights/workflows/NDK%20CI%20(for%20Android)/badge.svg?event=push)

# KomoringHeights

KomoringHeights is a simple and powerful mate engine for Shogi game based on [YaneuraOu](https://github.com/yaneurao/YaneuraOu/).
It implements some advanced algorithms such as df-pn+ algorithm, superior/inferior relationship, strict repetition detection, and double count problem detection.

Sources for KomoringHeights are stored in `source/engine/user-engine`.
The other files mostly came from YaneuraOu.

## How to use

Please download binaries from [Releases](https://github.com/komori-n/KomoringHeights/releases).
As KomoringHeights complies with the USI protocol (universal shogi interface protocol), GUI software such as [Shogidokoro](http://shogidokoro.starfree.jp/), [ShogiGUI](http://shogigui.siganus.com/), [Electron Shogi](https://sunfish-shogi.github.io/electron-shogi/), and [ShogiDroid](http://shogidroid.siganus.com/) is needed to run.

For available engine options, please see [EngineOptions](source/engine/user-engine/docs/EngineOptions.txt).

## How to Build

To build a binary from the source, use the following commands:

```sh
git clone https://github.com/komori-n/KomoringHeights.git
cd KomoringHeights/source
make normal TARGET_CPU=AVX2 COMPILER=clang++
```

Specify appropriate `TARGET_CPU` according to your environment.
You can find the list of available options in `source/Makefile`.

A compiler for C++17 is required to build. We confirmed to build
by GCC 10+ and Clang 11+. Compilers older than them are not supported.

### WebAssembly

A WebAssembly build that conforms to the [ShogiHome WASM ABI](https://github.com/sunfish-shogi/shogihome/blob/main/specs/wasm-engine-abi.md) (`shogihome-wasm-engine/1`)
can be built with Emscripten (`emscripten/emsdk:6.0.6`) on Docker.

```sh
./script/wasm_build.sh
```

The artifacts (`engine.json`, `komoring-heights.js`, `komoring-heights.wasm` and `LICENSE.txt`) are generated in `build/wasm/komoring-heights/`.
Put this directory under `public/engines/` of ShogiHome to use it as a built-in engine.
`name`, `author` and `options` in `engine.json` are generated from the response of the built engine to the `usi` command.

The WebAssembly build uses pthreads for the search threads, so it requires cross-origin isolation (`SharedArrayBuffer`).
Since it runs in a browser, `Threads` is limited to 4, and `USI_Hash` defaults to 64 MB with a maximum of 256 MB.

## References

See [References](source/engine/user-engine/docs/refs.md).

## Detailed Design Documents

- <https://komori-n.github.io/komoring-heights-docs/index.html> (in Japanese)

## Contributing

Please feel free to submit Issues or Pull Requests.
Before you create Pull Request, please confirm `pre-commit` passes checks.

## License

Licensed under GPLv3.

- `source/engine/user-engine/**`: komori-n
- other: [YaneuraOu](https://github.com/yaneurao/YaneuraOu/)
