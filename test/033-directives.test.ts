import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

async function test() {
  // EMIT: sends custom event
  let result = await execStoryTest(
    dedent`
      EMIT: "myEvent"; from "hero"
    `,
    {}
  );
  const emitEvent = result.history.find((e) => e.type === "myEvent");
  expectHas(emitEvent, {
    type: "myEvent",
    from: "hero",
  });

  // ON: eventType - event handler (processes on next step)
  result = await execStoryTest(
    dedent`
      ON: $input DO
        EMIT: "doorOpened"
      END

      ON: doorOpened DO
        FRANK:
        The door is open!
      END
    `,
    { inputs: [{ from: "me", raw: "" }] }
  );
  // Step 1: EMIT fires, doorOpened added to history but ON handler hasn't run yet
  const doorEvent = result.history.find((e) => e.type === "doorOpened");
  expect(!!doorEvent, true);

  // Step 2: doorOpened event is processed by ON handler
  result = await execStoryTest(
    dedent`
      ON: $input DO
        EMIT: "doorOpened"
      END

      ON: doorOpened DO
        FRANK:
        The door is open!
      END
    `,
    { ...result, inputs: [] }
  );
  expectHas(
    result.history.find((e) => e.value === "The door is open!"),
    {
      from: "FRANK",
      value: "The door is open!",
    }
  );

  // IF: eventName shorthand - event not present (inside ON: $input handler)
  result = await execStoryTest(
    dedent`
      ON: $input DO
        IF: doorOpened DO
          FRANK:
          The door is open!
        END

        FRANK:
        Nothing happened.
      END
    `,
    { inputs: [{ from: "me", raw: "" }] }
  );
  // history has: $start, input, "Nothing happened."
  expect(result.history.length, 3);
  expectHas(result.history[2], {
    from: "FRANK",
    value: "Nothing happened.",
  });

  // ONCE: runs on first execution
  const onceScript = dedent`
    ONCE: DO
      FRANK:
      Welcome!
    END
  `;
  result = await execStoryTest(onceScript, {});
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Welcome!",
  });

  // ONCE: does not run on subsequent executions (carries over session.once)
  result = await execStoryTest(onceScript, {
    ...result,
    inputs: [{ from: "me", raw: "" }],
  });
  // History should have: prev $start, prev FRANK, new input (no new FRANK)
  const welcomeMessages = result.history.filter((e) => e.value === "Welcome!");
  expect(welcomeMessages.length, 1); // only one Welcome! from first run

  // $first in IF condition - runs automatically via PRELUDE
  result = await execStoryTest(
    dedent`
      IF: $first DO
        FRANK:
        Welcome!
      END
    `,
    {}
  );
  expectHas(result.history[1], {
    from: "FRANK",
    value: "Welcome!",
  });

  // $first is false on turn 1 - must use ON: $input since PRELUDE only runs on $start
  result = await execStoryTest(
    dedent`
      ON: $input DO
        IF: $first DO
          FRANK:
          Welcome!
        END
      END
    `,
    { inputs: [{ from: "me", raw: "" }], turns: 1 }
  );
  expect(result.history.length, 1); // only the input message

  // --- CAPTURE directive tests ---

  // CAPTURE: halts on first encounter, sets checkpoint
  result = await execStoryTest(
    dedent`
      ON: $input DO
        FRANK:
        What is your name?

        name = CAPTURE:

        FRANK:
        Hello, {{name.value}}!
      END
    `,
    { inputs: [{ from: "me", raw: "" }] }
  );
  // history: $start, input, "What is your name?"
  expectHas(result.history[2], {
    from: "FRANK",
    value: "What is your name?",
  });
  expect(result.history.length, 3);

  // CAPTURE: resumes from checkpoint and assigns value
  result = await execStoryTest(
    dedent`
      ON: $input DO
        FRANK:
        What is your name?

        name = CAPTURE:

        FRANK:
        Hello, {{name.value}}!
      END
    `,
    {
      ...result,
      inputs: [{ from: "me", raw: "Alice", value: "Alice" }],
    }
  );
  expectHas(result.state.name, { value: "Alice" });
  // Find the greeting message (not the "What is your name?" one)
  const greeting = result.history.find((e) => e.value === "Hello, Alice!");
  expectHas(greeting, {
    from: "FRANK",
    value: "Hello, Alice!",
  });

  // CAPTURE: multi-step flow
  const multiStepScript = dedent`
    ON: $input DO
      FRANK:
      First question?

      a = CAPTURE:

      FRANK:
      Second question?

      b = CAPTURE:

      FRANK:
      Done! a={{a.value}}, b={{b.value}}
    END
  `;

  result = await execStoryTest(multiStepScript, { inputs: [{ from: "me", raw: "" }] });
  // Turn 0: Should halt at first CAPTURE, history: $start, input, "First question?"
  expect(result.history.length, 3);

  // Turn 1: Resume, capture first input, halt at second CAPTURE
  result = await execStoryTest(multiStepScript, {
    ...result,
    inputs: [{ from: "me", raw: "foo", value: "foo" }],
  });
  expectHas(result.state.a, { value: "foo" });
  // At second CAPTURE
  const secondQ = result.history.find((e) => e.value === "Second question?");
  expectHas(secondQ, {
    from: "FRANK",
    value: "Second question?",
  });

  // Turn 2: Resume, capture second input, complete
  result = await execStoryTest(multiStepScript, {
    ...result,
    inputs: [{ from: "me", raw: "bar", value: "bar" }],
  });
  expectHas(result.state.a, { value: "foo" });
  expectHas(result.state.b, { value: "bar" });
  // Cleared - handler looped
  const doneMsg = result.history.find((e) => e.value === "Done! a=foo, b=bar");
  expectHas(doneMsg, {
    from: "FRANK",
    value: "Done! a=foo, b=bar",
  });

  // SUSPEND: halts and resumes on next tick
  const suspendScript = dedent`
    ON: $input DO
      FRANK:
      Ready?

      SUSPEND:

      FRANK:
      Go.
    END
  `;

  result = await execStoryTest(suspendScript, { inputs: [{ from: "me", raw: "" }] });
  expectHas(result.history[2], {
    from: "FRANK",
    value: "Ready?",
  });
  // history: $start, input, "Ready?"
  expect(result.history.length, 3);

  result = await execStoryTest(suspendScript, {
    ...result,
    inputs: [{ from: "me", raw: "" }],
  });
  expectHas(result.history.find((e) => e.value === "Go."), {
    from: "FRANK",
    value: "Go.",
  });

  const loopScript = dedent`
    ON: $input DO
      SET: count 0

      WHILE: count < 2 DO
        INCR: count

        FRANK:
        Loop {{count}}?

        answer = CAPTURE:

        FRANK:
        Heard {{answer.value}}.
      END

      FRANK:
      Done.
    END
  `;

  result = await execStoryTest(loopScript, { inputs: [{ from: "me", raw: "" }] });
  expectHas(result.history[2], {
    from: "FRANK",
    value: "Loop 1?",
  });

  result = await execStoryTest(loopScript, {
    ...result,
    inputs: [{ from: "me", raw: "A", value: "A" }],
  });
  expectHas(result.state.answer, { value: "A" });
  const loop1 = result.history.filter((e) => e.value === "Loop 1?");
  expect(loop1.length, 1);
  expectHas(result.history.find((e) => e.value === "Loop 2?"), {
    from: "FRANK",
    value: "Loop 2?",
  });

  result = await execStoryTest(loopScript, {
    ...result,
    inputs: [{ from: "me", raw: "B", value: "B" }],
  });
  expectHas(result.state.answer, { value: "B" });
  expectHas(result.history.find((e) => e.value === "Done."), {
    from: "FRANK",
    value: "Done.",
  });
}

test();
