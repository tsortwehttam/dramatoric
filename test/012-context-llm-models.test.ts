import { compileCartridge } from "../eng/Compiler";
import { ContextCallbacks, createContext } from "../eng/Engine";
import { IOFunc, IORequest, IOResult, reifyCartridge, reifySession } from "../eng/Helpers";
import { JsonSchema } from "../lib/CoreTypings";
import { expect } from "./TestUtils";

const NOOP_CALLBACKS: ContextCallbacks = {
  onEvent: () => {},
  onError: () => {},
};

const EMPTY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {},
  required: [],
  additionalProperties: false,
};

function createCaptureIO(calls: string[][]): IOFunc {
  return async <K extends IORequest["kind"]>(req: Extract<IORequest, { kind: K }>): Promise<IOResult<K>> => {
    if (req.kind === "llm") {
      const r = req as Extract<IORequest, { kind: "llm" }>;
      calls.push([...r.models]);
      return { ok: true } as IOResult<K>;
    }
    throw new Error(`Unexpected IO request kind: ${(req as IORequest).kind}`);
  };
}

async function test() {
  const script = `NARRATOR:\nHello`;
  const source = reifyCartridge(script);
  const sources = compileCartridge(source);
  const session = reifySession({});
  const calls: string[][] = [];
  const io = createCaptureIO(calls);
  const ctx = createContext(io, session, sources, NOOP_CALLBACKS);

  await ctx.llm([{ role: "user", content: "ping" }], EMPTY_SCHEMA, { models: ["WRITING"] });
  await ctx.llm([{ role: "user", content: "pong" }], EMPTY_SCHEMA, { models: [] });

  expect(calls[0], ["WRITING"]);
  expect(calls[1], []);
}

test();
