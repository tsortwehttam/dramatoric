import dedent from "dedent";
import { execStoryTest, execStoryTestWithMockLlm, MockLlmFixture } from "./TestEngineUtils";
import { expect } from "./TestUtils";

async function test() {
  const fixtures: MockLlmFixture[] = [
    {
      name: "alice simulate cue",
      systemIncludes: ["Respond in character as ALICE.", "Keep Alice calm."],
      userIncludes: [
        "Alice should say exactly: Let's slow down.",
        "She should also take a deliberate action toward BOB described exactly as: Alice asks for a slower review.",
      ],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["BOB"],
            body: "Let's slow down.",
          },
          {
            type: "deliberate",
            to: ["BOB"],
            body: "Alice asks for a slower review.",
          },
        ],
      },
    },
  ];
  let result = await execStoryTestWithMockLlm(
    dedent`
      ENTITY: ROOM DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        place: ROOM
        rel: in
      END

      ENTITY: BOB DO
        kind: person
        place: ROOM
        rel: in
      END

      SET: stop null
      SET: turns 0

      SIMULATE: until stop == "done"; max 3 DO
        CUE: ALICE DO
          SYSTEM PROMPT:
          Keep Alice calm.

          Alice should say exactly: Let's slow down.
          She should also take a deliberate action toward BOB described exactly as: Alice asks for a slower review.
        END

        WITH: ALICE DO
          STATE: DO
            @mood: settled
          END
        END

        SET: stop "done"
        INCR: turns 1
      END
    `,
    {},
    fixtures,
  );

  expect(result.state.turns, 1);
  expect(result.entities.ALICE.stats.public, { mood: "settled" });
  expect(!!result.history.find((event) => event.from === "ALICE" && event.value === "Let's slow down."), true);
  expect(
    !!result.history.find((event) => event.type === "deliberate" && event.from === "ALICE" && event.value === "Alice asks for a slower review."),
    true,
  );

  result = await execStoryTest(
    dedent`
      SET: count 0

      SIMULATE: max 5 DO
        INCR: count 1

        IF: count == 2 DO
          BREAK:
        END
      END
    `,
    {},
  );

  expect(result.state.count, 2);
}

test();
