import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const MOCK = true;

async function test() {
  // LINEAGE declaration stores settings in session
  let result = await execStoryTest(
    dedent`
      LINEAGE: Meryton DO
        adam:
          name: Thomas
          surname: Bennet
          temperament: 0.7
        eve:
          name: Margaret
          surname: Gardiner
          temperament: 0.4
        blend:
          surname: father
          temperament: average
      END
    `,
    {},
    MOCK,
  );
  expect(!!result.lineages.Meryton, true);
  expect(result.lineages.Meryton.adam.name, "Thomas");
  expect(result.lineages.Meryton.eve.name, "Margaret");
  expect(result.lineages.Meryton.blend.surname, "father");
  expect(result.lineages.Meryton.depth, 2);

  // LINEAGE with custom depth
  result = await execStoryTest(
    dedent`
      LINEAGE: Meryton; depth 3 DO
        adam:
          name: Thomas
        eve:
          name: Margaret
      END
    `,
    {},
    MOCK,
  );
  expect(result.lineages.Meryton.depth, 3);

  // ENTITY with npc param links to lineage
  result = await execStoryTest(
    dedent`
      LINEAGE: Meryton DO
        adam:
          name: Thomas
          temperament: 0.7
        eve:
          name: Margaret
          temperament: 0.4
        blend:
          temperament: average
      END

      ENTITY: DARCY; npc "Meryton 6" DO
        You are Mr. Darcy, a proud gentleman.
      END
    `,
    {},
    MOCK,
  );
  expect(result.entities.DARCY.lineage, "Meryton");
  expect(result.entities.DARCY.npcId, 6);
  expect(result.entities.DARCY.persona, "You are Mr. Darcy, a proud gentleman.");

  // lineage() function returns structured data
  result = await execStoryTest(
    dedent`
      LINEAGE: Meryton DO
        adam:
          name: Thomas
          temperament: 0.7
        eve:
          name: Margaret
          temperament: 0.4
      END

      ENTITY: DARCY; npc "Meryton 6" DO
        A proud gentleman.
      END

      SET: info lineage("DARCY")
    `,
    {},
    MOCK,
  );
  const info = result.state.info as Record<string, unknown>;
  expect(info.id, 6);
  expect(info.generation, 2);

  // lineage() returns empty string for entity without npc link
  result = await execStoryTest(
    dedent`
      ENTITY: GUARD DO
        A guard.
      END

      SET: val lineage("GUARD")
    `,
    {},
    MOCK,
  );
  expect(result.state.val, "");

  // lineage() returns empty string for nonexistent entity
  result = await execStoryTest(
    dedent`
      SET: val lineage("NOBODY")
    `,
    {},
    MOCK,
  );
  expect(result.state.val, "");

  console.info("[test] All lineage integration tests passed");
}

test();
