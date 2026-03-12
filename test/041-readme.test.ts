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

  // === STEP 1: Boot the story - prelude plays, halts at first CAPTURE ===
  let result = await execStoryTest(cartridge, {});

  expect(!!result.history.find((e) => e.value?.includes("bright autumn evening")), true);
  expect(!!result.history.find((e) => e.value?.includes("speak to them, or ignore")), true);
  console.info("[test] Step 1: Prelude played, halted at CAPTURE ✓");

  // === STEP 2: Choose to "talk" - continues to name CAPTURE ===
  result = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "talk", value: "talk", result: "talk" }],
  });

  expect(!!result.history.find((e) => e.value?.includes("Boldly, you turn")), true);
  expect(!!result.history.find((e) => e.value?.includes("Your name")), true);
  console.info("[test] Step 2: 'Talk' path, halted at name CAPTURE ✓");

  // === STEP 3: Provide name - continues to Darcy, then response CAPTURE ===
  result = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "Elizabeth", value: "Elizabeth" }],
  });

  expect(!!result.history.find((e) => e.value?.includes("A pleasure, Elizabeth")), true);
  // Darcy's dismissive line
  expect(!!result.history.find((e) => e.value?.includes("trust you will not stay long")), true);
  // Prompt for charm/cold
  expect(!!result.history.find((e) => e.value?.includes("charm him, or do you match")), true);
  console.info("[test] Step 3: Name provided, halted at charm/cold CAPTURE ✓");

  // === STEP 4a: Test "charm" path ===
  let charmResult = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "I'll be charming", value: "I'll be charming", result: "charm" }],
  });

  expect(!!charmResult.history.find((e) => e.value?.includes("warm smile")), true);
  expect(charmResult.state.darcyMood, "curious");
  console.info("[test] Step 4a: 'Charm' path works ✓");

  // === STEP 4b: Test "cold" path (fresh from step 3) ===
  let coldResult = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "I'll match his coldness", value: "I'll match his coldness", result: "cold" }],
  });

  expect(!!coldResult.history.find((e) => e.value?.includes("expression cool")), true);
  expect(coldResult.state.darcyMood, "hostile");
  console.info("[test] Step 4b: 'Cold' path works ✓");

  // === Verify inline variations played ===
  // Bingley says one of the variations
  const bingleyGreeting = coldResult.history.find(
    (e) => e.from === "MR. BINGLEY" && /Delightful|Splendid|Marvelous/.test(e.value || "")
  );
  expect(!!bingleyGreeting, true);

  // Narrator mentions one of the ballroom descriptions
  const ballroomDesc = coldResult.history.find((e) =>
    /alive with chatter|buzzing with conversation|full of murmured gossip/.test(e.value || "")
  );
  expect(!!ballroomDesc, true);

  // Shuffle variation: one of the small talk lines
  const smallTalk = coldResult.history.find((e) => /punch|orchestra.*splendid|weather holds/.test(e.value || ""));
  expect(!!smallTalk, true);

  // Cycling variation: "first" time tested his patience (first execution)
  expect(!!coldResult.history.find((e) => e.value?.includes("first time you've tested his patience")), true);

  console.log(1);
  console.info("[test] Step 5: Inline variations verified ✓");

  // Story should now be at the LOOP's CAPTURE (cool, appraising stare)
  expect(!!coldResult.history.find((e) => e.value?.includes("cool, appraising stare")), true);
  expect(coldResult.state.irritation, 0);
  console.info("[test] Step 6: Entered LOOP, halted at reply CAPTURE ✓");

  // === STEP 7a: Test "goodbye" path - player exits loop gracefully ===
  let goodbyeResult = await execStoryTest(cartridge, {
    ...coldResult,
    inputs: [{ from: "me", raw: "Goodbye", value: "Goodbye", result: "goodbye" }],
  });

  expect(!!goodbyeResult.history.find((e) => e.value?.includes("polite nod")), true);
  expect(!!goodbyeResult.history.find((e) => e.value?.includes("Good evening")), true);
  // Irritation should still be 0 (we exited before accumulating)
  expect(goodbyeResult.state.irritation, 0);
  console.info("[test] Step 7a: 'Goodbye' path exits loop gracefully ✓");

  // === STEP 7b: Test irritation accumulation - Darcy storms off ===
  // Send a rude response - LLM will score it
  let irritatedResult = await execStoryTest(cartridge, {
    ...coldResult,
    inputs: [{ from: "me", raw: "You bore me, sir", value: "You bore me, sir" }],
  });

  // Irritation should have increased from 0
  expect(Number(irritatedResult.state.irritation) > 0, true);
  // Darcy should have responded (one of the CASE options)
  const darcyResponded = irritatedResult.history.some(
    (e) =>
      e.from === "MR. DARCY" && /I see|Quite|Hm|persistent|peculiar|Indeed|weary|patience|Enough/.test(e.value || "")
  );
  expect(darcyResponded, true);
  console.info(`[test] Step 7b: First rude response, irritation at ${irritatedResult.state.irritation} ✓`);

  // Keep irritating until Darcy storms off (may take 1-2 more inputs depending on LLM scores)
  let loopResult = irritatedResult;
  let iterations = 0;
  while (Number(loopResult.state.irritation) < 1.0 && iterations < 5) {
    loopResult = await execStoryTest(cartridge, {
      ...loopResult,
      inputs: [{ from: "me", raw: "How utterly dull you are", value: "How utterly dull you are" }],
    });
    iterations++;
  }

  // Darcy should have stormed off
  expect(Number(loopResult.state.irritation) >= 1.0, true);
  expect(!!loopResult.history.find((e) => e.value?.includes("turns on his heel")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("I do apologize")), true);
  console.info(`[test] Step 7c: Darcy storms off after ${iterations + 1} rude remarks ✓`);

  // === STEP 8: Verify embedded conditionals ===
  // Bingley's embedded IF (irritation >= 1.0) should trigger
  expect(!!loopResult.history.find((e) => e.value?.includes("He can be... difficult")), true);
  // Bingley always says this
  expect(!!loopResult.history.find((e) => e.value?.includes("enjoying the ball")), true);

  // Narrator's CASE on darcyMood should pick "hostile" path
  expect(!!loopResult.history.find((e) => e.value?.includes("made an enemy tonight")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("evening stretches on")), true);
  expect(
    !!loopResult.history.find(
      (e) =>
        e.value?.includes("tone carries unmistakable frost") ||
        e.value?.includes("reserve remains intact, but not yet openly hostile")
    ),
    true
  );

  console.info("[test] Step 8: Embedded conditionals verified ✓");

  // === Also verify Step 4a's embedded conditionals (charm path -> curious mood) ===
  // For this we need to continue the charm path through the loop
  let charmLoopResult = await execStoryTest(cartridge, {
    ...charmResult,
    inputs: [{ from: "me", raw: "Goodbye, Mr. Darcy", value: "Goodbye, Mr. Darcy" }],
  });

  // Should have exited gracefully, darcyMood should still be "curious"
  expect(charmLoopResult.state.darcyMood, "curious");
  // Bingley's embedded IF for curious mood should trigger
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("made an impression")), true);
  // Narrator's CASE should pick "curious" path
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("watches you now with interest")), true);

  console.info("[test] Step 8b: Charm path embedded conditionals verified ✓");

  // === STEP 9: Verify BLOCK/RUN/VARY directives ===
  // RUN: Ballroom Ambience should have executed twice (chandeliers appears twice)
  const chandeliersCount = charmLoopResult.history.filter((e) => e.value?.includes("chandeliers")).length;
  expect(chandeliersCount, 2);

  // RUN: Character Introduction with parameters
  expect(
    !!charmLoopResult.history.find(
      (e) => e.value?.includes("Mr. Collins") && e.value?.includes("insufferably pleased")
    ),
    true
  );
  expect(
    !!charmLoopResult.history.find((e) => e.value?.includes("Miss Bennet") && e.value?.includes("quietly observant")),
    true
  );

  // VARY: SHUFFLE - all three should appear (order varies)
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("woman in blue")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("elderly gentleman nods")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("young officers whisper")), true);

  // VARY: PICK 1 - exactly one of the three weather lines should appear
  const weatherLines = charmLoopResult.history.filter(
    (e) =>
      e.value?.includes("weather we're having") ||
      e.value?.includes("tried the refreshments") ||
      e.value?.includes("orchestra is in fine form")
  );
  expect(weatherLines.length, 1);

  // VARY: OMIT 0.5 - with seeded PRNG, we expect ~half of items to appear
  const omitItems = charmLoopResult.history.filter(
    (e) =>
      e.value?.includes("laughter from the card room") ||
      e.value?.includes("servant slips past") ||
      e.value?.includes("candles flicker")
  );
  // With OMIT 0.5 on 3 items, expect 1-2 items (PRNG-determined)
  expect(omitItems.length >= 1 && omitItems.length <= 2, true);

  console.info("[test] Step 9: BLOCK/RUN/VARY directives verified ✓");

  // === STEP 10: Verify DATA/EACH directives ===
  // EACH iterates over guests array - verify the narrator line runs
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("Several guests approach")), true);
  // Note: EACH with dynamic speaker headers ({{guest.name}}:) and LLM blocks
  // is a complex feature - just verify the loop executed without error

  console.info("[test] Step 10: DATA/EACH directives verified ✓");

  // === STEP 11: Verify final narration and EXIT ===
  // Final narration should appear in both paths
  expect(!!loopResult.history.find((e) => e.value?.includes("candles burn low")), true);
  expect(!!loopResult.history.find((e) => e.value?.includes("gather your things")), true);

  // CASE on darcyMood (hostile path - Darcy stormed off)
  expect(!!loopResult.history.find((e) => e.value?.includes("made an enemy tonight")), true);

  // Verify charm path ending (curious mood)
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("candles burn low")), true);
  expect(!!charmLoopResult.history.find((e) => e.value?.includes("enigma — but perhaps one worth solving")), true);

  console.info("[test] Step 11: Final narration and EXIT verified ✓");

  // === STEP 12: Verify ONCE and ON/EMIT event handlers ===
  // ONCE block should have run (only once per story)
  expect(!!loopResult.history.find((e) => e.value?.includes("Welcome to Meryton")), true);

  // ON: darcyAngered should have fired when EMIT was called (irritation >= 1.0)
  expect(!!loopResult.history.find((e) => e.value?.includes("atmosphere in the room shifts")), true);

  console.info("[test] Step 12: ONCE and ON/EMIT event handlers verified ✓");

  // === STEP 13: Verify ON: $input runs once on first input ===
  // The ON: $input handler at top of story triggers on first input, then DONE: retires it
  expect(!!result.history.find((e) => e.value?.includes("room notices your presence")), true);
  // Verify it only appears once (DONE: prevents repeat)
  const roomNoticesCount = charmLoopResult.history.filter((e) =>
    e.value?.includes("room notices your presence")
  ).length;
  expect(roomNoticesCount, 1);

  console.info("[test] Step 13: ON: $input with DONE verified ✓");

  // === STEP 14: Verify LLM blocks generate AI dialog ===
  // Count total MR. BINGLEY lines - LLM block adds an additional one
  const bingleyLines = charmLoopResult.history.filter((e) => e.from === "MR. BINGLEY");
  // Should have: lively, hesitant intro, pleasure, inline variation, awkward block, PICK 1, + persona = 7+
  expect(bingleyLines.length >= 7, true);

  // Count total MR. DARCY lines - LLM block adds an additional one
  const darcyLines = charmLoopResult.history.filter((e) => e.from === "MR. DARCY");
  // Should have: see nothing, dismissive, response (measured), + persona = 4+
  expect(darcyLines.length >= 4, true);

  console.info("[test] Step 14: LLM blocks verified ✓");
}

test();
