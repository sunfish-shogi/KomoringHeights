// ShogiHome WASM ABI (shogihome-wasm-engine/1) のインターフェースを実装する。
// Emscripten の --pre-js で読み込まれる。
// cf. https://github.com/sunfish-shogi/shogihome/blob/main/specs/wasm-engine-abi.md
//
// 公開するメソッドは YaneuraOu の wasm ビルドと同じ。
//   postMessage(command)            USI コマンドを 1 行渡す。
//   addMessageListener(listener)    エンジンの出力を 1 行ずつ受け取るリスナーを登録する。
//   removeMessageListener(listener)
//   terminate()                     エンジンを終了し、探索スレッドを解放する。
//
// C++ 側の usi_command() は、探索中で即座に実行できないコマンドに対して 1 を返す。
// その場合はコマンドをキューに残し、間隔を空けて再送する。
(function () {
  // Message listeners

  var quit = false;
  var listeners = [];

  Module["print"] = function (line) {
    // quit または terminate() の後は何も出力しない。
    if (quit) return;
    if (listeners.length === 0) {
      console.log(line);
      return;
    }
    setTimeout(function () {
      if (quit) return;
      var current = listeners.slice();
      for (var i = 0; i < current.length; i++) current[i](line);
    });
  };

  Module["addMessageListener"] = function (listener) {
    listeners.push(listener);
  };

  Module["removeMessageListener"] = function (listener) {
    var idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };

  Module["terminate"] = function () {
    if (quit) return;
    quit = true;
    queue = [];
    listeners = [];
    PThread.terminateAllThreads();
  };

  // Command queue

  var queue = [];
  var backoff = 1;
  var initialized = false;
  var timer = null;

  function schedule(delay) {
    if (timer !== null) return;
    timer = setTimeout(function () {
      timer = null;
      poll();
    }, delay);
  }

  function poll() {
    if (quit || !initialized) return;

    var command = queue[0];
    if (command === undefined) return;

    var tryLater = Module["ccall"]("usi_command", "number", ["string"], [command]);
    if (tryLater) {
      // 探索の終了を待ってから再送する。
      backoff = Math.min(backoff * 2, 16);
      schedule(backoff);
      return;
    }

    queue.shift();
    backoff = 1;
    if (queue.length > 0) schedule(0);
  }

  Module["postMessage"] = function (command) {
    if (quit) return;
    command = String(command);
    // quit は探索中でも待たずに終了する。(キューに積むと探索の終了を待つことになり、
    // その間に bestmove などを出力してしまう。)
    if (command.trim() === "quit") {
      Module["terminate"]();
      return;
    }
    queue.push(command);
    if (queue.length === 1) schedule(0);
  };

  Module["postRun"] = [].concat(Module["postRun"] || [], function () {
    Module["ccall"]("usi_init", null, [], []);
    initialized = true;
    schedule(0);
  });
})();
