import { perf } from './perf.js';

export function setupPerfOverlay(): void {
  // Only show overlay if enabled via query param or config
  const showOverlay = perf.isEnabled() && (
    typeof location !== 'undefined' && location.search.includes('showPerf=1')
  );

  if (!showOverlay) return;

  // Create overlay element
  const overlay = document.createElement('div');
  overlay.id = 'perfOverlay';
  overlay.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: #00ff00;
    padding: 10px;
    font-family: 'Courier New', monospace;
    font-size: 12px;
    line-height: 1.3;
    border-radius: 4px;
    z-index: 1000;
    min-width: 200px;
    max-width: 300px;
  `;

  document.body.appendChild(overlay);

  // Update overlay periodically
  let lastUpdate = 0;
  const updateInterval = 250; // 4fps

  function updateOverlay() {
    const now = performance.now();
    if (now - lastUpdate < updateInterval) {
      requestAnimationFrame(updateOverlay);
      return;
    }
    lastUpdate = now;

    const summary = perf.getSummary();
    if (summary.frameCount === 0) {
      overlay.textContent = 'Performance Monitor\nNo data yet...';
      requestAnimationFrame(updateOverlay);
      return;
    }

    // Build display content
    let content = 'Performance Monitor\n';
    content += `Frames: ${summary.frameCount}\n`;
    content += `Total: ${summary.totalFrameMs}ms\n`;
    content += `Avg: ${summary.avgFrameMs}ms\n`;
    content += `P95: ${summary.p95FrameMs}ms\n\n`;

    // Show top 8 subsystems
    const topSubsystems = summary.subsystems.slice(0, 8);
    for (const subsystem of topSubsystems) {
      const percentage = summary.totalFrameMs > 0
        ? Math.round((subsystem.totalMs / summary.totalFrameMs) * 100)
        : 0;

      content += `${subsystem.name}: ${percentage}% (${subsystem.avgMs}ms)\n`;
    }

    overlay.textContent = content;
    requestAnimationFrame(updateOverlay);
  }

  requestAnimationFrame(updateOverlay);
}
