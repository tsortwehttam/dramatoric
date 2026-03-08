import { evaluateExprCore, Expr, ExprEvalFunc, parseExprCore } from "../eng/Evaluator";
import { SerialValue } from "../lib/CoreTypings";

import { expect } from "./TestUtils";

function ev(
  expr: string,
  vars: Record<string, SerialValue> = {},
  funcs: Record<string, ExprEvalFunc> = {},
): SerialValue {
  const ast = parseExprCore(expr);
  if (!ast) throw new Error("parse failed");
  return evaluateExprCore(ast, vars, funcs);
}

function mustParse(expr: string): Expr {
  const ast = parseExprCore(expr);
  if (!ast) throw new Error("parse failed");
  return ast;
}

// Literals
expect(ev("42"), 42);
expect(ev("3.14"), 3.14);
expect(ev("-5"), -5);
expect(ev("0xff"), 255);
expect(ev('"hello"'), "hello");
expect(ev("'world'"), "world");
expect(ev("`backtick`"), "backtick");
expect(ev("true"), true);
expect(ev("false"), false);
expect(ev("null"), null);
expect(ev(""), null);

// Arithmetic
expect(ev("2 + 3"), 5);
expect(ev("10 - 4"), 6);
expect(ev("3 * 4"), 12);
expect(ev("15 / 3"), 5);
expect(ev("17 % 5"), 2);
expect(ev("2 ** 10"), 1024);
expect(ev("2 ** 3 ** 2"), 512); // right associative: 2^(3^2) = 2^9 = 512

// Unary
expect(ev("-10"), -10);
expect(ev("--10"), 10);
expect(ev("+5"), 5);
expect(ev('+"42"'), 42);
expect(ev("!true"), false);
expect(ev("!false"), true);
expect(ev("!0"), true);
expect(ev("!1"), false);
expect(ev("!!true"), true);
expect(ev("~0"), -1);
expect(ev("~-1"), 0);

// Comparison
expect(ev("5 == 5"), true);
expect(ev("5 == 6"), false);
expect(ev("5 != 6"), true);
expect(ev("5 === 5"), true);
expect(ev("5 !== 6"), true);
expect(ev("3 < 5"), true);
expect(ev("5 < 3"), false);
expect(ev("5 <= 5"), true);
expect(ev("5 <= 6"), true);
expect(ev("5 > 3"), true);
expect(ev("5 >= 5"), true);
expect(ev("5 >= 6"), false);

// Logical with short-circuit
expect(ev("true && true"), true);
expect(ev("true && false"), false);
expect(ev("false && true"), false);
expect(ev("true || false"), true);
expect(ev("false || true"), true);
expect(ev("false || false"), false);
expect(ev("1 && 2"), 2);
expect(ev("0 && 2"), 0);
expect(ev("1 || 2"), 1);
expect(ev("0 || 2"), 2);

// Null coalescing
expect(ev("null ?? 5"), 5);
expect(ev("0 ?? 5"), 0);
expect(ev('"" ?? "default"'), "");
expect(ev("null ?? null ?? 3"), 3);

// Ternary
expect(ev("true ? 1 : 2"), 1);
expect(ev("false ? 1 : 2"), 2);
expect(ev("1 > 0 ? 'yes' : 'no'"), "yes");
expect(ev("1 < 0 ? 'yes' : 'no'"), "no");
expect(ev("true ? true ? 1 : 2 : 3"), 1); // nested ternary
expect(ev("false ? 1 : true ? 2 : 3"), 2);

// Bitwise
expect(ev("5 & 3"), 1);
expect(ev("5 | 3"), 7);
expect(ev("5 ^ 3"), 6);

// Precedence
expect(ev("2 + 3 * 4"), 14);
expect(ev("(2 + 3) * 4"), 20);
expect(ev("2 * 3 + 4"), 10);
expect(ev("10 - 2 - 3"), 5);
expect(ev("2 ** 3 * 2"), 16);
expect(ev("1 + 2 < 3 + 4"), true);
expect(ev("true || false && false"), true);
expect(ev("(true || false) && false"), false);

// Variables
expect(ev("x", { x: 10 }), 10);
expect(ev("x + y", { x: 3, y: 4 }), 7);
expect(ev("name", { name: "Alice" }), "Alice");
expect(ev("missing", {}), null);

// Dotted property access
expect(ev("user.name", { user: { name: "Bob" } }), "Bob");
expect(ev("a.b.c", { a: { b: { c: 42 } } }), 42);
expect(ev("a.b.c", { a: { b: {} } }), null);
expect(ev("a.b.c", { a: {} }), null);
expect(ev("a.b.c", {}), null);
expect(ev("arr.0", { arr: ["first", "second"] }), "first");
expect(ev("arr.1", { arr: ["first", "second"] }), "second");
expect(ev("data.items.0.name", { data: { items: [{ name: "Item1" }] } }), "Item1");

