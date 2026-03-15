import { renderHandlebarsAndDDV } from "../eng/Execution";
import { SerialValue } from "../lib/CoreTypings";
import { createTestContext } from "./TestEngineUtils";
import { expect } from "./TestUtils";

function ctxWithState(state: Record<string, SerialValue> = {}) {
  return createTestContext("NARRATOR:\nHello", { state, seed: "ddv-test" }, true);
}

const ctx = ctxWithState({ name: "Iris", x: 1 });
expect(renderHandlebarsAndDDV("Hi {{ name }}", ctx), "Hi Iris");
expect(renderHandlebarsAndDDV("Sum {{ x + 2 }}", ctx), "Sum 3");
expect(renderHandlebarsAndDDV("Logic {{ true || false }}", ctx), "Logic true");

const nestedCtx = ctxWithState({ gender: "male", numA: 34, numB: 78 });
expect(
  renderHandlebarsAndDDV("Hello, Mister << create a name for a {{ gender }} who is {{ {{ numA }} % {{ numB }} }} years old >>", nestedCtx),
  "Hello, Mister << create a name for a male who is 34 years old >>",
);

const pipeCtx = ctxWithState();
expect(renderHandlebarsAndDDV("{{ ^a|b|c }}", pipeCtx), "a");
expect(renderHandlebarsAndDDV("{{ ^a|b|c }}", pipeCtx), "b");

const jsonArrayCtx = ctxWithState();
expect(renderHandlebarsAndDDV('{{ ^["x", "y"] }}', jsonArrayCtx), "x");
expect(renderHandlebarsAndDDV('{{ ^["x", "y"] }}', jsonArrayCtx), "y");

const jsonObjCtx = ctxWithState();
expect(renderHandlebarsAndDDV('{{ {"mode":"cycle","values":["m","n"]} }}', jsonObjCtx), "m");
expect(renderHandlebarsAndDDV('{{ {"mode":"cycle","values":["m","n"]} }}', jsonObjCtx), "n");

const yamlCtx = ctxWithState();
const yamlList = `{{ ^
- red
- blue
}}`;
expect(renderHandlebarsAndDDV(yamlList, yamlCtx), "red");
expect(renderHandlebarsAndDDV(yamlList, yamlCtx), "blue");

const structCtx = ctxWithState();
expect(renderHandlebarsAndDDV('{{ {"foo":1} }}', structCtx), '{"foo":1}');
