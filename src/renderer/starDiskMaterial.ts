export type {
  StarDiskHazeUniformInput,
  StarDiskHazeUniformResult,
  StarDiskBoundaryUniformInput,
  StarDiskBoundaryUniformResult,
} from './starDisk/uniforms.js';
export { deriveBoundaryUniform, deriveHazeUniform } from './starDisk/uniforms.js';
export type {
  MainSequenceStarMaterialOptions,
  MainSequenceStarUniformUpdate,
} from './starDisk/materialFactory.js';
export {
  createMainSequenceStarMaterial,
  updateMainSequenceStarUniforms,
  disposeMainSequenceStarMaterial,
} from './starDisk/materialFactory.js';
