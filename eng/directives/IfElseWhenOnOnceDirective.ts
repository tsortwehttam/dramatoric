import { allTruthy } from "../../lib/EvalCasting";
import { evalAllClauses, executeKids, splitConditionalKids } from "../Execution";
import { ANY_EVENT, IF_TYPE, INPUT_KEY, ON_TYPE, ONCE_TYPE, StoryDirectiveFuncDef, WHEN_TYPE } from "../Helpers";
import { createLLMYieldIfFunc } from "../Processor";

/**
 * ## IF / WHEN / ON / ONCE
 *
 * **Summary**
 * Control flow and event handling: IF/WHEN for conditional branching, ON for
 * reacting to events, and ONCE for one-time execution.
 *
 * **Syntax**
 * ```dramatoric
 * IF: condition DO
 *   ...
 * END
 *
 * IF: condition DO
 *   ...
 *   ELSE: DO
 *     ...
 *   END
 * END
 *
 * WHEN: condition DO
 *   ...
 * END
 *
 * ON: $input DO
 *   ...
 * END
 *
 * ONCE: DO
 *   ...
 * END
 * ```
 *
 * **Examples**
 * ```dramatoric
 * heroHasTorch = true
 *
 * IF: heroHasTorch DO
 *   SIDEKICK:
 *   It's dark but at least you have a torch, hero!
 * END
 * ```
 *
 * ```dramatoric
 * playerMood = "calm"
 *
 * IF: playerMood == "calm" DO
 *   HOST:
 *   You move with care.
 *
 *   ELSE: DO
 *     HOST:
 *     You charge in recklessly.
 *   END
 * END
 * ```
 *
 * ```dramatoric
 * ON: $input DO
 *   HOST: Say anything.
 *   said = CAPTURE:
 *   HOST: You said {{said.value}}.
 * END
 * ```
 *
 * ```dramatoric
 * ONCE: DO
 *   HOST: This line plays only once.
 * END
 * ```
 *
 * **Notes**
 * - WHEN can be used like IF for readability, and is also used inside CASE.
 * - ON listens for events like `$input` or custom types emitted with EMIT.
 * - You can list multiple ON event types separated by semicolons.
 * - ONCE can take an optional condition, just like IF.
 */
export const IF_directive: StoryDirectiveFuncDef = {
  type: [IF_TYPE, WHEN_TYPE, ON_TYPE, ONCE_TYPE],
  func: async (node, ctx, pms) => {
    if (node.type === ONCE_TYPE) {
      const key = ctx.path.join(".");
      if (ctx.session.once[key]) {
        return [false];
      }
      if (pms.text.trim() && !allTruthy(await evalAllClauses(pms.clauses, ctx, createLLMYieldIfFunc(ctx)))) {
        return [false];
      }
      ctx.session.once[key] = true;
      const { thenKids } = splitConditionalKids(node.kids);
      await executeKids(thenKids, ctx);
      return [true];
    }

    let condResult: boolean;
    if (node.type === ON_TYPE) {
      condResult = isOnMatch(pms.clauses, ctx);
      if (condResult) {
        ctx.event.captured = Date.now();
      }
    } else {
      condResult = allTruthy(await evalAllClauses(pms.clauses, ctx, createLLMYieldIfFunc(ctx)));
    }

    if (!condResult) {
      const { elseKids } = splitConditionalKids(node.kids);
      if (elseKids.length > 0) {
        await executeKids(elseKids, ctx);
      }
      return [false];
    }

    // For ON handlers, use checkpoint-based execution
    if (node.type === ON_TYPE) {
      const handler = ctx.handler;
      const isRetired = ctx.session.handlers[handler];
      if (isRetired) {
        return [false];
      }

      const checkpoint = ctx.session.checkpoints[handler] ?? [];
      const { thenKids } = splitConditionalKids(node.kids);

      ctx.resume = checkpoint;
      await executeKids(thenKids, ctx);
      ctx.resume = [];

      // If we completed without halting, reset checkpoint (loop)
      if (!ctx.halted) {
        delete ctx.session.checkpoints[handler];
      }

      return [true];
    }

    // Regular IF/WHEN: execute normally
    const { thenKids } = splitConditionalKids(node.kids);
    await executeKids(thenKids, ctx);
    return [condResult];
  },
};

function isOnMatch(
  clauses: string[],
  ctx: {
    event: { type: string; channel: string };
  },
) {
  for (const clause of clauses) {
    const eventType = clause.trim();
    if (!eventType) continue;
    if (eventType === INPUT_KEY) {
      if (ctx.event.channel === "input") return true;
      continue;
    }
    if (eventType === ANY_EVENT) return true;
    if (ctx.event.type === eventType) return true;
  }
  return false;
}
