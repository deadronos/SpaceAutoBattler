import type { ShaderMaterial, WebGLRenderer } from 'three';
import { pollUntil } from '../../../utils/polling.js';
import { registerPollerCleanup } from './debugWindow.js';

type ShaderPropertiesAccessor = { get: (key: ShaderMaterial) => unknown };

type ProgramPollerOptions = {
  material: ShaderMaterial;
  renderer: WebGLRenderer;
  onProgramReady: (gl: WebGLRenderingContext, program: WebGLProgram) => void;
  onTimeout: () => void;
  onError: (error: unknown) => void;
  maxWaitMs?: number;
  intervalMs?: number;
};

const extractProgram = (value: unknown): WebGLProgram | null => {
  if (!value) return null;
  if (value instanceof WebGLProgram) return value;
  if (typeof value === 'object') {
    const maybeProgram = value as { program?: unknown };
    const direct = maybeProgram.program;
    if (direct instanceof WebGLProgram) return direct;
    if (direct) return direct as WebGLProgram;
    return value as WebGLProgram;
  }
  return null;
};

export const installProgramPoller = ({
  material,
  renderer,
  onProgramReady,
  onTimeout,
  onError,
  maxWaitMs = 10000,
  intervalMs = 200,
}: ProgramPollerOptions): (() => void) => {
  const props = (renderer as unknown as { properties?: ShaderPropertiesAccessor })?.properties;

  const dispose = pollUntil(
    () => {
      const matProp = props?.get(material);
      const program = extractProgram((matProp as { program?: unknown })?.program ?? matProp);
      if (!program) return false;
      onProgramReady(renderer.getContext(), program);
      return true;
    },
    { intervalMs, maxWaitMs, onTimeout, onError },
  );

  registerPollerCleanup(dispose);
  return dispose;
};
