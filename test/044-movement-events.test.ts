import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

const MOCK = true;

function byType(
  history: {
    type: string;
    from: string;
    result: unknown;
    origin?: string | null;
    destination?: string | null;
  }[],
  type: string,
) {
  return history.filter((event) => event.type === type);
}

async function test() {
  let result = await execStoryTest(
    dedent`
      ENTITY: ROOM A DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        location:
          place: ROOM A
          rel: in
        persona: You are Alice.
      END
    `,
    {},
    MOCK,
  );

  expect(byType(result.history, "location.enter").length, 0);
  expect(byType(result.history, "location.move").length, 0);
  expect(byType(result.history, "location.exit").filter((event) => event.from === "ALICE").length, 0);

  result = await execStoryTest(
    dedent`
      ENTITY: ROOM A DO
        kind: place
      END

      ENTITY: ROOM B DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        location:
          place: ROOM A
          rel: in
        persona: You are Alice.
      END

      SET: count {{applyPatches("ALICE", [{ op: "set", path: "location.place", value: "ROOM B" }, { op: "set", path: "location.rel", value: "in" }])}}
    `,
    {},
    MOCK,
  );

  expect(result.state.count, 2);
  const exits = byType(result.history, "location.exit").filter((event) => event.from === "ALICE");
  const enters = byType(result.history, "location.enter").filter((event) => event.from === "ALICE");
  const moves = byType(result.history, "location.move").filter((event) => event.from === "ALICE");
  expect(exits.length, 1);
  expect(enters.length, 1);
  expect(moves.length, 1);
  expect(exits[0]?.origin, "ROOM A");
  expect(exits[0]?.destination, "ROOM B");
  expect(enters[0]?.origin, "ROOM A");
  expect(enters[0]?.destination, "ROOM B");
  expect(moves[0]?.origin, "ROOM A");
  expect(moves[0]?.destination, "ROOM B");
  expectHas((exits[0]?.result ?? {}) as Record<string, unknown>, {
    entity: "ALICE",
    rel: "in",
    originRel: "in",
    destinationRel: "in",
  });
  expectHas((enters[0]?.result ?? {}) as Record<string, unknown>, {
    entity: "ALICE",
    rel: "in",
    originRel: "in",
    destinationRel: "in",
  });

  result = await execStoryTest(
    dedent`
      ENTITY: ROOM A DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        location:
          place: ROOM A
          rel: in
        persona: You are Alice.
      END

      SET: _ {{setStat("ALICE", "location.rel", "by door")}}
    `,
    {},
    MOCK,
  );

  expect(byType(result.history, "location.enter").length, 0);
  expect(byType(result.history, "location.move").length, 0);
  expect(byType(result.history, "location.exit").filter((event) => event.from === "ALICE").length, 0);

  result = await execStoryTest(
    dedent`
      ENTITY: ROOM A DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        persona: You are Alice.
      END

      SET: _ {{setStat("ALICE", "location.place", "ROOM A")}}
      SET: _ {{setStat("ALICE", "location.rel", "in")}}
    `,
    {},
    MOCK,
  );

  const entersFromEmpty = byType(result.history, "location.enter").filter((event) => event.from === "ALICE");
  const movesFromEmpty = byType(result.history, "location.move").filter((event) => event.from === "ALICE");
  const exitsFromEmpty = byType(result.history, "location.exit").filter((event) => event.from === "ALICE");
  expect(entersFromEmpty.length, 1);
  expect(movesFromEmpty.length, 1);
  expect(exitsFromEmpty.length, 0);
  expect(entersFromEmpty[0]?.origin, null);
  expect(entersFromEmpty[0]?.destination, "ROOM A");
  expect(movesFromEmpty[0]?.origin, null);
  expect(movesFromEmpty[0]?.destination, "ROOM A");
}

test();
