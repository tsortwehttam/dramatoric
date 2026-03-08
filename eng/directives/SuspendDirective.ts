import { applySuspendCheckpoint } from "../Execution";
import { StoryDirectiveFuncDef, SUSPEND_TYPE } from "../Helpers";

export const SUSPEND_directive: StoryDirectiveFuncDef = {
  type: [SUSPEND_TYPE],
  func: async (node, ctx, pms) => {
    if (applySuspendCheckpoint(ctx)) {
      return [];
    }
    return [];
  },
};
