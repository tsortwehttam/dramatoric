import path from "path";
import { fileURLToPath } from "url";
import { execStoryTestWithMockLlm, loadCartridge, MockLlmFixture } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = path.resolve(DIR, "..", "fic", "suburban-house");

async function test() {
  const cartridge = loadCartridge(EXAMPLE_DIR);
  const fixtures: MockLlmFixture[] = [
    {
      name: "frank cue",
      systemIncludes: [
        "Respond in character as FRANK WHITMAN.",
        "Keep Frank brittle, witty, and faintly self-destructive.",
      ],
      userIncludes: [
        "Eleanor is in view, so Frank lets the line land with performative ease.",
        "Julia is out of sight, which makes Frank bolder and lonelier.",
      ],
      schemaIncludes: [],
      reply: {
        state: {},
        actions: [
          {
            type: "say",
            to: ["ELEANOR WHITMAN"],
            body: "Another highball and this evening may yet survive itself.",
          },
        ],
      },
    },
    {
      name: "eleanor cue",
      systemIncludes: [
        "Respond in character as ELEANOR WHITMAN.",
        "Keep Eleanor precise, wounded, and controlled.",
      ],
      userIncludes: [
        "Julia is in front of her, and Eleanor wants control more than comfort.",
      ],
      schemaIncludes: [],
      reply: {
        state: {},
        actions: [
          {
            type: "say",
            to: ["JULIA WHITMAN"],
            body: "If you are going to leave, at least leave the screen door open.",
          },
        ],
      },
    },
  ];
  const result = await execStoryTestWithMockLlm(cartridge, {}, fixtures);

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
