import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

async function test() {
  // BLOCK: defines reusable content, RUN: executes it
  let result = await execStoryTest(
    dedent`
      BLOCK: Greeting DO
        FRANK:
        Hello from the block!
      END

      RUN: Greeting
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Hello from the block!",
  });

  // RUN: with scoped parameters
  result = await execStoryTest(
    dedent`
      BLOCK: SayName DO
        FRANK:
        Your name is {{name}}.
      END

      RUN: SayName; name "Alice"
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Your name is Alice.",
  });

  // RUN: multiple calls to same block
  result = await execStoryTest(
    dedent`
      SET: count 0

      BLOCK: Increment DO
        INCR: count
      END

      RUN: Increment
      RUN: Increment
      RUN: Increment
    `,
    {}
  );
  expect(result.state.count, 3);

  // WHILE: basic loop with condition
  result = await execStoryTest(
    dedent`
      SET: count 0

      WHILE: count < 3 DO
        INCR: count
      END
    `,
    {}
  );
  expect(result.state.count, 3);

  // WHILE: with $iteration variable
  result = await execStoryTest(
    dedent`
      SET: lastIter 0

      WHILE: $iteration < 5 DO
        SET: lastIter $iteration
      END
    `,
    {}
  );
  expect(result.state.lastIter, 4);

  // WHILE: with BREAK
  result = await execStoryTest(
    dedent`
      SET: count 0

      WHILE: true DO
        INCR: count

        IF: count === 3 DO
          BREAK:
        END
      END
    `,
    {}
  );
  expect(result.state.count, 3);

  // WHILE: with custom iteration variable via eave syntax
  result = await execStoryTest(
    dedent`
      SET: sum 0

      WHILE: $iteration < 3 DO |i|
        SET: sum {{sum + i}}
      END
    `,
    {}
  );
  expect(result.state.sum, 3); // 0 + 1 + 2 = 3

  // WHILE: condition false from start (never executes)
  result = await execStoryTest(
    dedent`
      SET: count 0

      WHILE: false DO
        INCR: count
      END
    `,
    {}
  );
  expect(result.state.count, 0);
}

test();
