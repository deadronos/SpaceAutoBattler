import { isCopilotDebugEnabled } from '../../../utils/copilotDebug.js';

export const shouldEnableStarDiskDevHelpers = (): boolean => {
  if (isCopilotDebugEnabled()) {
    return true;
  }
  return process.env.NODE_ENV !== 'production';
};
