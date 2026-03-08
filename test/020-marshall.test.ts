import { marshallParams } from "../eng/Helpers";
import { createTestContext } from "./TestEngineUtils";
import { expect } from "./TestUtils";

async function test() {
  const ctx = await createTestContext("", {}, false);

  expect(marshallParams("foo", ctx.evaluate), {
    artifacts: ["foo"],
    clauses: ["foo"],
    groups: [[{ type: "WRD", value: "foo" }]],
    keys: ["foo"],
    pairs: { foo: null },
    text: "foo",
    tokens: [{ type: "WRD", value: "foo" }],
    trailers: {},
  });

  expect(marshallParams("foo 2", ctx.evaluate), {
    artifacts: [2],
    clauses: ["foo 2"],
    groups: [
      [
        { type: "WRD", value: "foo" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "2" },
      ],
    ],
    keys: ["foo"],
    pairs: { foo: 2 },
    text: "foo 2",
    tokens: [
      { type: "WRD", value: "foo" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "2" },
    ],
    trailers: {},
  });

  expect(marshallParams("foo bar", ctx.evaluate), {
    artifacts: ["bar"],
    clauses: ["foo bar"],
    groups: [
      [
        { type: "WRD", value: "foo" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "bar" },
      ],
    ],
    keys: ["foo"],
    pairs: { foo: "bar" },
    text: "foo bar",
    tokens: [
      { type: "WRD", value: "foo" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "bar" },
    ],
    trailers: {},
  });

  expect(marshallParams("foo.bar.baz", ctx.evaluate), {
    artifacts: ["foo.bar.baz"],
    clauses: ["foo.bar.baz"],
    groups: [[{ type: "WRD", value: "foo.bar.baz" }]],
    keys: ["foo.bar.baz"],
    pairs: { "foo.bar.baz": null },
    text: "foo.bar.baz",
    tokens: [{ type: "WRD", value: "foo.bar.baz" }],
    trailers: {},
  });

  expect(marshallParams("foo.bar.baz 2 + 5", ctx.evaluate), {
    artifacts: [7],
    clauses: ["foo.bar.baz 2 + 5"],
    groups: [
      [
        { type: "WRD", value: "foo.bar.baz" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "2" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "+" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "5" },
      ],
    ],
    keys: ["foo.bar.baz"],
    pairs: { "foo.bar.baz": 7 },
    text: "foo.bar.baz 2 + 5",
    tokens: [
      { type: "WRD", value: "foo.bar.baz" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "2" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "+" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "5" },
    ],
    trailers: {},
  });

  expect(marshallParams("42", ctx.evaluate), {
    artifacts: [42],
    clauses: ["42"],
    groups: [[{ type: "NUM", value: "42" }]],
    keys: ["42"],
    pairs: { "42": null },
    text: "42",
    tokens: [{ type: "NUM", value: "42" }],
    trailers: {},
  });

  expect(marshallParams("$gold; mew two", ctx.evaluate), {
    artifacts: ["$gold", "two"],
    clauses: ["$gold", "mew two"],
    groups: [
      [{ type: "WRD", value: "$gold" }],
      [
        { type: "WRD", value: "mew" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "two" },
      ],
    ],
    keys: ["$gold", "mew"],
    pairs: { $gold: null, mew: "two" },
    text: "$gold; mew two",
    tokens: [
      { type: "WRD", value: "$gold" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "mew" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "two" },
    ],
    trailers: { mew: "two" },
  });

  Object.assign(ctx.session.state, { x: 2 });
  expect(marshallParams("x + 2; $gold; mew two", ctx.evaluate), {
    artifacts: [4, "$gold", "two"],
    clauses: ["x + 2", "$gold", "mew two"],
    groups: [
      [
        { type: "WRD", value: "x" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "+" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "2" },
      ],
      [{ type: "WRD", value: "$gold" }],
      [
        { type: "WRD", value: "mew" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "two" },
      ],
    ],
    keys: ["$gold", "mew"],
    pairs: { $gold: null, mew: "two" },
    text: "x + 2; $gold; mew two",
    tokens: [
      { type: "WRD", value: "x" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "+" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "2" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "$gold" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "mew" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "two" },
    ],
    trailers: { mew: "two" },
  });

  Object.assign(ctx.session.state, { x: 2 });
  expect(marshallParams("boo x + 2", ctx.evaluate), {
    artifacts: [4],
    clauses: ["boo x + 2"],
    groups: [
      [
        { type: "WRD", value: "boo" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "x" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "+" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "2" },
      ],
    ],
    keys: ["boo"],
    pairs: { boo: 4 },
    text: "boo x + 2",
    tokens: [
      { type: "WRD", value: "boo" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "x" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "+" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "2" },
    ],
    trailers: {},
  });

  Object.assign(ctx.session.state, { x: 2 });
  expect(marshallParams("bum x + 1; baz x * 23.4", ctx.evaluate), {
    artifacts: [3, 46.8],
    clauses: ["bum x + 1", "baz x * 23.4"],
    groups: [
      [
        { type: "WRD", value: "bum" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "x" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "+" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "1" },
      ],
      [
        { type: "WRD", value: "baz" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "x" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "*" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "23.4" },
      ],
    ],
    keys: ["bum", "baz"],
    pairs: { baz: 46.8, bum: 3 },
    text: "bum x + 1; baz x * 23.4",
    tokens: [
      { type: "WRD", value: "bum" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "x" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "+" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "1" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "baz" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "x" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "*" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "23.4" },
    ],
    trailers: { baz: 46.8 },
  });

  Object.assign(ctx.session.state, { mario: { world: 1 } });
  expect(marshallParams("mario", ctx.evaluate), {
    artifacts: [{ world: 1 }],
    clauses: ["mario"],
    groups: [[{ type: "WRD", value: "mario" }]],
    keys: ["mario"],
    pairs: { world: 1 },
    text: "mario",
    tokens: [{ type: "WRD", value: "mario" }],
    trailers: {},
  });

  Object.assign(ctx.session.state, { mario: { world: 1 } });
  expect(marshallParams("mario; jimbo 3", ctx.evaluate), {
    artifacts: [{ world: 1 }, 3],
    clauses: ["mario", "jimbo 3"],
    groups: [
      [{ type: "WRD", value: "mario" }],
      [
        { type: "WRD", value: "jimbo" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "3" },
      ],
    ],
    keys: ["mario", "jimbo"],
    pairs: { jimbo: 3, world: 1 },
    text: "mario; jimbo 3",
    tokens: [
      { type: "WRD", value: "mario" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "jimbo" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "3" },
    ],
    trailers: { jimbo: 3 },
  });

  Object.assign(ctx.session.state, {
    mario: { world: 1 },
    princess: { castle: 2 },
  });
  expect(marshallParams("mario; princess; toad 3", ctx.evaluate), {
    artifacts: [{ world: 1 }, { castle: 2 }, 3],
    clauses: ["mario", "princess", "toad 3"],
    groups: [
      [{ type: "WRD", value: "mario" }],
      [{ type: "WRD", value: "princess" }],
      [
        { type: "WRD", value: "toad" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "3" },
      ],
    ],
    keys: ["mario", "princess", "toad"],
    pairs: { castle: 2, toad: 3, world: 1 },
    text: "mario; princess; toad 3",
    tokens: [
      { type: "WRD", value: "mario" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "princess" },
      { type: "PCT", value: ";" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "toad" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "3" },
    ],
    trailers: { toad: 3 },
  });

  // Edge cases: expressions starting with unary operators
  Object.assign(ctx.session.state, { isAlive: true });
  expect(marshallParams("!isAlive", ctx.evaluate), {
    artifacts: [false],
    clauses: ["!isAlive"],
    groups: [
      [
        { type: "PCT", value: "!" },
        { type: "WRD", value: "isAlive" },
      ],
    ],
    keys: [],
    pairs: {},
    text: "!isAlive",
    tokens: [
      { type: "PCT", value: "!" },
      { type: "WRD", value: "isAlive" },
    ],
    trailers: {},
  });

  Object.assign(ctx.session.state, { count: 5 });
  expect(marshallParams("-count", ctx.evaluate), {
    artifacts: [-5],
    clauses: ["-count"],
    groups: [
      [
        { type: "PCT", value: "-" },
        { type: "WRD", value: "count" },
      ],
    ],
    keys: [],
    pairs: {},
    text: "-count",
    tokens: [
      { type: "PCT", value: "-" },
      { type: "WRD", value: "count" },
    ],
    trailers: {},
  });

  // Edge case: negation with logical AND
  Object.assign(ctx.session.state, { a: false, b: true });
  expect(marshallParams("!a && b", ctx.evaluate), {
    artifacts: [true],
    clauses: ["!a && b"],
    groups: [
      [
        { type: "PCT", value: "!" },
        { type: "WRD", value: "a" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "&" },
        { type: "PCT", value: "&" },
        { type: "SPC", value: " " },
        { type: "WRD", value: "b" },
      ],
    ],
    keys: [],
    pairs: {},
    text: "!a && b",
    tokens: [
      { type: "PCT", value: "!" },
      { type: "WRD", value: "a" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "&" },
      { type: "PCT", value: "&" },
      { type: "SPC", value: " " },
      { type: "WRD", value: "b" },
    ],
    trailers: {},
  });

  // Edge case: parenthesized expression
  expect(marshallParams("(2 + 3)", ctx.evaluate), {
    artifacts: [5],
    clauses: ["(2 + 3)"],
    groups: [
      [
        { type: "PCT", value: "(" },
        { type: "NUM", value: "2" },
        { type: "SPC", value: " " },
        { type: "PCT", value: "+" },
        { type: "SPC", value: " " },
        { type: "NUM", value: "3" },
        { type: "PCT", value: ")" },
      ],
    ],
    keys: [],
    pairs: {},
    text: "(2 + 3)",
    tokens: [
      { type: "PCT", value: "(" },
      { type: "NUM", value: "2" },
      { type: "SPC", value: " " },
      { type: "PCT", value: "+" },
      { type: "SPC", value: " " },
      { type: "NUM", value: "3" },
      { type: "PCT", value: ")" },
    ],
    trailers: {},
  });

  // Edge case: array literal
  expect(marshallParams("[1, 2, 3]", ctx.evaluate), {
    artifacts: [[1, 2, 3]],
    clauses: ["[1, 2, 3]"],
    groups: [
      [
        { type: "PCT", value: "[" },
        { type: "NUM", value: "1" },
        { type: "PCT", value: "," },
        { type: "SPC", value: " " },
        { type: "NUM", value: "2" },
        { type: "PCT", value: "," },
        { type: "SPC", value: " " },
        { type: "NUM", value: "3" },
        { type: "PCT", value: "]" },
      ],
    ],
    keys: [],
    pairs: {},
    text: "[1, 2, 3]",
    tokens: [
      { type: "PCT", value: "[" },
      { type: "NUM", value: "1" },
      { type: "PCT", value: "," },
      { type: "SPC", value: " " },
      { type: "NUM", value: "2" },
      { type: "PCT", value: "," },
      { type: "SPC", value: " " },
      { type: "NUM", value: "3" },
      { type: "PCT", value: "]" },
    ],
    trailers: {},
  });
}

test();
