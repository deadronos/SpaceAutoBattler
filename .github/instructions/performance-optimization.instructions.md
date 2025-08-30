---
applyTo: '*'
description: 'The most comprehensive, practical, and engineer-authored performance optimization instructions for all languages, frameworks, and stacks. Covers frontend, backend, and database best practices with actionable guidance, scenario-based checklists, troubleshooting, and pro tips.'
tools: ['thinking', 'reasoning', 'fetch']
---

# Performance Optimization Best Practices

## Introduction

Performance isn't just a buzzword—it's the difference between a product people love and one they abandon. I've seen firsthand how a slow app can frustrate users, rack up cloud bills, and even lose customers. This guide is a living collection of the most effective, real-world performance practices I've used and reviewed, covering frontend, backend, and database layers, as well as advanced topics. Use it as a reference, a checklist, and a source of inspiration for building fast, efficient, and scalable software.

---

## General Principles

- **Measure First, Optimize Second:** Always profile and measure before optimizing. Use benchmarks, profilers, and monitoring tools to identify real bottlenecks. Guessing is the enemy of performance.
  - *Pro Tip:* Use tools like Chrome DevTools, Lighthouse, New Relic, Datadog, Py-Spy, or your language's built-in profilers.
- **Optimize for the Common Case:** Focus on optimizing code paths that are most frequently executed. Don't waste time on rare edge cases unless they're critical.
- **Avoid Premature Optimization:** Write clear, maintainable code first; optimize only when necessary. Premature optimization can make code harder to read and maintain.
- **Minimize Resource Usage:** Use memory, CPU, network, and disk resources efficiently. Always ask: "Can this be done with less?"
- **Prefer Simplicity:** Simple algorithms and data structures are often faster and easier to optimize. Don't over-engineer.
- **Document Performance Assumptions:** Clearly comment on any code that is performance-critical or has non-obvious optimizations. Future maintainers (including you) will thank you.
- **Understand the Platform:** Know the performance characteristics of your language, framework, and runtime. What's fast in Python may be slow in JavaScript, and vice versa.
- **Automate Performance Testing:** Integrate performance tests and benchmarks into your CI/CD pipeline. Catch regressions early.
- **Set Performance Budgets:** Define acceptable limits for load time, memory usage, API latency, etc. Enforce them with automated checks.

---

## Frontend Performance

### Rendering and DOM
- **Minimize DOM Manipulations:** Batch updates where possible. Frequent DOM changes are expensive.
  - *Anti-pattern:* Updating the DOM in a loop. Instead, build a document fragment and append it once.
- **Virtual DOM Frameworks:** Use React, Vue, or similar efficiently—avoid unnecessary re-renders.
  - *React Example:* Use `React.memo`, `useMemo`, and `useCallback` to prevent unnecessary renders.
- **Keys in Lists:** Always use stable keys in lists to help virtual DOM diffing. Avoid using array indices as keys unless the list is static.
- **Avoid Inline Styles:** Inline styles can trigger layout thrashing. Prefer CSS classes.
- **CSS Animations:** Use CSS transitions/animations over JavaScript for smoother, GPU-accelerated effects.
- **Defer Non-Critical Rendering:** Use `requestIdleCallback` or similar to defer work until the browser is idle.

### Asset Optimization
- **Image Compression:** Use tools like ImageOptim, Squoosh, or TinyPNG. Prefer modern formats (WebP, AVIF) for web delivery.
- **SVGs for Icons:** SVGs scale well and are often smaller than PNGs for simple graphics.
- **Minification and Bundling:** Use Webpack, Rollup, or esbuild to bundle and minify JS/CSS. Enable tree-shaking to remove dead code.
- **Cache Headers:** Set long-lived cache headers for static assets. Use cache busting for updates.
- **Lazy Loading:** Use `loading="lazy"` for images, and dynamic imports for JS modules/components.
- **Font Optimization:** Use only the character sets you need. Subset fonts and use `font-display: swap`.

### Network Optimization
- **Reduce HTTP Requests:** Combine files, use image sprites, and inline critical CSS.
- **HTTP/2 and HTTP/3:** Enable these protocols for multiplexing and lower latency.
- **Client-Side Caching:** Use Service Workers, IndexedDB, and localStorage for offline and repeat visits.
- **CDNs:** Serve static assets from a CDN close to your users. Use multiple CDNs for redundancy.
- **Defer/Async Scripts:** Use `defer` or `async` for non-critical JS to avoid blocking rendering.
- **Preload and Prefetch:** Use `<link rel="preload">` and `<link rel="prefetch">` for critical resources.

### JavaScript Performance
- **Avoid Blocking the Main Thread:** Offload heavy computation to Web Workers.
- **Debounce/Throttle Events:** For scroll, resize, and input events, use debounce/throttle to limit handler frequency.
- **Memory Leaks:** Clean up event listeners, intervals, and DOM references. Use browser dev tools to check for detached nodes.
- **Efficient Data Structures:** Use Maps/Sets for lookups, TypedArrays for numeric data.
- **Avoid Global Variables:** Globals can cause memory leaks and unpredictable performance.
- **Avoid Deep Object Cloning:** Use shallow copies or libraries like lodash's `cloneDeep` only when necessary.

