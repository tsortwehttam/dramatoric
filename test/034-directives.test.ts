import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

async function test() {
  // PRELUDE: runs automatically on $start (first step) - no input required
  let result = await execStoryTest(
    dedent`
      NARRATOR:
      Hello from the prelude!
    `,
    {}
  );
  // history[0] is $start, history[1] is the NARRATOR message
  expectHas(result.history[1], {
    act: "dialog",
    from: "NARRATOR",
    type: "$message",
    value: "Hello from the prelude!",
  });

  // PRELUDE: implicit - top-level content runs without needing input
  result = await execStoryTest(
    dedent`
      SET: greeted true

      NARRATOR:
      Welcome to the story!
    `,
    {}
  );
  expect(result.state.greeted, true);
  expectHas(result.history[1], {
    from: "NARRATOR",
    value: "Welcome to the story!",
  });

  // PRELUDE: explicit - can be written explicitly
  result = await execStoryTest(
    dedent`
      PRELUDE: DO
        SET: started true

        NARRATOR:
        Explicit prelude!
      END
    `,
    {}
  );
  expect(result.state.started, true);
  expectHas(result.history[1], {
    from: "NARRATOR",
    value: "Explicit prelude!",
  });

  // PRELUDE: does not run on subsequent turns (turns > 0)
  result = await execStoryTest(
    dedent`
      NARRATOR:
      First time only!
    `,
    { turns: 1 }
  );
  // No $start event on turns > 0, so no PRELUDE execution
  expect(result.history.length, 0);

  // EPILOGUE: runs on $exit event
  result = await execStoryTest(
    dedent`
      EXIT:

      EPILOGUE: DO
        SET: ended true
      END
    `,
    {}
  );
  expect(result.state.ended, true);

  // RESUME: tied to $resume event (not tested here since we'd need to simulate resume)
  // Just verify it compiles correctly and doesn't run on fresh start
  result = await execStoryTest(
    dedent`
      RESUME: DO
        SET: resumed true
      END

      NARRATOR:
      Fresh start!
    `,
    {}
  );
  expect(result.state.resumed, null);
  expectHas(result.history[1], {
    from: "NARRATOR",
    value: "Fresh start!",
  });

  console.info("[test] All PRELUDE/RESUME/EPILOGUE tests passed!");
}

test();
