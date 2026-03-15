import { SerialValue } from "../lib/CoreTypings";
import { renderHandlebarsTemplate } from "../lib/TemplateHelpers";
import { expect } from "./TestUtils";

function createResolver(values: Record<string, SerialValue>) {
  return function resolve(expr: string): SerialValue {
    return values[expr];
  };
}

async function go() {
  let called = false;
  const plain = renderHandlebarsTemplate("plain text", () => {
    called = true;
    return "x";
  });
  expect(plain, "plain text");
  expect(called, false);

  const seen: string[] = [];
  const values: Record<string, SerialValue> = {
    "first.name": "Iris",
    count: 3,
    tags: ["blue", "green"],
    data: { foo: 1 },
    empty: null,
    flag: true,
  };
  const complex = renderHandlebarsTemplate(
    "Hi {{   first.name  }}! Count {{ count }}, Tags {{ tags }}, Data {{ data }}, Null {{ empty }}, Flag {{ flag }}.",
    (expr) => {
      seen.push(expr);
      return values[expr];
    }
  );
  expect(complex, 'Hi Iris! Count 3, Tags blue,green, Data {"foo":1}, Null , Flag true.');
  expect(seen, ["first.name", "count", "tags", "data", "empty", "flag"]);

  const template = "Value: {{ value }}!";
  const first = renderHandlebarsTemplate(template, createResolver({ value: "A" }));
  const second = renderHandlebarsTemplate(template, createResolver({ value: "B" }));
  expect(first, "Value: A!");
  expect(second, "Value: B!");

  const nestedSeen: string[] = [];
  const nested = renderHandlebarsTemplate("Hello {{ title {{ role }} }}!", (expr) => {
    nestedSeen.push(expr);
    if (expr === "role") return "captain";
    if (expr === "title captain") return "Mister";
    return "";
  });
  expect(nested, "Hello Mister!");
  expect(nestedSeen, ["role", "title captain"]);
}

go();
