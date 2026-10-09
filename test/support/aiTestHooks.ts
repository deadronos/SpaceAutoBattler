// Test-only aggregation of internal AI system functions.
//
// These used to be exported from `src/game/systems.ts` as `__aiTestHooks`,
// which put a test-only surface in the production module. Tests import this
// module instead.
import { updateDecisionSystem } from '../../src/game/systems/decision/manager.js';
import { refreshBlackboard, assignTeamRoles } from '../../src/game/systems/decision/blackboard.js';
import {
  selectIntent,
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreInterceptIntent,
  scoreRepositionIntent,
  scoreRegroupIntent,
  scoreFleeIntent,
  tieBreak,
  computeLod,
  writeCommand,
  computeInterceptHeadingVector,
} from '../../src/game/systems/decision/intents.js';
import { prepareShips, executeAICommand } from '../../src/game/systems/shipControl.js';

export const __aiTestHooks = {
  updateDecisionSystem,
  refreshBlackboard,
  assignTeamRoles,
  selectIntent,
  scoreAttackIntent,
  scoreKiteIntent,
  scoreEscortIntent,
  scoreInterceptIntent,
  scoreRepositionIntent,
  scoreRegroupIntent,
  scoreFleeIntent,
  tieBreak,
  computeLod,
  writeCommand,
  prepareShips,
  computeInterceptHeadingVector,
  executeAICommand,
};
