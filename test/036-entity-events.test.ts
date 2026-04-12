import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const MOCK = true;

function entityEvents(history: { type: string; from: string; result: unknown }[]) {
  return history.filter((e) => e.type === "$entity");
}

async function test() {
  // ENTITY declaration emits $entity event
  let result = await execStoryTest(
    dedent`
      ENTITY: GUARD; health 50 DO
        You are a stern palace guard.
      END
    `,
    {},
    MOCK,
  );
  let evts = entityEvents(result.history);
  expect(evts.length, 1);
  expect(evts[0].from, "GUARD");
  expect((evts[0].result as Record<string, unknown>).health, 50);

  // setStat emits $entity event
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD; health 100 DO
        You are a guard.
      END

      SET: _ {{setStat("GUARD", "health", 75)}}
    `,
    {},
    MOCK,
  );
  evts = entityEvents(result.history);
  // First from ENTITY declaration, second from setStat
  expect(evts.length, 2);
  expect(evts[1].from, "GUARD");
  expect((evts[1].result as Record<string, unknown>).health, 75);

  // Entity redeclaration emits $entity event with merged stats
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
    MOCK,
  );
  evts = entityEvents(result.history);
  expect(evts.length, 2);
  expect(evts[1].from, "RATZ");
  expect((evts[1].result as Record<string, unknown>).health, 50);
  expect((evts[1].result as Record<string, unknown>).wounded, true);

  // Multiple setStat calls emit separate events
  result = await execStoryTest(
    dedent`
      ENTITY: NPC; x 0; y 0 DO
        An NPC.
      END

      SET: _ {{setStat("NPC", "x", 5)}}
      SET: _ {{setStat("NPC", "y", 3)}}
    `,
    {},
    MOCK,
  );
  evts = entityEvents(result.history);
  // 1 from ENTITY, 2 from setStat calls
  expect(evts.length, 3);
  expect((evts[1].result as Record<string, unknown>).x, 5);
  expect((evts[2].result as Record<string, unknown>).y, 3);
}

test();