// Array literals
expect(ev("[]"), []);
expect(ev("[1, 2, 3]"), [1, 2, 3]);
expect(ev('["a", "b"]'), ["a", "b"]);
expect(ev("[1 + 1, 2 * 2]"), [2, 4]);
expect(ev("[x, y, z]", { x: 1, y: 2, z: 3 }), [1, 2, 3]);
expect(ev("[[1, 2], [3, 4]]"), [
  [1, 2],
  [3, 4],
]);
expect(ev("[true, false, null]"), [true, false, null]);

// Object literals
expect(ev("{}"), {});
expect(ev("{a: 1}"), { a: 1 });
expect(ev("{a: 1, b: 2}"), { a: 1, b: 2 });
expect(ev('{"key": "value"}'), { key: "value" });
expect(ev("{x: x, y: y}", { x: 10, y: 20 }), { x: 10, y: 20 });
expect(ev("{sum: a + b}", { a: 3, b: 4 }), { sum: 7 });
expect(ev("{nested: {inner: 1}}"), { nested: { inner: 1 } });
expect(ev("{arr: [1, 2, 3]}"), { arr: [1, 2, 3] });

// Custom functions
const funcs: Record<string, ExprEvalFunc> = {
  double: (x) => (typeof x === "number" ? x * 2 : 0),
  sum: (...args) => args.reduce((a: number, b) => a + (typeof b === "number" ? b : 0), 0),
  concat: (...args) => args.map(String).join(""),
  first: (arr) => (Array.isArray(arr) ? (arr[0] ?? null) : null),
  len: (x) => (Array.isArray(x) ? x.length : typeof x === "string" ? x.length : 0),
  upper: (s) => (typeof s === "string" ? s.toUpperCase() : null),
  clamp: (v, lo, hi) => Math.min(Math.max(Number(v), Number(lo)), Number(hi)),
  obj: (k, v) => ({ [String(k)]: v }),
};

expect(ev("double(5)", {}, funcs), 10);
expect(ev("double(x)", { x: 7 }, funcs), 14);
expect(ev("sum(1, 2, 3, 4)", {}, funcs), 10);
expect(ev("sum()", {}, funcs), 0);
expect(ev('concat("a", "b", "c")', {}, funcs), "abc");
expect(ev("first([10, 20, 30])", {}, funcs), 10);
expect(ev("first([])", {}, funcs), null);
expect(ev("len([1, 2, 3])", {}, funcs), 3);
expect(ev('len("hello")', {}, funcs), 5);
expect(ev('upper("hello")', {}, funcs), "HELLO");
expect(ev("clamp(15, 0, 10)", {}, funcs), 10);
expect(ev("clamp(-5, 0, 10)", {}, funcs), 0);
expect(ev("clamp(5, 0, 10)", {}, funcs), 5);
expect(ev('obj("key", 123)', {}, funcs), { key: 123 });

// Nested function calls
expect(ev("double(double(3))", {}, funcs), 12);
expect(ev("sum(double(2), double(3))", {}, funcs), 10);
expect(ev("len(concat(a, b))", { a: "foo", b: "bar" }, funcs), 6);

// Complex expressions
expect(ev("x > 0 ? double(x) : -x", { x: 5 }, funcs), 10);
expect(ev("x > 0 ? double(x) : -x", { x: -5 }, funcs), 5);
expect(ev("user.score >= 100 ? 'winner' : 'keep trying'", { user: { score: 150 } }), "winner");
expect(ev("{result: x * 2, original: x}", { x: 5 }), {
  result: 10,
  original: 5,
});
expect(ev("[a + b, a - b, a * b]", { a: 10, b: 3 }), [13, 7, 30]);

// Edge cases
expect(ev("0"), 0);
expect(ev("-0"), -0);
expect(ev("1e10"), 1e10);
expect(ev("1.5e-3"), 0.0015);
expect(ev('""'), "");
expect(ev("''"), "");

// Verify AST structure for static analysis
const ast1 = mustParse("x + y * z");
expect("op" in ast1, true);
expect((ast1 as { op: string }).op, "add");

const ast2 = mustParse("foo.bar");
expect("var" in ast2, true);
expect((ast2 as { var: string }).var, "foo.bar");

const ast3 = mustParse("42");
expect("lit" in ast3, true);
expect((ast3 as { lit: SerialValue }).lit, 42);

const ast4 = mustParse("myFunc(a, b)");
expect("op" in ast4, true);
expect((ast4 as { op: string; args: Expr[] }).op, "myFunc");
expect((ast4 as { op: string; args: Expr[] }).args.length, 2);

expect(parseExprCore("---"), null);
expect(parseExprCore("--"), null);
expect(parseExprCore("??:"), null);
