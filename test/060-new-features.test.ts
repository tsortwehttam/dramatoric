import dedent from "dedent";
import { renderHandlebarsAndDDV } from "../eng/Execution";
import { evaluateExprCore, parseExprCore, ExprEvalFunc } from "../eng/Evaluator";
import { SerialValue } from "../lib/CoreTypings";
import { execStoryTest, createTestContext } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

async function test() {
  // ============================================================
  // cond() function
  // ============================================================

  // Basic: first truthy condition wins
  let result = await execStoryTest(
    dedent`
      SET: x 5
      SET: label {{cond(x > 10, "big", x > 3, "medium", "small")}}
    `,
    {},
  );
  expect(result.state.label, "medium");

  // Default fallback (odd number of args)
  result = await execStoryTest(
    dedent`
      SET: x 1
      SET: label {{cond(x > 10, "big", x > 5, "medium", "small")}}
    `,
    {},
  );
  expect(result.state.label, "small");

  // No match, no default (null becomes empty string via interpolation)
  result = await execStoryTest(
    dedent`
      SET: x 1
      SET: label {{cond(x > 10, "big", x > 5, "medium")}}
    `,
    {},
  );
  expect(result.state.label, "");

  // Single pair
  result = await execStoryTest(
    dedent`
      SET: x 1
      SET: label {{cond(true, "yes")}}
    `,
    {},
  );
  expect(result.state.label, "yes");

  // cond() inside dialogue interpolation
  result = await execStoryTest(
    dedent`
      SET: mood "angry"

      FRANK:
      I feel {{cond(mood == "happy", "great", mood == "angry", "terrible", "okay")}}.
    `,
    {},
  );
  expectHas(result.history[1], {
    value: "I feel terrible.",
  });

  // ============================================================
  // has / hasnt operators
  // ============================================================

  function ev(
    expr: string,
    vars: Record<string, SerialValue> = {},
    funcs: Record<string, ExprEvalFunc> = {},
  ): SerialValue {
    const ast = parseExprCore(expr);
    if (!ast) throw new Error("parse failed: " + expr);
    return evaluateExprCore(ast, vars, funcs);
  }

  // Array has
  expect(ev("items has 'sword'", { items: ["sword", "shield"] }), true);
  expect(ev("items has 'potion'", { items: ["sword", "shield"] }), false);

  // Array hasnt
  expect(ev("items hasnt 'potion'", { items: ["sword", "shield"] }), true);
  expect(ev("items hasnt 'sword'", { items: ["sword", "shield"] }), false);

  // String has
  expect(ev("greeting has 'ell'", { greeting: "hello" }), true);
  expect(ev("greeting has 'xyz'", { greeting: "hello" }), false);

  // String hasnt
  expect(ev("greeting hasnt 'xyz'", { greeting: "hello" }), true);
  expect(ev("greeting hasnt 'ell'", { greeting: "hello" }), false);

  // Empty array
  expect(ev("items has 'anything'", { items: [] }), false);
  expect(ev("items hasnt 'anything'", { items: [] }), true);

  // has with numbers in array
  expect(ev("nums has 3", { nums: [1, 2, 3] }), true);
  expect(ev("nums has 4", { nums: [1, 2, 3] }), false);

  // has combined with && and ||
  expect(ev("items has 'sword' && items has 'shield'", { items: ["sword", "shield"] }), true);
  expect(ev("items has 'sword' && items has 'potion'", { items: ["sword", "shield"] }), false);
  expect(ev("items has 'sword' || items has 'potion'", { items: ["sword", "shield"] }), true);

  // has in IF condition within story
  result = await execStoryTest(
    dedent`
      SET: inventory ["sword", "shield"]

      IF: inventory has "sword" DO
        FRANK:
        You have a sword!
      END
    `,
    {},
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "You have a sword!",
  });

  // hasnt in IF condition
  result = await execStoryTest(
    dedent`
      SET: inventory ["sword", "shield"]

      IF: inventory hasnt "potion" DO
        FRANK:
        You need a potion.
      END
    `,
    {},
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "You need a potion.",
  });

  // ============================================================
  // Sticky DDV mode ({{+a|b|c}})
  // ============================================================

  function ctxWithState(state: Record<string, SerialValue> = {}) {
    return createTestContext("NARRATOR:\nHello", { state, seed: "sticky-test" }, true);
  }

  const stickyCtx = ctxWithState();
  expect(renderHandlebarsAndDDV("{{+first|second|third}}", stickyCtx), "first");
  expect(renderHandlebarsAndDDV("{{+first|second|third}}", stickyCtx), "second");
  expect(renderHandlebarsAndDDV("{{+first|second|third}}", stickyCtx), "third");
  // After exhausting, sticks on last
  expect(renderHandlebarsAndDDV("{{+first|second|third}}", stickyCtx), "third");
  expect(renderHandlebarsAndDDV("{{+first|second|third}}", stickyCtx), "third");

  // Two-element sticky
  const sticky2Ctx = ctxWithState();
  expect(renderHandlebarsAndDDV("{{+intro|ongoing}}", sticky2Ctx), "intro");
  expect(renderHandlebarsAndDDV("{{+intro|ongoing}}", sticky2Ctx), "ongoing");
  expect(renderHandlebarsAndDDV("{{+intro|ongoing}}", sticky2Ctx), "ongoing");

  // Single-element sticky (always returns same)
  const sticky1Ctx = ctxWithState();
  expect(renderHandlebarsAndDDV("{{+only}}", sticky1Ctx), "only");
  expect(renderHandlebarsAndDDV("{{+only}}", sticky1Ctx), "only");

  // ============================================================
  // $visits magic variable
  // ============================================================

  result = await execStoryTest(
    dedent`
      BLOCK: Greet DO
        SET: visitCount {{$visits}}
      END

      RUN: Greet
    `,
    {},
  );
  expect(result.state.visitCount, 1);
  expect(result.visits["Greet"], 1);

  // Multiple runs increment visits
  result = await execStoryTest(
    dedent`
      BLOCK: Greet DO
        SET: visitCount {{$visits}}
      END

      RUN: Greet
      RUN: Greet
      RUN: Greet
    `,
    {},
  );
  expect(result.state.visitCount, 3);
  expect(result.visits["Greet"], 3);

  // $visits is scoped per block name
  result = await execStoryTest(
    dedent`
      BLOCK: A DO
        SET: aVisits {{$visits}}
      END

      BLOCK: B DO
        SET: bVisits {{$visits}}
      END

      RUN: A
      RUN: B
      RUN: A
      RUN: B
      RUN: B
    `,
    {},
  );
  expect(result.state.aVisits, 2);
  expect(result.state.bVisits, 3);

  // ============================================================
  // GOTO + SCENE
  // ============================================================

  // Basic GOTO to a SCENE
  result = await execStoryTest(
    dedent`
      FRANK:
      Before.

      GOTO: Kitchen

      FRANK:
      This should not appear.

      SCENE: Kitchen DO
        FRANK:
        In the kitchen.
      END
    `,
    {},
  );
  expectHas(result.history[1], { from: "FRANK", value: "Before." });
  expectHas(result.history[2], { from: "FRANK", value: "In the kitchen." });
  // "This should not appear" should NOT be in history
  const afterGoto = result.history.filter((e: any) => e.value === "This should not appear.");
  expect(afterGoto.length, 0);

  // Chained GOTOs
  result = await execStoryTest(
    dedent`
      GOTO: A

      SCENE: A DO
        FRANK:
        In A.
        GOTO: B
      END

      SCENE: B DO
        FRANK:
        In B.
        GOTO: C
      END

      SCENE: C DO
        FRANK:
        In C.
      END
    `,
    {},
  );
  expectHas(result.history[1], { from: "FRANK", value: "In A." });
  expectHas(result.history[2], { from: "FRANK", value: "In B." });
  expectHas(result.history[3], { from: "FRANK", value: "In C." });

  // GOTO from inside a loop
  result = await execStoryTest(
    dedent`
      SET: i 0

      WHILE: i < 10 DO
        INCR: i
        IF: i == 3 DO
          GOTO: Done
        END
      END

      FRANK:
      Should not appear.

      SCENE: Done DO
        FRANK:
        Escaped at {{i}}.
      END
    `,
    {},
  );
  expect(result.state.i, 3);
  expectHas(result.history[1], { from: "FRANK", value: "Escaped at 3." });
  const shouldNot = result.history.filter((e: any) => e.value === "Should not appear.");
  expect(shouldNot.length, 0);

  // GOTO from inside a BLOCK (via RUN)
  result = await execStoryTest(
    dedent`
      BLOCK: CheckDoor DO
        IF: locked DO
          GOTO: Locked Room
        END
        FRANK:
        Door opens.
      END

      SET: locked true
      RUN: CheckDoor

      SCENE: Locked Room DO
        FRANK:
        The door is locked.
      END
    `,
    {},
  );
  expectHas(result.history[1], { from: "FRANK", value: "The door is locked." });
  const doorOpens = result.history.filter((e: any) => e.value === "Door opens.");
  expect(doorOpens.length, 0);

  // $visits in SCENE via GOTO
  result = await execStoryTest(
    dedent`
      GOTO: Room

      SCENE: Room DO
        SET: roomVisits {{$visits}}
        FRANK:
        Visit {{$visits}}.
      END
    `,
    {},
  );
  expect(result.state.roomVisits, 1);
  expect(result.visits["Room"], 1);

  // GOTO with conditional branching
  result = await execStoryTest(
    dedent`
      SET: mood "happy"

      CASE: mood DO
        WHEN: "happy" DO
          GOTO: Happy Place
        END
        WHEN: "sad" DO
          GOTO: Sad Place
        END
      END

      SCENE: Happy Place DO
        FRANK:
        Sunshine!
      END

      SCENE: Sad Place DO
        FRANK:
        Rain.
      END
    `,
    {},
  );
  expectHas(result.history[1], { from: "FRANK", value: "Sunshine!" });

  // GOTO to non-existent scene (graceful failure — execution continues)
  result = await execStoryTest(
    dedent`
      GOTO: Nonexistent

      FRANK:
      Still here.
    `,
    {},
  );
  // When the target doesn't exist, GOTO is a no-op and execution continues
  const stillHere = result.history.filter((e: any) => e.value === "Still here.");
  expect(stillHere.length, 1);

  console.info("[test] All new feature tests passed!");
}

test();
