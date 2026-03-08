import { tokenize, tokensToKVP } from "../eng/Lexer";
import { expect } from "./TestUtils";

const simpleSrc = 'name "alpha"; count 3; flag false';
const complexSrc =
  'note "calm, cool breeze"; someVar 34; blahVar Haha; fooBaz someScript(withStuff() + likeThis(12.3)); flag true; none null; scriptVal tracer("hi, friend", blend("soft breeze, warm sun"))';

const expectedSimpleTokens = [
  { type: "WRD", value: "name" },
  { type: "SPC", value: " " },
  { type: "QUO", value: "alpha" },
  { type: "PCT", value: ";" },
  { type: "SPC", value: " " },
  { type: "WRD", value: "count" },
  { type: "SPC", value: " " },
  { type: "NUM", value: "3" },
  { type: "PCT", value: ";" },
  { type: "SPC", value: " " },
  { type: "WRD", value: "flag" },
  { type: "SPC", value: " " },
  { type: "WRD", value: "false" },
];

const expectedPairs = {
  note: "calm, cool breeze",
  someVar: 34,
  blahVar: "Haha",
  fooBaz: "someScript(withStuff() + likeThis(12.3))",
  flag: true,
  none: null,
  scriptVal: 'tracer("hi, friend", blend("soft breeze, warm sun"))',
};

function run() {
  expect(tokenize(simpleSrc), expectedSimpleTokens);
  const complexTokens = tokenize(complexSrc);
  expect(tokensToKVP(complexTokens), expectedPairs);
  const spacedSrc = "foo bar baz; bux bum";
  expect(tokensToKVP(tokenize(spacedSrc)), { foo: "bar baz", bux: "bum" });

  const escapedSrc = 'msg "He said \\"hello\\""; path "C:\\\\Users"';
  expect(tokensToKVP(tokenize(escapedSrc)), {
    msg: 'He said "hello"',
    path: "C:\\Users",
  });

  const propAccessSrc = "foo.bar 42; config.theme.color blue";
  expect(tokensToKVP(tokenize(propAccessSrc)), {
    "foo.bar": 42,
    "config.theme.color": "blue",
  });

  const mixedSrc = 'simple true; nested.deep.value "hello"; other 123';
  expect(tokensToKVP(tokenize(mixedSrc)), {
    simple: true,
    "nested.deep.value": "hello",
    other: 123,
  });

  const numKeySrc = "42 foo; 23.5 bar";
  expect(tokensToKVP(tokenize(numKeySrc)), {
    "42": "foo",
    "23.5": "bar",
  });

  const numPropSrc = "arr.0 first; arr.1 second; obj.99.name test";
  expect(tokensToKVP(tokenize(numPropSrc)), {
    "arr.0": "first",
    "arr.1": "second",
    "obj.99.name": "test",
  });

  const dollarSrc = "$foo 1; $bar.baz 2";
  expect(tokensToKVP(tokenize(dollarSrc)), {
    $foo: 1,
    "$bar.baz": 2,
  });

  const underscoreSrc = "_foo 1; _bar._baz 2; __dunder__ 3";
  expect(tokensToKVP(tokenize(underscoreSrc)), {
    _foo: 1,
    "_bar._baz": 2,
    __dunder__: 3,
  });

  const unicodeSrc = "café latte; naïve true; 日本語 hello; personnage héros";
  expect(tokensToKVP(tokenize(unicodeSrc)), {
    café: "latte",
    naïve: true,
    日本語: "hello",
    personnage: "héros",
  });

  const mixedUnicodeSrc = "$変数 1; _名前.値 test";
  expect(tokensToKVP(tokenize(mixedUnicodeSrc)), {
    $変数: 1,
    "_名前.値": "test",
  });
}

run();
