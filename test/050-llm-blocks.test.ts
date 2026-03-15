import { tokenize } from "../eng/Lexer";
import { expect } from "./TestUtils";

async function test() {
  // TPL token: <<...>> is now a single token
  const tokens1 = tokenize("<<hello>>");
  expect(tokens1.length, 1);
  expect(tokens1[0].type, "TPL");
  expect(tokens1[0].value, "<<hello>>");
  console.info("[test] ✅ <<...>> tokenizes as single TPL token");

  // TPL token: {{...}} is also a single token
  const tokens2 = tokenize("{{foo.bar}}");
  expect(tokens2.length, 1);
  expect(tokens2[0].type, "TPL");
  expect(tokens2[0].value, "{{foo.bar}}");
  console.info("[test] ✅ {{...}} tokenizes as single TPL token");

  // TPL with surrounding content
  const tokens3 = tokenize("<<is user happy>> && score > 5");
  expect(tokens3[0].type, "TPL");
  expect(tokens3[0].value, "<<is user happy>>");
  expect(tokens3[2].value, "&"); // space, then &&
  console.info("[test] ✅ TPL tokens work in expressions");

  // Multiple TPL tokens in one expression
  const tokens4 = tokenize("<<get name>> == <<get expected>>");
  const tpls = tokens4.filter((t) => t.type === "TPL");
  expect(tpls.length, 2);
  expect(tpls[0].value, "<<get name>>");
  expect(tpls[1].value, "<<get expected>>");
  console.info("[test] ✅ Multiple TPL tokens in one expression");

  // SET statement pattern
  const tokens5 = tokenize("foo <<generate a random name>>");
  expect(tokens5[0].type, "WRD");
  expect(tokens5[0].value, "foo");
  expect(tokens5[2].type, "TPL");
  expect(tokens5[2].value, "<<generate a random name>>");
  console.info("[test] ✅ TPL tokens work in SET-style expressions");

  // Multiline content in TPL
  const tokens6 = tokenize("<<line one\nline two>>");
  expect(tokens6.length, 1);
  expect(tokens6[0].type, "TPL");
  expect(tokens6[0].value, "<<line one\nline two>>");
  console.info("[test] ✅ TPL tokens preserve multiline content");

  // Mixed TPL types
  const tokens7 = tokenize("{{handlebars}} and <<llm block>>");
  const tpls2 = tokens7.filter((t) => t.type === "TPL");
  expect(tpls2.length, 2);
  expect(tpls2[0].value, "{{handlebars}}");
  expect(tpls2[1].value, "<<llm block>>");
  console.info("[test] ✅ Mixed {{...}} and <<...>> tokens work");

  const tokens8 = tokenize("{{ title {{ role }} }}");
  expect(tokens8.length, 1);
  expect(tokens8[0].type, "TPL");
  expect(tokens8[0].value, "{{ title {{ role }} }}");
  console.info("[test] ✅ Nested {{...}} tokenizes as one TPL token");

  console.info("[test] All TPL token tests passed ✓");
}

test().catch(console.error);
