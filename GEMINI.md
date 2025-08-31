# Project: SpaceAutoBattler

## Project Overview

This is a 3D space combat simulator built with TypeScript, Three.js, and the Rapier physics engine. The project is designed to be lightweight and research-oriented, with a clear separation between the deterministic simulation logic and the rendering logic. This allows for headless testing and fast experimentation.

The application runs in the browser, with the main entry point being `src/main.ts`. The physics simulation is offloaded to a web worker (`src/simWorker.ts`) to improve performance. The rendering is handled by Three.js, and the UI is built with HTML and CSS.

## Building and Running

### Installation

```bash
npm install
```

### Running the Development Server

```bash
npm run serve
```

This will start a local server at `http://localhost:8080`.

### Building for Production

```bash
npm run build
```

This will build the project and output the files to the `dist` directory.

### Testing

The project uses Vitest for unit testing and Playwright for end-to-end testing.

**Unit Tests:**

```bash
npm test
```

**End-to-End Tests:**

```bash
npm run test:e2e
```

**Type Checking:**

```bash
npm run typecheck
```

## Development Conventions

*   **Code Style:** The project uses ESLint for code linting. The configuration can be found in `eslint.config.ts`.
*   **Testing:** Unit tests are located in `test/vitest` and end-to-end tests are in `test/playwright`.
*   **Modularity:** The codebase is organized into modules, with a clear separation of concerns. The core simulation logic is in `src/core`, the rendering logic is in `src/renderer`, and the configuration is in `src/config`.
*   **Web Workers:** The project uses a web worker to run the physics simulation, which is a good practice for performance-intensive tasks.
