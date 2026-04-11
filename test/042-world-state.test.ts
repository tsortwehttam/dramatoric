import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

const MOCK = true;

function findEvent(
  history: { type: string; from: string; value: string; result: unknown; origin?: string | null; destination?: string | null }[],
  type: string,
) {
  return history.find((event) => event.type === type);
}

async function test() {
  let result = await execStoryTest(
    dedent`
      ENTITY: JURY ROOM DO
        kind: place
        public:
          label: Jury Room
      END

      ENTITY: HALLWAY DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        public:
          mood: guarded
        private:
          goal: get home
        location:
          place: JURY ROOM
          rel: in
        persona: You are Alice.
      END

      ENTITY: BOB DO
        kind: person
        public:
          mood: tense
        private:
          goal: convict
        location:
          place: JURY ROOM
          rel: in
        persona: You are Bob.
      END

      ENTITY: FILE DO
        kind: thing
        public:
          state: sealed
        location:
          place: JURY ROOM
          rel: on table
      END

      ENTITY: CAROL DO
        kind: person
        public:
          mood: distant
        private:
          goal: leave
        location:
          place: HALLWAY
          rel: in
        persona: You are Carol.
      END

      SET: _ {{emitActions("BOB", [{ type: "say", to: ["ALICE"], body: "We should keep talking." }])}}

      SET: sameRoom {{coLocated("ALICE", "BOB")}}
      SET: diffRoom {{coLocated("ALICE", "CAROL")}}
      SET: bobVisible {{visibleTo("ALICE", "BOB")}}
      SET: carolVisible {{visibleTo("ALICE", "CAROL")}}
      SET: view {{pov("ALICE")}}
    `,
    {},
    MOCK,
  );

  expect(result.state.sameRoom, true);
  expect(result.state.diffRoom, false);
  expect(result.state.bobVisible, true);
  expect(result.state.carolVisible, false);
  expectHas(result.state.view as Record<string, unknown>, {
    you: {
      name: "ALICE",
      kind: "person",
      persona: "You are Alice.",
      public: { mood: "guarded" },
      private: { goal: "get home" },
      location: { place: "JURY ROOM", rel: "in" },
    },
  });

  const people = (result.state.view as Record<string, Record<string, unknown>[]>).people;
  const things = (result.state.view as Record<string, Record<string, unknown>[]>).things;
  const places = (result.state.view as Record<string, Record<string, unknown>[]>).places;
  const events = (result.state.view as Record<string, Record<string, unknown>[]>).events;
  expect(people.length, 1);
  expect(people[0]?.name, "BOB");
  expectHas(people[0] ?? {}, { public: { mood: "tense" } });
  expect((people[0] ?? {}).private, undefined);
  expect(things.length, 1);
  expect(things[0]?.name, "FILE");
  expect(places.length, 1);
  expect(places[0]?.name, "JURY ROOM");
  expect(events.length > 0, true);
  expect(events.some((event) => event.from === "BOB" && event.value === "We should keep talking."), true);

  result = await execStoryTest(
    dedent`
      ENTITY: ALICE DO
        kind: person
        public:
          mood: guarded
        private:
          goal: get home
        location:
          place: JURY ROOM
          rel: in
        persona: You are Alice.
      END

      SET: count {{applyPatches("ALICE", [{ op: "set", path: "public.mood", value: "open" }, { op: "set", path: "private.goal", value: "stay" }, { op: "set", path: "location.rel", value: "at table" }, { op: "del", path: "private.goal" }, { op: "set", path: "persona", value: "ignored" }])}}

      SET: mood {{stat("ALICE", "public.mood")}}
      SET: locn {{loc("ALICE")}}
      SET: view {{pov("ALICE")}}
    `,
    {},
    MOCK,
  );

  expect(result.state.count, 4);
  expect(result.state.mood, "open");
  expectHas(result.state.locn, { place: "JURY ROOM", rel: "at table" });
  expectHas((result.state.view as Record<string, unknown>).you as Record<string, unknown>, {
    public: { mood: "open" },
    private: {},
  });
  expect(result.entities.ALICE.persona, "You are Alice.");
  const noMove = findEvent(result.history, "location.move");
  expect(!!noMove, false);

  result = await execStoryTest(
    dedent`
      ENTITY: ALICE DO
        kind: person
        persona: You are Alice.
      END

      ENTITY: BOB DO
        kind: person
        persona: You are Bob.
      END

      SET: count {{emitActions("ALICE", [{ type: "say", to: ["BOB"], body: "I disagree." }, { type: "accuse", to: ["BOB"], body: "You are guessing." }])}}
    `,
    {},
    MOCK,
  );

  expect(result.state.count, 2);
  const say = findEvent(result.history, "$message");
  expect(!!say, true);
  expect(say?.from, "ALICE");
  expect(say?.value, "I disagree.");
  const accuse = findEvent(result.history, "accuse");
  expect(!!accuse, true);
  expect(accuse?.from, "ALICE");
  expect(accuse?.value, "You are guessing.");
  expectHas((accuse?.result ?? {}) as Record<string, unknown>, {
    type: "accuse",
    to: ["BOB"],
    body: "You are guessing.",
  });

  result = await execStoryTest(
    dedent`
      ENTITY: JURY ROOM DO
        kind: place
      END

      ENTITY: HALLWAY DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        location:
          place: JURY ROOM
          rel: in
      END

      WITH: ALICE DO
        STATE: DO
          location:
            place: HALLWAY
            rel: in
        END
      END
    `,
    {},
    MOCK,
  );

  const exit = findEvent(result.history, "location.exit");
  const enter = findEvent(result.history, "location.enter");
  const move = findEvent(result.history, "location.move");
  expect(!!exit, true);
  expect(exit?.from, "ALICE");
  expect(exit?.origin, "JURY ROOM");
  expect(exit?.destination, "HALLWAY");
  expect(!!enter, true);
  expect(enter?.origin, "JURY ROOM");
  expect(enter?.destination, "HALLWAY");
  expect(!!move, true);
  expect(move?.origin, "JURY ROOM");
  expect(move?.destination, "HALLWAY");

  result = await execStoryTest(
    dedent`
      PERSON: ALICE DO
        location:
          place: JURY ROOM
          rel: in
        space:
          pos: [2, 3, 0]
          angle: 90
        render:
          sprite: alice_idle.png
          light: 0.25
      END

      WITH: ALICE DO
        STATE: DO
          space:
            angle: 180
            scale: [1.1, 1.1, 1.1]
          render:
            sprite: alice_tense.png
        END
      END

      SET: alice {{entity("ALICE")}}
      SET: view {{pov("ALICE")}}
    `,
    {},
    MOCK,
  );

  expectHas(result.entities.ALICE.stats.space, {
    pos: [2, 3, 0],
    angle: 180,
    scale: [1.1, 1.1, 1.1],
  });
  expectHas(result.entities.ALICE.stats.render, {
    sprite: "alice_tense.png",
    light: 0.25,
  });
  expectHas(result.state.alice as Record<string, unknown>, {
    space: {
      pos: [2, 3, 0],
      angle: 180,
      scale: [1.1, 1.1, 1.1],
    },
    render: {
      sprite: "alice_tense.png",
      light: 0.25,
    },
  });
  expectHas((result.state.view as Record<string, unknown>).you as Record<string, unknown>, {
    space: {
      pos: [2, 3, 0],
      angle: 180,
      scale: [1.1, 1.1, 1.1],
    },
    render: {
      sprite: "alice_tense.png",
      light: 0.25,
    },
  });
}

test();
