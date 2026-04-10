import path from "path";
import { fileURLToPath } from "url";
import { execStoryTestWithLlm, loadCartridge } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = path.resolve(DIR, "..", "fic", "world-state");

async function test() {
  const cartridge = loadCartridge(EXAMPLE_DIR);
  const result = await execStoryTestWithLlm(cartridge, {}, (instructions) => {
    expect(instructions[0]?.role, "system");
    expect(instructions[1]?.role, "user");
    const text = instructions.map((item) => item.content).join("\n");
    expect(text.includes("Respond in character as ALICE."), true);
    expect(text.includes('"actions" is an array of in-world actions'), true);
    expect(text.includes("Keep Alice concise and conciliatory."), true);
    expect(text.includes("Bob is no longer in view, which gives Alice a little room to soften."), true);
    expect(text.includes("Alice is trying to lower the temperature rather than win the argument."), true);
    expect(text.includes("you:"), true);
    expect(text.includes("people:"), true);
    expect(text.includes("events:"), true);
    return {
      state: {},
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
    };
  });

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
