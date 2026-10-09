// Barrel for the AI decision intent/command surface. The logic lives in the
// focused modules re-exported below; this file preserves the existing import
// path for consumers (`evaluator.ts`, test hooks).
export type { IntentCandidate } from './intent-utils.js';
export type { CommandResult } from './command-generators.js';
export {
  quantizeScore,
  getIntentPriority,
  computeInterceptHeadingVector,
  tieBreak,
} from './intent-utils.js';
export { scoreAttackIntent, scoreKiteIntent, scoreFleeIntent } from './combat-intents.js';
export { scoreInterceptIntent, scoreRepositionIntent } from './tactical-intents.js';
export { scoreRegroupIntent, scoreEscortIntent } from './formation-intents.js';
export {
  computeAttackCommand,
  computeInterceptCommand,
  computeRepositionCommand,
  computeRegroupCommand,
  computeEscortCommand,
  computeKiteCommand,
  computeFleeCommand,
} from './command-generators.js';
export { applyVerticalPerturbation } from './vertical-maneuvers.js';
export { recordFocusDiagnostics, updateBandStickiness } from './metrics-diagnostics.js';
export { selectIntent } from './select-intent.js';
export { computeLod } from './lod.js';
export { writeCommand } from './command-writer.js';
