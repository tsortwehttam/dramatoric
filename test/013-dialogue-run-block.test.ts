import { compileCartridge } from "../eng/Compiler";
import { ContextCallbacks, createContext, step } from "../eng/Engine";
import { IOFunc, IORequest, IOResult, reifyCartridge, reifySession } from "../eng/Helpers";
import { LLMInstruction } from "../lib/LLMTypes";
import { expect, expectHas } from "./TestUtils";

const NOOP_CALLBACKS: ContextCallbacks = {
  onEvent: () => {},
  onError: () => {},
};

function createCaptureIO(calls: LLMInstruction[][]): IOFunc {
  return async <K extends IORequest["kind"]>(req: Extract<IORequest, { kind: K }>): Promise<IOResult<K>> => {
    if (req.kind === "llm") {
      const r = req as Extract<IORequest, { kind: "llm" }>;
      const hasEvents =
        r.schema &&
        typeof r.schema === "object" &&
        "properties" in r.schema &&
        r.schema.properties &&
        typeof r.schema.properties === "object" &&
        "events" in r.schema.properties;
      if (hasEvents) {
        return {
          events: [
            {
              act: "dialog",
              to: ["FRANK"],
              value: "Hello Frank",
              raw: "Hello Frank",
            },
          ],
        } as IOResult<K>;
      }
      calls.push(r.instructions);
      return "Mock reply" as IOResult<K>;
    }
    if (req.kind === "fetch") {
      return { status: 200, data: "", contentType: "text/plain" } as IOResult<K>;
    }
    if (req.kind === "load") {
      return null as IOResult<K>;
    }
    if (
      req.kind === "save" ||
      req.kind === "speech" ||
      req.kind === "sound" ||
      req.kind === "music" ||
      req.kind === "image" ||
      req.kind === "video"
    ) {
      return undefined as IOResult<K>;
    }
    throw new Error(`Unexpected IO request kind: ${(req as IORequest).kind}`);
  };
}

async function test() {
  const script = `
    BLOCK: Shared Prompt DO
      FRANK:
      << Mention the player's greeting and answer warmly. >>
    END

    ENTITY: FRANK DO
      You are Frank, a warm bartender.
    END

    ON: $input DO
      RUN: Shared Prompt
    END
  `;

  const source = reifyCartridge(script);
  const sources = compileCartridge(source);
  const session = reifySession({
    inputs: [{ from: "PLAYER", raw: "Hello Frank", to: ["FRANK"], value: "Hello Frank", act: "dialog" }],
  });
  const calls: LLMInstruction[][] = [];
  const io = createCaptureIO(calls);
  const ctx = createContext(io, session, sources, NOOP_CALLBACKS);

  await step(ctx);

  expect(calls.length, 1);
  expectHas(calls[0][0], { role: "system" });
  expectHas(calls[0][1], { role: "user" });
  expect(calls[0][0]?.content.includes("warm bartender"), true);
  expect(calls[0][0]?.content.includes("Mention the player's greeting and answer warmly."), true);
  expect(calls[0][1]?.content.includes("PLAYER: Hello Frank"), true);

  const msg = ctx.session.history.find((event) => event.type === "$message" && event.from === "FRANK");
  expectHas(msg, {
    from: "FRANK",
    value: "Mock reply",
  });
}

test();
