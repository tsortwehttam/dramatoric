import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

async function test() {
  // Basic dialog - runs automatically via PRELUDE on $start
  let result = await execStoryTest(
    dedent`
      FRANK:
      Hello world!
    `,
    {}
  );
  // history[0] = $start, history[1] = dialog
  expectHas(result.history[1], {
    act: "dialog",
    from: "FRANK",
    type: "$message",
    value: "Hello world!",
  });

  result = await execStoryTest(
    dedent`
      SET: foo 1

      SET: bar {{foo + 1}}
    `,
    {}
  );
  expect(result.state.foo, 1);
  expect(result.state.bar, 2);

  // IF: true condition
  result = await execStoryTest(
    dedent`
      SET: foo 1

      IF: foo === 1 DO
        FRANK:
        Hello world!
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    act: "dialog",
    from: "FRANK",
    type: "$message",
    value: "Hello world!",
  });

  // IF: with INCR and comparison
  result = await execStoryTest(
    dedent`
      SET: foo 1

      INCR: foo

      INCR: foo 2

      IF: foo > 3 DO
        FRANK:
        Hello world!
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    act: "dialog",
    from: "FRANK",
    type: "$message",
    value: "Hello world!",
  });

  // IF/ELSE: false condition triggers else
  result = await execStoryTest(
    dedent`
      SET: mood "tense"

      IF: mood === "calm" DO
        FRANK:
        You are calm.

        ELSE: DO
          FRANK:
          You are not calm.
        END
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "You are not calm.",
  });

  // VARY: PICK selects a fixed number
  result = await execStoryTest(
    dedent`
      SET: count 0

      VARY: PICK 2 DO
        INCR: count
        INCR: count
        INCR: count
      END
    `,
    { seed: "fixed" }
  );
  expect(result.state.count, 2);

  // PARALLEL: runs children concurrently
  result = await execStoryTest(
    dedent`
      SET: a 0
      SET: b 0

      PARALLEL: DO
        SET: a 1

        SET: b 2
      END
    `,
    {}
  );
  expect(result.state.a, 1);
  expect(result.state.b, 2);

  // EACH: iterates over arrays
  result = await execStoryTest(
    dedent`
      SET: count 0
      SET: items [1, 2, 3]

      EACH: items DO
        INCR: count
      END
    `,
    {}
  );
  expect(result.state.count, 3);

  // DATA: parses structured YAML data
  result = await execStoryTest(
    dedent`
      stats = DATA: DO
        health: 100
        mana: 50
      END
    `,
    {}
  );
  expect(result.state.stats, { health: 100, mana: 50 });

  // CODE: inline scripting
  result = await execStoryTest(
    dedent`
      val = CODE: DO
        1 + 2 + 3
      END
    `,
    {}
  );
  expect(result.state.val, 6);

  // CASE: with WHEN matching
  result = await execStoryTest(
    dedent`
      SET: mood "tense"

      CASE: mood DO
        WHEN: "calm" DO
          FRANK:
          Calm branch.
        END

        WHEN: "tense" DO
          FRANK:
          Tense branch.
        END

        ELSE: DO
          FRANK:
          Default branch.
        END
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Tense branch.",
  });

  // CASE: falls through to ELSE
  result = await execStoryTest(
    dedent`
      SET: mood "unknown"

      CASE: mood DO
        WHEN: "calm" DO
          FRANK:
          Calm branch.
        END

        WHEN: "tense" DO
          FRANK:
          Tense branch.
        END

        ELSE: DO
          FRANK:
          Default branch.
        END
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Default branch.",
  });

  // Magic variables: $turns and $first on first turn (via PRELUDE)
  result = await execStoryTest(
    dedent`
      SET: turnNum $turns
      SET: isFirst $first
    `,
    {}
  );
  expect(result.state.turnNum, 0);
  expect(result.state.isFirst, true);

  // $first is false on subsequent turns - must use ON: $input since PRELUDE only runs on $start
  result = await execStoryTest(
    dedent`
      ON: $input DO
        SET: turnNum $turns
        SET: isFirst $first
      END
    `,
    { inputs: [{ from: "me", raw: "" }], turns: 1 }
  );
  expect(result.state.turnNum, 1);
  expect(result.state.isFirst, false);
}

test();
