import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

const MOCK = true;

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
  expect(result.entities.RATZ.persona, "You are Ratz, a bartender.");
  expect(result.entities.RATZ.stats, {});

  // ENTITY with structured YAML data (persona field + stats)
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD DO
        health: 50
        mood: stern
        persona: You are a stern palace guard.
      END
    `,
    {},
    MOCK
  );
  expect(!!result.entities.GUARD, true);
  expect(result.entities.GUARD.persona, "You are a stern palace guard.");
  expect(result.entities.GUARD.stats, { health: 50, mood: "stern" });

  result = await execStoryTest(
    dedent`
      ENTITY: ALICE DO
        kind: person
        public:
          mood: guarded
        private:
          goal: get home
        location:
          place: JURY_ROOM
          rel: in
        persona: You are Alice.
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
        public:
          mood: guarded
        persona: You are Alice.
      END

      PLACE: JURY_ROOM DO
        public:
          lighting: harsh
      END

      THING: FILE DO
        public:
          status: sealed
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
        persona: You are Alice.
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
  expect(result.entities.RATZ.persona, "You are Ratz, a bartender.");

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
  expect(result.entities.RATZ.persona, "You are Ratz, a wounded bartender.");

  result = await execStoryTest(
    dedent`
      ENTITY: ALICE DO
        kind: person
        public:
          mood: guarded
          stance: seated
        private:
          goal: get home
        location:
          place: JURY_ROOM
          rel: in
        persona: You are Alice.
      END

      ENTITY: ALICE DO
        public:
          mood: open
        private:
          belief: maybe innocent
        location:
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
        location:
          place: PLACE_A
        public:
          mood: calm
        private:
          secret: hidden
        persona: You are Alice.
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
    persona: "You are Alice.",
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
  expect(result.entities.RATZ.persona, "");

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
        {"health": 80, "persona": "You are a robot.", "armor": 5}
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.BOT.persona, "You are a robot.");
  expect(result.entities.BOT.stats, { health: 80, armor: 5 });

  // ENTITY with alternative persona key names
  result = await execStoryTest(
    dedent`
      ENTITY: WIZARD DO
        modus: You are a wise old wizard.
        power: 99
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.WIZARD.persona, "You are a wise old wizard.");
  expect(result.entities.WIZARD.stats, { power: 99 });

  result = await execStoryTest(
    dedent`
      ENTITY: ELF DO
        description: You are an elegant elf archer.
        dexterity: 18
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.ELF.persona, "You are an elegant elf archer.");
  expect(result.entities.ELF.stats, { dexterity: 18 });

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
  expect(result.entities.RATZ.persona, "You are Ratz, the bartender at The Chatsubo.");

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
  expect(result.entities.ALICE.persona, "You are Alice, a gentle healer.");
  expect(result.entities.BOB.persona, "You are Bob, a fierce warrior.");
}

test();
