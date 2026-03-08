import dedent from "dedent";
import { execMultiStepTest, execStoryTest } from "./TestEngineUtils";
import { expectHas } from "./TestUtils";

async function test() {
  // IF inside dialog block - condition true
  let result = await execStoryTest(
    dedent`
      SET: mood "happy"

      FRANK: DO
        Hello there.
        IF: mood === "happy" DO
          You seem cheerful!
        END
        Goodbye.
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Hello there.\nYou seem cheerful!\nGoodbye.",
  });

  // IF inside dialog block - condition false (text excluded, empty line remains)
  result = await execStoryTest(
    dedent`
      SET: mood "sad"

      FRANK: DO
        Hello there.
        IF: mood === "happy" DO
          You seem cheerful!
        END
        Goodbye.
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Hello there.\n\nGoodbye.",
  });

  // IF/ELSE inside dialog block
  result = await execStoryTest(
    dedent`
      SET: mood "sad"

      FRANK: DO
        Hello there.
        IF: mood === "happy" DO
          You seem cheerful!

          ELSE: DO
            You seem down.
          END
        END
        Goodbye.
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Hello there.\nYou seem down.\nGoodbye.",
  });

  // ONCE inside dialog block - first turn
  result = await execStoryTest(
    dedent`
      FRANK: DO
        ONCE: DO
          Welcome to the story!
        END
        What would you like to do?
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Welcome to the story!\nWhat would you like to do?",
  });

  // ONCE inside dialog block - subsequent turn (text excluded)
  // Run two turns: first turn ONCE shows, second turn ONCE is skipped
  result = await execMultiStepTest(
    dedent`
      ON: $input DO
        FRANK: DO
          ONCE: DO
            Welcome to the story!
          END
          What would you like to do?
        END
      END
    `,
    [
      { inputs: [{ from: "me", raw: "" }] },
      { inputs: [{ from: "me", raw: "" }] },
    ]
  );
  // history[0]=$start, history[1]=input1, history[2]=FRANK with ONCE
  // history[3]=input2, history[4]=FRANK without ONCE
  expectHas(result.history[2], {
    from: "FRANK",
    value: "Welcome to the story!\nWhat would you like to do?",
  });
  expectHas(result.history[4], {
    from: "FRANK",
    value: "What would you like to do?",
  });

  // CASE inside dialog block
  result = await execStoryTest(
    dedent`
      SET: weather "rainy"

      FRANK: DO
        Good morning.
        CASE: weather DO
          WHEN: "sunny" DO
            Beautiful day outside!
          END

          WHEN: "rainy" DO
            Don't forget your umbrella.
          END

          ELSE: DO
            Weather looks okay.
          END
        END
        See you later.
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Good morning.\nDon't forget your umbrella.\nSee you later.",
  });

  // CASE inside dialog block - else branch
  result = await execStoryTest(
    dedent`
      SET: weather "cloudy"

      FRANK: DO
        Good morning.
        CASE: weather DO
          WHEN: "sunny" DO
            Beautiful day outside!
          END

          WHEN: "rainy" DO
            Don't forget your umbrella.
          END

          ELSE: DO
            Weather looks okay.
          END
        END
        See you later.
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Good morning.\nWeather looks okay.\nSee you later.",
  });
}

test();
