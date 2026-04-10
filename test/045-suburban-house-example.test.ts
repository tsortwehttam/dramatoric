import path from "path";
import { fileURLToPath } from "url";
import { execStoryTestWithLlm, loadCartridge } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = path.resolve(DIR, "..", "fic", "suburban-house");

async function test() {
  const cartridge = loadCartridge(EXAMPLE_DIR);
  const result = await execStoryTestWithLlm(cartridge, {}, (instructions) => {
    expect(instructions[0]?.role, "system");
    expect(instructions[1]?.role, "user");
    const text = instructions.map((item) => item.content).join("\n");
    if (text.includes("Respond in character as FRANK WHITMAN.")) {
      expect(text.includes("Respond in character as FRANK WHITMAN."), true);
      expect(text.includes("Keep Frank brittle, witty, and faintly self-destructive."), true);
      expect(text.includes("Eleanor is in view, so Frank lets the line land with performative ease."), true);
      expect(text.includes("Julia is out of sight, which makes Frank bolder and lonelier."), true);
      return {
        state: {},
        actions: [
          {
            type: "say",
            to: ["ELEANOR WHITMAN"],
            body: "Another highball and this evening may yet survive itself.",
          },
        ],
      };
    }
    expect(text.includes("Respond in character as ELEANOR WHITMAN."), true);
    expect(text.includes("Keep Eleanor precise, wounded, and controlled."), true);
    expect(text.includes("Julia is in front of her, and Eleanor wants control more than comfort."), true);
    return {
      state: {},
      actions: [
        {
          type: "say",
          to: ["JULIA WHITMAN"],
          body: "If you are going to leave, at least leave the screen door open.",
        },
      ],
    };
  });

  expect(!!result.history.find((event) => event.value === "The Whitman House"), true);
  expect(!!result.history.find((event) => event.value === "Frank leaves the den carrying his fresh drink like a prop."), true);
  expect(!!result.history.find((event) => event.value === "Frank drifts into the living room."), true);
  expect(
    !!result.history.find((event) => event.value === "Eleanor comes through the screen door and finds Julia by the hydrangeas."),
    true,
  );
  expect(
    !!result.history.find(
      (event) =>
        event.from === "FRANK WHITMAN" &&
        event.value === "Another highball and this evening may yet survive itself.",
    ),
    true,
  );
  expect(
    !!result.history.find(
      (event) =>
        event.from === "ELEANOR WHITMAN" &&
        event.value === "If you are going to leave, at least leave the screen door open.",
    ),
    true,
  );
  expect(
    !!result.history.find(
      (event) =>
        event.value === "Frank is left performing to the glass.",
    ),
    true,
  );
  expect(
    !!result.history.find((event) => event.value === "Mother and daughter remain within speaking distance beneath the awning."),
    true,
  );
  expect(result.entities["FRANK WHITMAN"].stats.public, { mood: "strained" });
  expect(result.entities["FRANK WHITMAN"].stats.location, { place: "LIVING ROOM", rel: "in" });
  expect(result.entities["ELEANOR WHITMAN"].stats.public, { mood: "brittle" });
  expect(result.entities["ELEANOR WHITMAN"].stats.location, { place: "PATIO", rel: "by the doors" });
}

test();
