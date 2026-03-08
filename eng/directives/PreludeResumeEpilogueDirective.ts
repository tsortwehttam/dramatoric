import { executeKids, splitConditionalKids } from "../Execution";
import { EPILOGUE_TYPE, PRELUDE_TYPE, RESUME_TYPE, StoryDirectiveFuncDef, StoryEventType } from "../Helpers";

/**
 * ## PRELUDE / RESUME / EPILOGUE
 *
 * **Summary**
 * Lifecycle event handlers that run at specific points in the story session.
 * PRELUDE runs on fresh start, RESUME runs when loading a save, EPILOGUE runs on exit.
 *
 * **Syntax**
 * ```dramatoric
 * PRELUDE: DO
 *   NARRATOR:
 *   Welcome to the story!
 * END
 *
 * RESUME: DO
 *   NARRATOR:
 *   Welcome back!
 * END
 *
 * EPILOGUE: DO
 *   NARRATOR:
 *   Thanks for playing!
 * END
 * ```
 *
 * **Notes**
 * - PRELUDE is triggered by the $start event (first step of a new session)
 * - RESUME is triggered by the $resume event (loading a saved session)
 * - EPILOGUE is triggered by the $exit event (story ending)
 * - Top-level content not in a handler is implicitly wrapped in PRELUDE
 * - All three use checkpoint/resume semantics like ON, so CAPTURE works naturally
 */
export const PRELUDE_directive: StoryDirectiveFuncDef = {
  type: [PRELUDE_TYPE, RESUME_TYPE, EPILOGUE_TYPE],
  func: async (node, ctx) => {
    const handler = ctx.handler;
    const checkpoint = ctx.session.checkpoints[handler] ?? [];
    const hasCheckpoint = checkpoint.length > 0;

    const eventType = getEventTypeForDirective(node.type);
    const isMatchingEvent = ctx.event.type === eventType;
    const isInputForResume = hasCheckpoint && ctx.event.channel === "input";

    if (!isMatchingEvent && !isInputForResume) {
      return [false];
    }

    ctx.event.captured = Date.now();

    const isRetired = ctx.session.handlers[handler];
    if (isRetired) {
      return [false];
    }

    const { thenKids } = splitConditionalKids(node.kids);

    ctx.resume = checkpoint;
    await executeKids(thenKids, ctx);
    ctx.resume = [];

    if (!ctx.halted) {
      delete ctx.session.checkpoints[handler];
    }

    return [true];
  },
};

function getEventTypeForDirective(type: string): StoryEventType {
  switch (type) {
    case PRELUDE_TYPE:
      return StoryEventType.$start;
    case RESUME_TYPE:
      return StoryEventType.$resume;
    case EPILOGUE_TYPE:
      return StoryEventType.$exit;
    default:
      return StoryEventType.$none;
  }
}
