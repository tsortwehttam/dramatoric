import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";
import { execStoryTest, loadCartridge } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const README_DIR = path.resolve(DIR, "..", "fic", "readme");

async function test() {
  execSync("yarn docs", { stdio: "inherit" });

  const cartridge = loadCartridge(README_DIR);

  let result = await execStoryTest(cartridge, {});

  expect(!!result.history.find((e) => e.value?.includes("bright autumn evening")), true);
  expect(!!result.history.find((e) => e.value?.includes("speak to them, or ignore")), true);
  console.info("[test] Step 1: Prelude played, halted at CAPTURE ✓");

  result = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "talk", value: "talk", result: "talk" }],
  });

  expect(!!result.history.find((e) => e.value?.includes("Boldly, you turn")), true);
  expect(!!result.history.find((e) => e.value?.includes("Your name")), true);
  console.info("[test] Step 2: 'Talk' path, halted at name CAPTURE ✓");

  result = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "Elizabeth", value: "Elizabeth" }],
  });

  expect(!!result.history.find((e) => e.value?.includes("A pleasure, Elizabeth")), true);
  expect(!!result.history.find((e) => e.value?.includes("trust you will not stay long")), true);
  expect(!!result.history.find((e) => e.value?.includes("charm him, or do you match")), true);
  console.info("[test] Step 3: Name provided, halted at charm/cold CAPTURE ✓");

  let charmResult = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "I'll be charming", value: "I'll be charming", result: "charm" }],
  });

  expect(!!charmResult.history.find((e) => e.value?.includes("warm smile")), true);
  expect(charmResult.state.darcyMood, "curious");
  console.info("[test] Step 4a: 'Charm' path works ✓");

  let coldResult = await execStoryTest(cartridge, {
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

  let goodbyeResult = await execStoryTest(cartridge, {
    ...coldResult,
    inputs: [{ from: "me", raw: "Goodbye", value: "Goodbye", result: "goodbye" }],
  });

  expect(!!goodbyeResult.history.find((e) => e.value?.includes("polite nod")), true);
  expect(!!goodbyeResult.history.find((e) => e.value?.includes("Good evening")), true);
  expect(goodbyeResult.state.irritation, 0);
  console.info("[test] Step 7a: 'Goodbye' path exits loop gracefully ✓");

  let irritatedResult = await execStoryTest(cartridge, {
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
    loopResult = await execStoryTest(cartridge, {
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

  let charmLoopResult = await execStoryTest(cartridge, {
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
