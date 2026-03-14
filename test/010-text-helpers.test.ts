import { autoFindVoiceId } from "../lib/ElevenLabsUtils";
import { ELEVENLABS_PRESET_VOICES } from "../lib/ElevenLabsVoices";
import { castToTypeEnhanced } from "../lib/EvalCasting";
import { parseFieldGroups, parseFieldGroupsNested } from "../lib/InputHelpers";
import { parseNumberOrNull } from "../lib/MathHelpers";
import {
  extractNetworkDomainFromSSTString,
  generatePredictableKey,
  isBlank,
  parameterize,
  sha1,
  slugify,
} from "../lib/TextHelpers";
import { camelCase, filterConversationEvents } from "../lib/ValueHelpers";
import { expect } from "./TestUtils";

async function test() {
  // // Find preset voices
  expect(
    autoFindVoiceId(
      {
        name: "",
        tags: ["male", "deep", "american"],
      },
      ELEVENLABS_PRESET_VOICES
    ),
    "pNInz6obpgDQGcFmaJgB"
  );
  expect(
    autoFindVoiceId(
      {
        name: "",
        tags: ["female", "young", "calm"],
      },
      ELEVENLABS_PRESET_VOICES
    ),
    "LcfcDJNUP1GQjkzn1xUU"
  );
  expect(
    autoFindVoiceId(
      {
        name: "",
        tags: ["nonexistent", "tags"],
      },
      ELEVENLABS_PRESET_VOICES
    ),
    "pNInz6obpgDQGcFmaJgB"
  );

  // TextHelpers tests
  expect(sha1("hello"), "aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d");
  expect(slugify("Hello World! @#$"), "Hello_World_");
  expect(slugify("test spaces", "-"), "test-spaces");
  expect(parameterize("Hello-World_123!"), "Hello_World_123_");
  expect(isBlank(""), true);
  expect(isBlank("  "), true);
  expect(isBlank("content"), false);
  expect(isBlank([]), true);
  expect(isBlank(["item"]), false);
  expect(isBlank({}), true);
  expect(isBlank({ key: "value" }), false);
  expect(generatePredictableKey("test", "hello world", "txt"), "test/hello_world-2aae6c35.txt");

  // MathHelpers tests
  expect(parseNumberOrNull("42"), 42);
  expect(parseNumberOrNull("3.14"), 3.14);
  expect(parseNumberOrNull("invalid"), null);
  expect(parseNumberOrNull(""), 0);
  expect(parseNumberOrNull("  123  "), 123);

  // castToTypeEnhanced
  expect(castToTypeEnhanced("123", "number"), 123);
  expect(castToTypeEnhanced(42, "string"), "42");
  expect(castToTypeEnhanced("true", "boolean"), true);
  expect(castToTypeEnhanced("WARRIOR", "warrior|mage|rogue"), "warrior");
  expect(castToTypeEnhanced("war", "warrior|mage|rogue"), "warrior");
  expect(castToTypeEnhanced("paladin", "warrior|mage|rogue"), null);
  expect(castToTypeEnhanced(["1", "2"], "number[]"), [1, 2]);
  expect(castToTypeEnhanced("1", "number[]"), [1]);

  // String transform
  expect(camelCase("foo-bar"), "fooBar");
  expect(camelCase("foo_bar"), "fooBar");
  expect(camelCase("FOO_BAR"), "fooBar");

  const f1 = parseFieldGroups({
    baba: "asdf",
    "foo.bar": "1",
  });
  expect(f1, { foo: { bar: "1" } });
  const f2 = parseFieldGroupsNested({
    baba: "asdf",
    "foo.bar": "1",
    "foo.bar.baz.bux": "222",
  });
  expect(f2, { baba: "asdf", foo: { bar: { baz: { bux: "222" } } } });

  const sst = `
    The module 'react-dom' was not found. Next.js requires that you include it in 'dependencies' of your 'package.json'. To add it, run 'npm install react-dom'
      ▲ Next.js 15.5.4
      - Local:        http://localhost:3000
      - Network:      http://10.32.1.12:3000
      - Experiments (use with caution):
        ✓ externalDir
  `;
  const n1 = extractNetworkDomainFromSSTString(sst);
  expect(n1, "10.32.1.12:3000");

  // filterConversationEvents
  const events = [
    { from: "FRANK", to: ["JIM"], value: "Hey Jim!" },
    { from: "JIM", to: ["FRANK"], value: "Hey Frank!" },
    { from: "FRANK", to: [], value: "Hello everyone!" },
    { from: "SALLY", to: ["BOB"], value: "Hi Bob!" },
    { from: "BOB", to: ["SALLY", "FRANK"], value: "Hi all!" },
  ];
  const frankJim = filterConversationEvents(events, ["FRANK", "JIM"]);
  expect(frankJim.length, 4);
  expect(frankJim[0].value, "Hey Jim!");
  expect(frankJim[1].value, "Hey Frank!");
  expect(frankJim[2].value, "Hello everyone!");
  expect(frankJim[3].value, "Hi all!");

  const sallyBob = filterConversationEvents(events, ["SALLY", "BOB"]);
  expect(sallyBob.length, 3);

  const allEmpty = filterConversationEvents(events, []);
  expect(allEmpty.length, 5);

  const frankOnly = filterConversationEvents(events, ["FRANK"]);
  expect(frankOnly.length, 3);
  expect(frankOnly[0].value, "Hey Frank!");
  expect(frankOnly[1].value, "Hello everyone!");
  expect(frankOnly[2].value, "Hi all!");
}

test();
