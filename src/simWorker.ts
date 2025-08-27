// Placeholder simulation worker. In future, core simulateStep could run here.
// For now, this simply echoes messages for compatibility with build pipeline.

self.addEventListener('message', (e) => {
  const { type, payload } = e.data || {};
  if (type === 'ping') {
    (self as any).postMessage({ type: 'pong', payload });
  }
});

export {};
