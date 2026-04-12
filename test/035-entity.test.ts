import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";
import { castToString } from "../lib/EvalCasting";

const MOCK = true;

function promptLines(result: Awaited<ReturnType<typeof execStoryTest>>, name: string) {
  return result.entities[name].entries
    .filter((item) => item.path === "prompt[]")
    .map((item) => castToString(item.value));
}

async function test() {
  // Basic ENTITY declaration with raw persona text
  let result = await execStoryTest(
    dedent`
      ENTITY: RATZ DO
        You are Ratz, a bartender.
      END
    `,
    {},
    MOCK
  );
  expect(!!result.entities.RATZ, true);
  expect(promptLines(result, "RATZ").join("\n"), "You are Ratz, a bartender.");
  expect(result.entities.RATZ.stats, {});

  // ENTITY with mixed loose body text + structured stats
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD DO
        health: 50
        mood: stern
        You are a stern palace guard.
      END
    `,
    {},
    MOCK
  );
  expect(!!result.entities.GUARD, true);
  expect(promptLines(result, "GUARD").join("\n"), "You are a stern palace guard.");
  expect(result.entities.GUARD.stats, { private: { health: 50, mood: "stern" } });

  result = await execStoryTest(
    dedent`
      ENTITY: ALICE DO
        kind: person
        @mood: guarded
        goal: get home
        place: JURY_ROOM
        rel: in
        You are Alice.
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.ALICE.stats.kind, "person");
  expectHas(result.entities.ALICE.stats.public, { mood: "guarded" });
  expectHas(result.entities.ALICE.stats.private, { goal: "get home" });
  expectHas(result.entities.ALICE.stats.location, { place: "JURY_ROOM", rel: "in" });

  result = await execStoryTest(
    dedent`
      PERSON: ALICE DO
        @mood: guarded
        You are Alice.
      END

      PLACE: JURY_ROOM DO
        @lighting: harsh
      END

      THING: FILE DO
        @status: sealed
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.ALICE.stats.kind, "person");
  expect(result.entities.JURY_ROOM.stats.kind, "place");
  expect(result.entities.FILE.stats.kind, "thing");
  expectHas(result.entities.ALICE.stats.public, { mood: "guarded" });
  expectHas(result.entities.JURY_ROOM.stats.public, { lighting: "harsh" });
  expectHas(result.entities.FILE.stats.public, { status: "sealed" });

  result = await execStoryTest(
    dedent`
      PERSON: ALICE DO
        kind: thing
        You are Alice.
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.ALICE.stats.kind, "thing");

  // ENTITY with inline stats via params
  result = await execStoryTest(
    dedent`
      ENTITY: RATZ; health 100; mood "calm" DO
        You are Ratz, a bartender.
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.RATZ.stats.health, 100);
  expect(result.entities.RATZ.stats.mood, "calm");
  expect(promptLines(result, "RATZ").join("\n"), "You are Ratz, a bartender.");

  // Redeclaring an entity merges stats and updates persona
  result = await execStoryTest(
    dedent`
      ENTITY: RATZ; health 100 DO
        You are Ratz, a bartender.
      END

      ENTITY: RATZ; health 50; wounded true DO
        You are Ratz, a wounded bartender.
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.RATZ.stats.health, 50);
  expect(result.entities.RATZ.stats.wounded, true);
  expect(promptLines(result, "RATZ").join("\n"), "You are Ratz, a wounded bartender.");

  result = await execStoryTest(
    dedent`
      ENTITY: ALICE DO
        kind: person
        @mood: guarded
        @stance: seated
        goal: get home
        place: JURY_ROOM
        rel: in
        You are Alice.
      END

      ENTITY: ALICE DO
        @mood: open
        belief: maybe innocent
        rel: near door
      END
    `,
    {},
    MOCK
  );
  expectHas(result.entities.ALICE.stats.public, { mood: "open", stance: "seated" });
  expectHas(result.entities.ALICE.stats.private, { goal: "get home", belief: "maybe innocent" });
  expectHas(result.entities.ALICE.stats.location, { place: "JURY_ROOM", rel: "near door" });

  // ENTITY exposes stats via stat() function
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD; health 50 DO
        You are a guard.
      END

      SET: guardHealth {{stat("GUARD", "health")}}
    `,
    {},
    MOCK
  );
  expect(result.state.guardHealth, 50);

  // setStat updates entity stats
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD; health 100 DO
        You are a guard.
      END

      SET: _ {{setStat("GUARD", "health", 75)}}
      SET: newHealth {{stat("GUARD", "health")}}
    `,
    {},
    MOCK
  );
  expect(result.state.newHealth, 75);

  result = await execStoryTest(
    dedent`
      ENTITY: GUARD DO
        You are a guard.
      END

      SET: _ {{setStat("GUARD", "public.mood", "alert")}}
      SET: mood {{stat("GUARD", "public.mood")}}
    `,
    {},
    MOCK
  );
  expect(result.state.mood, "alert");
  expectHas(result.entities.GUARD.stats.public, { mood: "alert" });
  expectHas(
    result.entities.GUARD.entries.find((item) => item.path === "public.mood") as Record<string, unknown>,
    { path: "public.mood", value: "alert", public: true, mutable: true },
  );

  // hasEntity function
  result = await execStoryTest(
    dedent`
      ENTITY: RATZ DO
        A bartender.
      END

      SET: hasRatz {{hasEntity("RATZ")}}
      SET: hasBob {{hasEntity("BOB")}}
    `,
    {},
    MOCK
  );
  expect(result.state.hasRatz, true);
  expect(result.state.hasBob, false);

  result = await execStoryTest(
    dedent`
      ENTITY: PLACE_A DO
        kind: place
      END

      ENTITY: ALICE DO
        kind: person
        place: PLACE_A
        @mood: calm
        secret: hidden
        You are Alice.
      END

      SET: alice {{entity("ALICE")}}
      SET: where {{loc("ALICE")}}
    `,
    {},
    MOCK
  );
  expectHas(result.state.alice, {
    name: "ALICE",
    kind: "person",
  });
  expectHas(result.state.where, { place: "PLACE_A" });

  // ENTITY with empty body
  result = await execStoryTest(
    dedent`
      ENTITY: RATZ; health 100
    `,
    {},
    MOCK
  );
  expect(!!result.entities.RATZ, true);
  expect(result.entities.RATZ.stats.health, 100);
  expect(promptLines(result, "RATZ").join("\n"), "");

  // stat() returns 0 for nonexistent entity
  result = await execStoryTest(
    dedent`
      SET: val {{stat("NOBODY", "health")}}
    `,
    {},
    MOCK
  );
  expect(result.state.val, 0);

  // stat() returns 0 for nonexistent key on existing entity
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD; health 50 DO
        A guard.
      END

      SET: val {{stat("GUARD", "mana")}}
    `,
    {},
    MOCK
  );
  expect(result.state.val, 0);

  // ENTITY with JSON body
  result = await execStoryTest(
    dedent`
      ENTITY: BOT DO
        {"health": 80, "armor": 5}
        You are a robot.
      END
    `,
    {},
    MOCK
  );
  expect(promptLines(result, "BOT").join("\n"), "You are a robot.");
  expect(result.entities.BOT.stats, { private: { health: 80, armor: 5 } });

  result = await execStoryTest(
    dedent`
      PERSON: TRIP DO
        @mood: smooth
        drunk: 0
        place: APARTMENT
        rel: in
        pos: [2.2, 4.1, 0]
        angle: 20
        sprite: trip_neutral.png
        You are Trip.
      END
    `,
    {},
    MOCK
  );
  expect(promptLines(result, "TRIP").join("\n"), "You are Trip.");
  expect(result.entities.TRIP.stats.kind, "person");
  expectHas(result.entities.TRIP.stats.public, { mood: "smooth" });
  expectHas(result.entities.TRIP.stats.private, { drunk: 0 });
  expectHas(result.entities.TRIP.stats.location, { place: "APARTMENT", rel: "in" });
  expectHas(result.entities.TRIP.stats.space, { pos: [2.2, 4.1, 0], angle: 20 });
  expectHas(result.entities.TRIP.stats.render, { sprite: "trip_neutral.png" });

  // ENTITY with interpolation in body
  result = await execStoryTest(
    dedent`
      SET: barName "The Chatsubo"

      ENTITY: RATZ DO
        You are Ratz, the bartender at {{barName}}.
      END
    `,
    {},
    MOCK
  );
  expect(promptLines(result, "RATZ").join("\n"), "You are Ratz, the bartender at The Chatsubo.");

  // Multiple entities
  result = await execStoryTest(
    dedent`
      ENTITY: ALICE; role "healer" DO
        You are Alice, a gentle healer.
      END

      ENTITY: BOB; role "warrior" DO
        You are Bob, a fierce warrior.
      END

      SET: aliceRole {{stat("ALICE", "role")}}
      SET: bobRole {{stat("BOB", "role")}}
    `,
    {},
    MOCK
  );
  expect(result.state.aliceRole, "healer");
  expect(result.state.bobRole, "warrior");
  expect(promptLines(result, "ALICE").join("\n"), "You are Alice, a gentle healer.");
  expect(promptLines(result, "BOB").join("\n"), "You are Bob, a fierce warrior.");
}

test();
