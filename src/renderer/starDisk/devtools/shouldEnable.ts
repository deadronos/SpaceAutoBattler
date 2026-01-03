import { isCopilotDebugEnabled } from '../../../utils/copilotDebug.js';

export const shouldEnableStarDiskDevHelpers = (): boolean => {
  if (isCopilotDebugEnabled()) {
    return true;
  }
  return !import.meta.env.PROD;
};
