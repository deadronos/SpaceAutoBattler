// src/simWorker.ts
self.addEventListener("message", (e) => {
  const { type, payload } = e.data || {};
  if (type === "ping") {
    self.postMessage({ type: "pong", payload });
  }
});
//# sourceMappingURL=simWorker.js.map
