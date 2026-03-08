import { compileCartridge, serializeSources } from "../eng/Compiler";
import { expect } from "./TestUtils";

async function test() {
  // Basic narrator with text
  const r1 = await compileCartridge({
    "main.dramatoric": Buffer.from(`
NARRATOR:
Hello world.
`),
  });
  const s1 = serializeSources(r1);
  expect(s1.includes("NARRATOR:"), true);
  expect(s1.includes("Hello world."), true);

  // With SET and IF block
  const r2 = await compileCartridge({
    "main.dramatoric": Buffer.from(`
SET: foo 2

IF: foo > 1 DO
  NARRATOR:
  The value is greater than one.
END
`),
  });
  const s2 = serializeSources(r2);
  expect(s2.includes("SET: foo 2"), true);
  expect(s2.includes("IF: foo > 1 DO"), true);
  expect(s2.includes("END"), true);

  // With variable assignment
  const r3 = await compileCartridge({
    "main.dramatoric": Buffer.from(`
result = CAPTURE:
What is your name?
`),
  });
  const s3 = serializeSources(r3);
  expect(s3.includes("result = CAPTURE:"), true);

  // With YAML frontmatter
  const r4 = await compileCartridge({
    "main.dramatoric": Buffer.from(`---
title: My Story
author: Test Author
---

NARRATOR:
Once upon a time.
`),
  });
  const s4 = serializeSources(r4);
  expect(s4.includes("---"), true);
  expect(s4.includes("title: My Story"), true);
  expect(s4.includes("author: Test Author"), true);

  // Round-trip: compile -> serialize -> compile should produce equivalent structure
  const original = `
SET: count 0

NARRATOR:
Welcome to the story.

IF: count == 0 DO
  NARRATOR:
  This is the beginning.
END
`;
  const c1 = await compileCartridge({ "main.dramatoric": Buffer.from(original) });
  const serialized = serializeSources(c1);
  const c2 = await compileCartridge({ "main.dramatoric": Buffer.from(serialized) });

  expect(c1.root.kids.length, c2.root.kids.length);

  // Multiple voices
  const r5 = await compileCartridge({
    "main.dramatoric": Buffer.from(`
ALICE:
Hello Bob!

BOB:
Hello Alice!
`),
  });
  const s5 = serializeSources(r5);
  expect(s5.includes("ALICE:"), true);
  expect(s5.includes("BOB:"), true);

  // Nested blocks
  const r6 = await compileCartridge({
    "main.dramatoric": Buffer.from(`
IF: true DO
  IF: false DO
    NARRATOR:
    Deeply nested.
  END
END
`),
  });
  const s6 = serializeSources(r6);
  expect(s6.includes("IF: true DO"), true);
  expect(s6.includes("IF: false DO"), true);
  expect((s6.match(/END/g) || []).length, 2);

  // With eave content
  const r7 = await compileCartridge({
    "main.dramatoric": Buffer.from(`
IF: x > 0 DO |some eave|
  LOG: hello
END
`),
  });
  const s7 = serializeSources(r7);
  expect(s7.includes("|some eave|"), true);

  console.info("[serialize] All tests passed!");
}

test();
