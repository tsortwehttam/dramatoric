import { extractEmbeddedPrompt, extractEmbeddedSegments } from "../eng/Helpers";
import { expect } from "./TestUtils";

async function test() {
  // extractEmbeddedSegments: pure text (no <<>>)
  const s1 = extractEmbeddedSegments("Hello world");
  expect(s1, [{ kind: "text", value: "Hello world" }]);
  console.info("[test] segments: pure text");

  // extractEmbeddedSegments: pure prompt
  const s2 = extractEmbeddedSegments("<<Be angry>>");
  expect(s2, [{ kind: "prompt", value: "Be angry", params: {} }]);
  console.info("[test] segments: pure prompt");

  // extractEmbeddedSegments: text before prompt
  const s3 = extractEmbeddedSegments("Hey you! <<angry command>>");
  expect(s3, [
    { kind: "text", value: "Hey you!" },
    { kind: "prompt", value: "angry command", params: {} },
  ]);
  console.info("[test] segments: text before prompt");

  // extractEmbeddedSegments: text after prompt
  const s4 = extractEmbeddedSegments("<<angry command>> Show me ID!");
  expect(s4, [
    { kind: "prompt", value: "angry command", params: {} },
    { kind: "text", value: "Show me ID!" },
  ]);
  console.info("[test] segments: text after prompt");

  // extractEmbeddedSegments: text-prompt-text (the splicing case)
  const s5 = extractEmbeddedSegments("Hey you! <<angry command>> Show me ID!");
  expect(s5, [
    { kind: "text", value: "Hey you!" },
    { kind: "prompt", value: "angry command", params: {} },
    { kind: "text", value: "Show me ID!" },
  ]);
  console.info("[test] segments: text-prompt-text");

  // extractEmbeddedSegments: multiple prompts
  const s6 = extractEmbeddedSegments("Hello <<greet>> middle <<farewell>> bye");
  expect(s6, [
    { kind: "text", value: "Hello" },
    { kind: "prompt", value: "greet", params: {} },
    { kind: "text", value: "middle" },
    { kind: "prompt", value: "farewell", params: {} },
    { kind: "text", value: "bye" },
  ]);
  console.info("[test] segments: multiple prompts interspersed");

  // extractEmbeddedSegments: empty string
  const s7 = extractEmbeddedSegments("");
  expect(s7, []);
  console.info("[test] segments: empty string");

  // extractEmbeddedSegments: whitespace-only prompt trimmed away
  const s8 = extractEmbeddedSegments("<<  >>");
  expect(s8, []);
  console.info("[test] segments: whitespace-only prompt");

  // extractEmbeddedSegments: multiline prompt
  const s9 = extractEmbeddedSegments("<<line one\nline two>>");
  expect(s9, [{ kind: "prompt", value: "line one\nline two", params: {} }]);
  console.info("[test] segments: multiline prompt");

  const s9b = extractEmbeddedSegments("<<Hello {{ name }}>>");
  expect(s9b, [{ kind: "prompt", value: "Hello {{ name }}", params: {} }]);
  console.info("[test] segments: prompt preserves nested handlebars");

  const s9c = extractEmbeddedSegments("<<Mention the player's greeting and answer warmly.>>");
  expect(s9c, [{ kind: "prompt", value: "Mention the player's greeting and answer warmly.", params: {} }]);
  console.info("[test] segments: prompt preserves apostrophes");

  // extractEmbeddedSegments: unclosed << treated as text
  const s10 = extractEmbeddedSegments("Hello << unclosed");
  expect(s10, [{ kind: "text", value: "Hello << unclosed" }]);
  console.info("[test] segments: unclosed << treated as text");

  // extractEmbeddedPrompt backward compat: pure text
  const ep1 = extractEmbeddedPrompt("Hello world");
  expect(ep1.prompt, "");
  expect(ep1.remainder, "Hello world");
  console.info("[test] extractEmbeddedPrompt: pure text");

  // extractEmbeddedPrompt backward compat: pure prompt
  const ep2 = extractEmbeddedPrompt("<<Be angry>>");
  expect(ep2.prompt, "Be angry");
  expect(ep2.remainder, "");
  console.info("[test] extractEmbeddedPrompt: pure prompt");

  // extractEmbeddedPrompt backward compat: mixed
  const ep3 = extractEmbeddedPrompt("Hey <<cmd1>> middle <<cmd2>> bye");
  expect(ep3.prompt, "cmd1\ncmd2");
  expect(ep3.remainder, "Hey middle bye");
  console.info("[test] extractEmbeddedPrompt: mixed content");

  console.info("[test] All inline LLM tests passed");
}

test().catch(console.error);
