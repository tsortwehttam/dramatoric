import dedent from "dedent";
import { step } from "../eng/Engine";
import { createTestContext } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const MOCK = true;

async function test() {
  // send() queues input and runs a step
  const ctx = createTestContext(
    dedent`
      ON: $input DO
        SET: got $input.value
      END
    `,
    {},
    MOCK,
  );
  await step(ctx);

  await ctx.send({ from: "PLAYER", raw: "hello" });
  expect(ctx.session.state.got, "hello");

  // send() with structured event (custom type, bypasses LLM parsing)
  const ctx2 = createTestContext(
    dedent`
      ON: click DO
        SET: clicked $event.value
      END
    `,
    {},
    MOCK,
  );
  await step(ctx2);

  await ctx2.send({
    from: "PLAYER",
    raw: "click",
    type: "click",
    act: "command",
    to: ["GUARD"],
    value: "clicked GUARD",
  });
  expect(ctx2.session.state.clicked, "clicked GUARD");
}

test();
