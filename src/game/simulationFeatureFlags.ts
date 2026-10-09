import { readBooleanParam } from '../utils/queryParams.js';

/** Worker simulation is enabled via `?sim_worker` or `?sim_worker_render`. */
export function shouldEnableWorkerSimulation(): boolean {
  return readBooleanParam('sim_worker') || readBooleanParam('sim_worker_render');
}

/** Worker-driven ship rendering via `?sim_worker_render` or `?sim_worker_render_only`. */
export function shouldRenderWorkerShips(): boolean {
  return readBooleanParam('sim_worker_render') || readBooleanParam('sim_worker_render_only');
}

/** Render worker ships only (no local simulation) via `?sim_worker_render_only`. */
export function shouldRenderWorkerShipsOnly(): boolean {
  return readBooleanParam('sim_worker_render_only');
}

/** Worker debug logging via `?sim_worker_debug`. */
export function shouldDebugWorkerSimulation(): boolean {
  return readBooleanParam('sim_worker_debug');
}
