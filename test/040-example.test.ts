import path from "path";
import { fileURLToPath } from "url";
import { execStoryTest, loadCartridge } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = path.resolve(DIR, "..", "fic", "example");

async function test() {
  const cartridge = loadCartridge(EXAMPLE_DIR);

  let result = await execStoryTest(cartridge, {
    inputs: [{ from: "me", raw: "" }],
  });
  const welcomeMsg = result.history.find((e) => e.from === "HOST" && e.value?.includes("playing"));
  expect(!!welcomeMsg, true);
  const echoMsg = result.history.find((e) => e.from === "HOST" && e.value?.includes("You said"));
  expect(!!echoMsg, true);

  result = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "Hooray", value: "Hooray" }],
  });
  const hoorayEcho = result.history.find((e) => e.from === "HOST" && e.value === 'You said "Hooray".');
  expect(!!hoorayEcho, true);

  result = await execStoryTest(cartridge, {
    ...result,
    inputs: [{ from: "me", raw: "exit", value: "exit" }],
  });
  const exitEvent = result.history.find((e) => e.type === "$exit");
  expect(!!exitEvent, true);
  const goodbye = result.history.find((e) => e.value === "Goodbye!");
  expect(!!goodbye, true);
}

test();