### Accessibility and Performance
- **Accessible Components:** Ensure ARIA updates are not excessive. Use semantic HTML for both accessibility and performance.
- **Screen Reader Performance:** Avoid rapid DOM updates that can overwhelm assistive tech.

### Framework-Specific Tips
#### React
- Use `React.memo`, `useMemo`, and `useCallback` to avoid unnecessary renders.
- Split large components and use code-splitting (`React.lazy`, `Suspense`).
- Avoid anonymous functions in render; they create new references on every render.
- Use `ErrorBoundary` to catch and handle errors gracefully.
- Profile with React DevTools Profiler.

#### Angular
- Use OnPush change detection for components that don't need frequent updates.
- Avoid complex expressions in templates; move logic to the component class.
- Use `trackBy` in `ngFor` for efficient list rendering.
- Lazy load modules and components with the Angular Router.
- Profile with Angular DevTools.

#### Vue
- Use computed properties over methods in templates for caching.
- Use `v-show` vs `v-if` appropriately (`v-show` is better for toggling visibility frequently).
- Lazy load components and routes with Vue Router.
- Profile with Vue Devtools.

### Common Frontend Pitfalls
- Loading large JS bundles on initial page load.
- Not compressing images or using outdated formats.
- Failing to clean up event listeners, causing memory leaks.
- Overusing third-party libraries for simple tasks.
- Ignoring mobile performance (test on real devices!).

### Frontend Troubleshooting
- Use Chrome DevTools' Performance tab to record and analyze slow frames.
- Use Lighthouse to audit performance and get actionable suggestions.
- Use WebPageTest for real-world load testing.
- Monitor Core Web Vitals (LCP, FID, CLS) for user-centric metrics.

---

## Backend Performance

### Algorithm and Data Structure Optimization
- **Choose the Right Data Structure:** Arrays for sequential access, hash maps for fast lookups, trees for hierarchical data, etc.
- **Efficient Algorithms:** Use binary search, quicksort, or hash-based algorithms where appropriate.
- **Avoid O(n^2) or Worse:** Profile nested loops and recursive calls. Refactor to reduce complexity.
- **Batch Processing:** Process data in batches to reduce overhead (e.g., bulk database inserts).
- **Streaming:** Use streaming APIs for large data sets to avoid loading everything into memory.

### Concurrency and Parallelism
- **Asynchronous I/O:** Use async/await, callbacks, or event loops to avoid blocking threads.
- **Thread/Worker Pools:** Use pools to manage concurrency and avoid resource exhaustion.
- **Avoid Race Conditions:** Use locks, semaphores, or atomic operations where needed.
- **Bulk Operations:** Batch network/database calls to reduce round trips.
- **Backpressure:** Implement backpressure in queues and pipelines to avoid overload.
---
applyTo: '*'
description: 'Performance optimization — condensed cookbook: short receipt, quick diagnostics, and an actionable checklist.'
---

# Performance — Quick Guide

Receipt: "Identify and fix the top user-facing performance bottleneck — measure → isolate → fix (3 steps)."

Short plan (3 steps):
1) Measure: collect profiling data (CPU, wall time, memory, network).  
2) Isolate: reproduce the hotspot in a small test/benchmark.  
3) Fix + Verify: apply minimal change, add a regression test, and re-run measurements.

Quick diagnostics (what to run first):
- Frontend: Lighthouse (LCP/CLS), DevTools performance flame, network waterfall.  
- Backend: flamegraph, CPU sampling (clinic.js/node --inspect), slow query logs.  
- Database: EXPLAIN plans, slow query log, index usage.

Top-10 checklist (fast wins):
- [ ] Measure before changing (profilers, logs).  
- [ ] Cache expensive results (with TTL & invalidation).  
- [ ] Avoid blocking I/O in hot paths (use async/streams).  
- [ ] Reduce payload sizes (select columns, compress responses).  
- [ ] Lazy-load non-critical assets and code.  
- [ ] Use CDN and proper cache headers for static assets.  
- [ ] Fix N+1 queries and add proper indexes.  
- [ ] Debounce/throttle frequent events (scroll/input).  
- [ ] Remove excessive logging from hot loops.  
- [ ] Add benchmarks and CI regression checks for critical paths.

Quick checks for common stacks:
- Node.js: avoid sync fs calls, use streams, profile with clinic.  
- React: memoize heavy children, code-split routes, avoid re-rendering lists.  
- SQL: prefer parameterized queries, index filters, avoid SELECT *.

Small template: "Measure → Patch → Test"
- PR description: include measurement snapshot (before), change summary, verification (after numbers + tests).  

If unsure: run a 60–90s micro-benchmark isolating the suspected hotspot and iterate until the change yields measurable improvement.

References: Chrome DevTools, Lighthouse, clinic.js, EXPLAIN, k6.

End.
- Use `async/await` for I/O-bound operations.
