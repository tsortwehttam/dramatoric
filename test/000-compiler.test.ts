import { compileCartridge } from "../eng/Compiler";
import { ErrorBase } from "../lib/CoreTypings";
import { expect } from "./TestUtils";

function opErrors(errors: ErrorBase[]) {
  return errors.filter((e) => e.type === "op-undefined");
}

function varErrors(errors: ErrorBase[]) {
  return errors.filter((e) => e.type === "var-undefined");
}

function warningErrors(errors: ErrorBase[]) {
  return errors.filter((e) => e.type === "warning-implicit-body-stanza");
}

async function test() {
  // Valid: no script expressions, just simple args
  const r1 = await compileCartridge({
    "main.dram": Buffer.from(`
SET: foo 2
NARRATOR:
Hello world.
`),
  });
  expect(opErrors(r1.errs), []);

  // Valid: script expression with built-in operators (using literals only)
  const r2 = await compileCartridge({
    "main.dram": Buffer.from(`
SET: foo 2 + 3
SET: bar 10 > 5
`),
  });
  expect(opErrors(r2.errs), []);

  // Valid: script expression with stdlib function (using literals)
  const r3 = await compileCartridge({
    "main.dram": Buffer.from(`
SET: len arrayLength([1, 2, 3])
IF: arrayLength([1, 2]) > 0 DO
  LOG: has items
END
`),
  });
  expect(opErrors(r3.errs), []);

  // Valid: multiple stdlib functions with literals
  const r4 = await compileCartridge({
    "main.dram": Buffer.from(`
SET: result arrayJoin([1, 2, 3], ", ")
SET: check stringLength("hello") > 0 && arrayContains([1, 2], 1)
`),
  });
  expect(opErrors(r4.errs), []);

  // Invalid: unknown function in expression
  const r5 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: unknownFunc(5) > 0 DO
  LOG: yes
END
`),
  });
  const ops5 = opErrors(r5.errs);
  expect(ops5.length, 1);
  expect(ops5[0].type, "op-undefined");
  expect(ops5[0].name, "unknownFunc");

  // Invalid: multiple unknown functions (expression starts with function call)
  const r6 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: badFunc(1) + anotherBadFunc(2) > 0 DO
  LOG: yes
END
`),
  });
  const ops6 = opErrors(r6.errs);
  expect(ops6.length, 2);
  expect(ops6[0].name, "badFunc");
  expect(ops6[1].name, "anotherBadFunc");

  // Invalid: nested unknown function inside valid function
  const r7 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: arrayLength(fakeMethod([1, 2])) > 0 DO
  LOG: yes
END
`),
  });
  const ops7 = opErrors(r7.errs);
  expect(ops7.length, 1);
  expect(ops7[0].name, "fakeMethod");

  // Valid: math functions from stdlib (use expression form)
  const r8 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: calcAbs(-5) + calcMax(1, 2, 3) > 0 DO
  LOG: yes
END
`),
  });
  expect(opErrors(r8.errs), []);

  // Mix of valid and invalid functions
  const r9 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: arrayLength([1]) > 0 DO
  LOG: yes
END
IF: notARealFunction(5) > 0 DO
  LOG: yes
END
IF: calcMin(1, 2) > 0 DO
  LOG: yes
END
`),
  });
  const ops9 = opErrors(r9.errs);
  expect(ops9.length, 1);
  expect(ops9[0].name, "notARealFunction");

  // Valid: string functions (use expression form)
  const r10 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: strIncludes("hello world", "world") DO
  LOG: yes
END
`),
  });
  expect(opErrors(r10.errs), []);

  // Non-expression args should not trigger validation
  const r11 = await compileCartridge({
    "main.dram": Buffer.from(`
GOTO: Some Scene Name
SCENE: Another Scene DO
  LOG: hello
END
`),
  });
  expect(opErrors(r11.errs), []);

  // Valid: ternary with literals (starts with paren to look like expression)
  const r12 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: (true ? arrayLength([1, 2]) : 0) > 0 DO
  LOG: yes
END
`),
  });
  expect(opErrors(r12.errs), []);

  // Invalid: unknown function in ternary
  const r13 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: (true ? badTernaryFunc(1) : 0) > 0 DO
  LOG: yes
END
`),
  });
  const ops13 = opErrors(r13.errs);
  expect(ops13.length, 1);
  expect(ops13[0].name, "badTernaryFunc");

  // Vars with falsey values should still count as defined
  const r14 = await compileCartridge({
    "main.dram": Buffer.from(`
SET: ready false; retries 0; note null
IF: ready == false && retries == 0 && note == null DO
  LOG: ok
END
`),
  });
  expect(varErrors(r14.errs), []);

  // Capture-assigned var should satisfy dot-path access checks
  const r15 = await compileCartridge({
    "main.dram": Buffer.from(`
decision = CAPTURE:
Pick "yes" or "no"
IF: decision.result == "yes" DO
  LOG: yep
END
`),
  });
  expect(varErrors(r15.errs), []);

  const r15b = await compileCartridge({
    "main.dram": Buffer.from(`
note = VAR: hello there
IF: stringLength(note) > 0 DO
  LOG: yep
END
`),
  });
  expect(varErrors(r15b.errs), []);

  // Magic event vars should be considered known at compile time
  const r16 = await compileCartridge({
    "main.dram": Buffer.from(`
ON: $input DO
  IF: strTrim($input.value) == "hi" DO
    LOG: hello
  END
END
`),
  });
  expect(varErrors(r16.errs), []);

  // Truly missing vars should still be flagged
  const r17 = await compileCartridge({
    "main.dram": Buffer.from(`
IF: totallyMissingVar > 0 DO
  LOG: no
END
`),
  });
  const vars17 = varErrors(r17.errs);
  expect(vars17.length, 1);
  expect(vars17[0].name, "totallyMissingVar");

  const r18 = await compileCartridge({
    "main.dram": Buffer.from(`
SET: who "Frank"
note = VAR: {{who}}
`),
  });
  const warnings18 = warningErrors(r18.errs);
  expect(warnings18.length, 1);
  expect(warnings18[0].name, "SET");
}

test();
