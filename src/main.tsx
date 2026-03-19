// Install GL prototype patches early so we can capture shader compile/link logs in dev.
import './renderer/webglDebugPrototypePatch.js';
// Ensure runtime patch for GLTFLoader is applied before any GLTF loads occur.
import './utils/patchGltfLoader.js';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import { App } from './App.js';

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root container element not found');
}

const root = createRoot(container);
root.render(
  <StrictMode>
    <App />
  </StrictMode>,
);
