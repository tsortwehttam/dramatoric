import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { execStoryTestWithMockLlm, loadCartridge, MockLlmFixture } from "./TestEngineUtils";
import { LLMInstruction } from "../lib/LLMTypes";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const README_DIR = path.resolve(DIR, "..", "fic", "readme");

function readRoleText(instructions: LLMInstruction[], role: "system" | "user") {
  return instructions
    .filter((item) => item.role === role)
    .map((item) => item.content)
    .join("\n");
}

function readLastUserLine(instructions: LLMInstruction[]) {
  const user = readRoleText(instructions, "user");
  const lines = user
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => !!line);
  return lines[lines.length - 1] ?? "";
}

const README_FIXTURES: MockLlmFixture[] = [
  {
    name: "raw input parser",
    systemIncludes: ["Parse player input into semantic events for an interactive fiction engine."],
    userIncludes: ["INPUT:"],
    schemaIncludes: ['"events"'],
    reply: ({ instructions }: { instructions: LLMInstruction[] }) => {
      const user = readRoleText(instructions, "user");
      const match = user.match(/INPUT: ([^\n]+)/);
      const raw = match?.[1] ?? "";
      const lower = raw.toLowerCase();
      const to = lower.includes("darcy") || lower.includes("dull") || lower.includes("bore me") ? ["MR. DARCY"] : [];
      const value = lower.includes("goodbye") ? "Goodbye." : raw;
      return {
        events: [
          {
            act: "dialog",
            to,
            value,
            raw,
          },
        ],
      };
    },
  },
  {
    name: "decision capture",
    systemIncludes: [],
    userIncludes: ['Convert the input into either "talk" or "ignore"'],
    schemaIncludes: ['"result"'],
    reply: ({ instructions }: { instructions: LLMInstruction[] }) => {
      return readLastUserLine(instructions).toLowerCase().includes("talk") ? "talk" : "ignore";
    },
  },
  {
    name: "name capture",
    systemIncludes: [],
    userIncludes: ["Elizabeth"],
    schemaIncludes: ['"result"'],
    reply: "Elizabeth",
  },
  {
    name: "response capture",
    systemIncludes: [],
    userIncludes: ['determine if they are trying to be "charm" or "cold"'],
    schemaIncludes: ['"result"'],
    reply: ({ instructions }: { instructions: LLMInstruction[] }) => {
      return readLastUserLine(instructions).toLowerCase().includes("cold") ? "cold" : "charm";
    },
  },
  {
    name: "irritation capture",
    systemIncludes: [],
    userIncludes: ["score how irritating it would be to him"],
    schemaIncludes: ['"result"'],
    reply: ({ instructions }: { instructions: LLMInstruction[] }) => {
      const lower = readLastUserLine(instructions).toLowerCase();
      if (lower.includes("goodbye")) {
        return "goodbye";
      }
      if (lower.includes("utterly dull")) {
        return "0.9";
      }
      if (lower.includes("bore me")) {
        return "0.55";
      }
      return "0.1";
    },
  },
  {
    name: "conditional hostility",
    systemIncludes: ["You evaluate a story condition for an interactive fiction engine."],
    userIncludes: ["Based on the recent exchange, is Mr. Darcy openly hostile toward the player right now?"],
    schemaIncludes: ['"boolean"'],
    reply: { result: false },
  },
  {
    name: "guest greeting bingley",
    systemIncludes: ["You are writing dialogue for MR. BINGLEY."],
    userIncludes: ["Greet the player briefly."],
    schemaIncludes: [],
    reply: "A pleasure to make your acquaintance. I hope the evening treats you kindly.",
  },
  {
    name: "guest greeting darcy",
    systemIncludes: ["You are writing dialogue for MR. DARCY."],
    userIncludes: ["Greet the player briefly."],
    schemaIncludes: [],
    reply: "Good evening.",
  },
  {
    name: "guest greeting collins",
    systemIncludes: ["You are writing dialogue for MR. COLLINS."],
    userIncludes: ["Greet the player briefly."],
    schemaIncludes: [],
    reply: "Miss Bennet, your presence does the assembly the highest credit, as Lady Catherine herself would surely agree.",
  },
  {
    name: "bingley llm block",
    systemIncludes: ["You are writing dialogue for MR. BINGLEY.", "cheerful and amiable gentleman"],
    userIncludes: [],
    schemaIncludes: [],
    reply: "A fine turnout, isn't it? Splendid dancing as well, wouldn't you agree?",
  },
  {
    name: "darcy llm block",
    systemIncludes: ["You are writing dialogue for MR. DARCY.", "proud and reserved gentleman", "Respond to what the player just said."],
    userIncludes: [],
    schemaIncludes: [],
    reply: ({ instructions }: { instructions: LLMInstruction[] }) => {
      const system = readRoleText(instructions, "system");
      if (system.includes("currently quite irritated")) {
        return "You try my patience.";
      }
      if (system.includes("hint of warmth")) {
        return "This evening has not been the taxing ordeal it initially seemed.";
      }
      return "Quite.";
    },
  },
  {
    name: "collins entity line",
    systemIncludes: ["You are writing dialogue for MR. COLLINS.", "pompous and obsequious clergyman"],
    userIncludes: [],
    schemaIncludes: [],
    reply:
      "You must be the delightful Miss Elizabeth! Lady Catherine de Bourgh would be enchanted by your composure this evening.",
  },
  {
    name: "collins updated entity line",
    systemIncludes: ["You are writing dialogue for MR. COLLINS.", "freshly humiliated after a disastrous introduction"],
    userIncludes: [],
    schemaIncludes: [],
    reply: "Forgive me. I have made a spectacle of myself, and even Lady Catherine would wince at it.",
  },
  {
    name: "collins override line",
    systemIncludes: ["You are writing dialogue for MR. COLLINS."],
    userIncludes: ["Apologize to Mr. Darcy for stepping on his foot. Mention Lady Catherine at least twice."],
    schemaIncludes: [],
    reply:
      "Mr. Darcy, I beg your pardon. Lady Catherine always says a gentleman must mind his footing, and Lady Catherine is never wrong.",
  },
];

