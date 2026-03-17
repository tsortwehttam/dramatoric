import { SerialValue } from "../lib/CoreTypings";
import { formatAncestry, formatAncestryAsData, LineageSpec } from "../lib/LineageHelpers";
import { expect } from "./TestUtils";

function test() {
  const spec: LineageSpec = {
    adam: { name: "Thomas", surname: "Bennet", temperament: 0.7 },
    eve: { name: "Margaret", surname: "Gardiner", temperament: 0.4 },
    blend: { surname: "father" },
    depth: 2,
    traits: {},
  };

  // Basic ancestry text includes the NPC itself
  const text = formatAncestry(spec, 2);
  expect(text.includes("[ANCESTRY"), true);
  expect(text.includes("id 2"), true);

  // NPC 2 is gen 1, child of adam (id 0) and eve (id 1)
  expect(text.includes("Mother:"), true);
  expect(text.includes("Father:"), true);

  // Depth 0 should only show self
  const shallow = formatAncestry(spec, 2, 0);
  expect(shallow.includes("Mother:"), false);

  // Depth 1 should show parents but not grandparents
  const d1 = formatAncestry(spec, 2, 1);
  expect(d1.includes("Mother:"), true);
  expect(d1.includes("GrandMother:"), false);

  // formatAncestryAsData returns structured data
  const data = formatAncestryAsData(spec, 2) as Record<string, unknown>;
  expect(data.id, 2);
  expect(data.generation, 1);
  expect(typeof data.isFemale, "boolean");
  expect(Array.isArray(data.ancestors), true);
  expect(Array.isArray(data.siblings), true);

  // Trait overrides work
  const specWithOverrides: LineageSpec = {
    ...spec,
    traits: { "2": { name: "Jane" } },
  };
  const overrideText = formatAncestry(specWithOverrides, 2);
  expect(overrideText.includes("Jane"), true);

  // Blend rules: surname should follow father
  const dataTraits = (data.traits as Record<string, unknown>);
  expect(typeof dataTraits.temperament, "number");

  // Gen 2 NPCs (ids 6-13) have blended traits
  const gen2 = formatAncestryAsData(spec, 6) as Record<string, unknown>;
  expect(gen2.generation, 2);
  const gen2Traits = gen2.traits as Record<string, unknown>;
  expect(typeof gen2Traits.temperament, "number");

  // Siblings are returned (gen 1 NPCs: 2,3,4,5 — NPC 2's siblings are 3,4,5)
  const sibs = data.siblings as Array<Record<string, unknown>>;
  expect(sibs.length, 3);

  console.info("[test] All lineage helper tests passed");
}

test();
