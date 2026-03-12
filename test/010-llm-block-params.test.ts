import { extractEmbeddedSegments } from "../eng/Helpers";
import { expect } from "./TestUtils";

function test() {
  // No params — basic prompt
  const s1 = extractEmbeddedSegments("<<You are Jim Bob>>");
  expect(s1.length, 1);
  expect(s1[0].kind, "prompt");
  if (s1[0].kind === "prompt") {
    expect(s1[0].value, "You are Jim Bob");
    expect(s1[0].params, {});
  }

  // Params with single key-value
  const s2 = extractEmbeddedSegments('<<(model "ROLEPLAY") You are Jim Bob>>');
  expect(s2.length, 1);
  if (s2[0].kind === "prompt") {
    expect(s2[0].value, "You are Jim Bob");
    expect(s2[0].params.model, "ROLEPLAY");
  }

  // Params with multiple key-values separated by semicolons
  const s3 = extractEmbeddedSegments('<<(model "MINI"; maxTurns 5) Speak briefly>>');
  expect(s3.length, 1);
  if (s3[0].kind === "prompt") {
    expect(s3[0].value, "Speak briefly");
    expect(s3[0].params.model, "MINI");
    expect(s3[0].params.maxTurns, 5);
  }

  // Mixed text and prompt with params
  const s4 = extractEmbeddedSegments('Hello <<(model "WRITING") generate something>> world');
  expect(s4.length, 3);
  expect(s4[0].kind, "text");
  expect(s4[0].value, "Hello");
  if (s4[1].kind === "prompt") {
    expect(s4[1].value, "generate something");
    expect(s4[1].params.model, "WRITING");
  }
  expect(s4[2].kind, "text");
  expect(s4[2].value, "world");

  // Parentheses in body (not at start) should NOT be treated as params
  const s5 = extractEmbeddedSegments("<<You are (angry) Jim Bob>>");
  expect(s5.length, 1);
  if (s5[0].kind === "prompt") {
    expect(s5[0].value, "You are (angry) Jim Bob");
    expect(s5[0].params, {});
  }

  // Empty params
  const s6 = extractEmbeddedSegments("<<() You are Jim Bob>>");
  expect(s6.length, 1);
  if (s6[0].kind === "prompt") {
    expect(s6[0].value, "You are Jim Bob");
    expect(s6[0].params, {});
  }

  // Boolean param
  const s7 = extractEmbeddedSegments("<<(verbose true) Describe the scene>>");
  expect(s7.length, 1);
  if (s7[0].kind === "prompt") {
    expect(s7[0].value, "Describe the scene");
    expect(s7[0].params.verbose, true);
  }

  console.info("[test] ✅ LLM block params parsing verified");
}

test();