async function test() {
  execSync("yarn docs", { stdio: "inherit" });

  const cartridge = loadCartridge(README_DIR);
  const run = (partial: Record<string, unknown>) => execStoryTestWithMockLlm(cartridge, partial, README_FIXTURES);

  let result = await run({});

  expect(!!result.history.find((e) => e.value?.includes("bright autumn evening")), true);
  expect(!!result.history.find((e) => e.value?.includes("speak to them, or ignore")), true);
  console.info("[test] Step 1: Prelude played, halted at CAPTURE ✓");

  result = await run({
    ...result,
    inputs: [{ from: "me", raw: "talk", value: "talk", result: "talk" }],
  });

  expect(!!result.history.find((e) => e.value?.includes("Boldly, you turn")), true);
  expect(!!result.history.find((e) => e.value?.includes("Your name")), true);
  console.info("[test] Step 2: 'Talk' path, halted at name CAPTURE ✓");

  result = await run({
    ...result,
    inputs: [{ from: "me", raw: "Elizabeth", value: "Elizabeth" }],
  });

  expect(!!result.history.find((e) => e.value?.includes("A pleasure, Elizabeth")), true);
  expect(!!result.history.find((e) => e.value?.includes("trust you will not stay long")), true);
  expect(!!result.history.find((e) => e.value?.includes("charm him, or do you match")), true);
  console.info("[test] Step 3: Name provided, halted at charm/cold CAPTURE ✓");

  let charmResult = await run({
    ...result,
    inputs: [{ from: "me", raw: "I'll be charming", value: "I'll be charming", result: "charm" }],
  });

  expect(!!charmResult.history.find((e) => e.value?.includes("warm smile")), true);
  expect(charmResult.state.darcyMood, "curious");
  console.info("[test] Step 4a: 'Charm' path works ✓");

  let coldResult = await run({
    ...result,
    inputs: [{ from: "me", raw: "I'll match his coldness", value: "I'll match his coldness", result: "cold" }],
  });

  expect(!!coldResult.history.find((e) => e.value?.includes("expression cool")), true);
  expect(coldResult.state.darcyMood, "hostile");
  console.info("[test] Step 4b: 'Cold' path works ✓");

  const bingleyGreeting = coldResult.history.find(
    (e) => e.from === "MR. BINGLEY" && /Delightful|Splendid|Marvelous/.test(e.value || ""),
  );
  expect(!!bingleyGreeting, true);

  const ballroomDesc = coldResult.history.find((e) =>
    /alive with chatter|buzzing with conversation|full of murmured gossip/.test(e.value || ""),
  );
  expect(!!ballroomDesc, true);

  const smallTalk = coldResult.history.find((e) => /punch|orchestra.*splendid|weather holds/.test(e.value || ""));
  expect(!!smallTalk, true);

  expect(!!coldResult.history.find((e) => e.value?.includes("first time you've tested his patience")), true);

  console.info("[test] Step 5: Inline variations verified ✓");

  expect(!!coldResult.history.find((e) => e.value?.includes("cool, appraising stare")), true);
  expect(coldResult.state.irritation, 0);
  console.info("[test] Step 6: Entered LOOP, halted at reply CAPTURE ✓");

  let goodbyeResult = await run({
    ...coldResult,
    inputs: [{ from: "me", raw: "Goodbye", value: "Goodbye", result: "goodbye" }],
  });

  expect(!!goodbyeResult.history.find((e) => e.value?.includes("polite nod")), true);
  expect(!!goodbyeResult.history.find((e) => e.value?.includes("Good evening")), true);
  expect(goodbyeResult.state.irritation, 0);
  console.info("[test] Step 7a: 'Goodbye' path exits loop gracefully ✓");

  let irritatedResult = await run({
    ...coldResult,
    inputs: [{ from: "me", raw: "You bore me, sir", value: "You bore me, sir" }],
  });

  expect(Number(irritatedResult.state.irritation) > 0, true);
  const darcyResponded = irritatedResult.history.some(
    (e) =>
      e.from === "MR. DARCY" && /I see|Quite|Hm|persistent|peculiar|Indeed|weary|patience|Enough/.test(e.value || ""),
  );
  expect(darcyResponded, true);
  console.info(`[test] Step 7b: First rude response, irritation at ${irritatedResult.state.irritation} ✓`);

  let loopResult = irritatedResult;
  let iterations = 0;
  while (Number(loopResult.state.irritation) < 1.0 && iterations < 5) {
    loopResult = await run({
      ...loopResult,
      inputs: [{ from: "me", raw: "How utterly dull you are", value: "How utterly dull you are" }],
    });
    iterations++;
  }

  expect(Number(loopResult.state.irritation) >= 1.0, true);
  expect(!!loopResult.history.find((e) => e.value?.includes("turns on his heel")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("I do apologize")), true);
  console.info(`[test] Step 7c: Darcy storms off after ${iterations + 1} rude remarks ✓`);

  expect(!!loopResult.history.find((e) => e.value?.includes("He can be... difficult")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("enjoying the ball")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("made an enemy tonight")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("evening stretches on")), true);
  expect(
    !!loopResult.history.find(
      (e) =>
        e.value?.includes("tone carries unmistakable frost") ||
        e.value?.includes("reserve remains intact, but not yet openly hostile"),
    ),
    true,
  );

  console.info("[test] Step 8: Embedded conditionals verified ✓");

  let charmLoopResult = await run({
    ...charmResult,
    inputs: [{ from: "me", raw: "Goodbye, Mr. Darcy", value: "Goodbye, Mr. Darcy" }],
  });

  expect(charmLoopResult.state.darcyMood, "curious");
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("made an impression")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("watches you now with interest")), true);

  console.info("[test] Step 8b: Charm path embedded conditionals verified ✓");

  const chandeliersCount = charmLoopResult.history.filter((e) => e.value?.includes("chandeliers")).length;
  expect(chandeliersCount, 2);

  expect(
    !!charmLoopResult.history.find(
      (e) => e.value?.includes("Mr. Collins") && e.value?.includes("insufferably pleased"),
    ),
    true,
  );
  expect(
    !!charmLoopResult.history.find((e) => e.value?.includes("Miss Bennet") && e.value?.includes("quietly observant")),
    true,
  );

  expect(!!charmLoopResult.history.find((e) => e.value?.includes("woman in blue")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("elderly gentleman nods")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("young officers whisper")), true);

  const weatherLines = charmLoopResult.history.filter(
    (e) =>
      e.value?.includes("weather we're having") ||
      e.value?.includes("tried the refreshments") ||
      e.value?.includes("orchestra is in fine form"),
  );
  expect(weatherLines.length, 1);

  const omitItems = charmLoopResult.history.filter(
    (e) =>
      e.value?.includes("laughter from the card room") ||
      e.value?.includes("servant slips past") ||
      e.value?.includes("candles flicker"),
  );
  expect(omitItems.length >= 1 && omitItems.length <= 2, true);

  console.info("[test] Step 9: BLOCK/RUN/VARY directives verified ✓");

  expect(!!charmLoopResult.history.find((e) => e.value?.includes("Several guests approach")), true);
  console.info("[test] Step 10: DATA/EACH directives verified ✓");

  expect(!!loopResult.history.find((e) => e.value?.includes("candles burn low")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("gather your things")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("made an enemy tonight")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("candles burn low")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("enigma — but perhaps one worth solving")), true);

  console.info("[test] Step 11: Final narration and EXIT verified ✓");

  expect(!!loopResult.history.find((e) => e.value?.includes("Welcome to Meryton")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("atmosphere in the room shifts")), true);

  console.info("[test] Step 12: ONCE and ON/EMIT event handlers verified ✓");

  expect(!!result.history.find((e) => e.value?.includes("room notices your presence")), true);
  const roomNoticesCount = charmLoopResult.history.filter((e) => e.value?.includes("room notices your presence")).length;
  expect(roomNoticesCount, 1);

  console.info("[test] Step 13: ON: $input with DONE verified ✓");

  const bingleyLines = charmLoopResult.history.filter((e) => e.from === "MR. BINGLEY");
  expect(bingleyLines.length >= 7, true);

  const darcyLines = charmLoopResult.history.filter((e) => e.from === "MR. DARCY");
  expect(darcyLines.length >= 4, true);

  console.info("[test] Step 14: LLM blocks verified ✓");
}

test();
