import path from "path";
import { fileURLToPath } from "url";
import { execStoryTestWithMockLlm, loadCartridge, MockLlmFixture } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = path.resolve(DIR, "..", "fic", "world-state");

async function test() {
  const cartridge = loadCartridge(EXAMPLE_DIR);
  const fixtures: MockLlmFixture[] = [
    {
      name: "alice cue",
      systemIncludes: [
        "Respond in character as ALICE.",
        '"actions" is an array of in-world actions',
        "Keep Alice concise and conciliatory.",
      ],
      userIncludes: [
        "Bob is no longer in view, which gives Alice a little room to soften.",
        "Alice is trying to lower the temperature rather than win the argument.",
        "you:",
        "people:",
        "events:",
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
  const result = await execStoryTestWithMockLlm(cartridge, {}, fixtures);

  expect(!!result.history.find((event) => event.value === "World State Example"), true);
  expect(!!result.history.find((event) => event.value === "Alice departs JURY ROOM."), true);
  expect(!!result.history.find((event) => event.value === "Alice enters HALLWAY."), true);
  expect(!!result.history.find((event) => event.from === "ALICE" && event.value === "Let's slow down."), true);
  expect(!!result.history.find((event) => event.type === "deliberate" && event.from === "ALICE"), true);
  expect(
    !!result.history.find((event) => event.from === "HOST" && event.value.includes("Alice sees 1 other person")),
    true,
  );
  expect(
    !!result.history.find((event) => event.from === "HOST" && event.value === "Simulation yielded back to authored flow after 1 step."),
    true,
  );
  expect(result.entities.ALICE.stats.public, { mood: "open" });
  expect(result.entities.ALICE.stats.location, { place: "HALLWAY", rel: "in" });
}

test();
