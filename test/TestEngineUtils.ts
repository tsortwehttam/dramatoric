import { compileCartridge } from "../eng/Compiler";
import { ContextCallbacks, createContext, step } from "../eng/Engine";
import {
  IOFunc,
  IORequest,
  IOResult,
  reifyCartridge,
  reifySession,
  singleLineEvent,
  StoryCartridge,
  StorySession,
} from "../eng/Helpers";
import { JsonSchema } from "../lib/CoreTypings";
import { LLMInstruction } from "../lib/LLMTypes";
import { createIO } from "../eng/io/WellBackendIO";
import { loadEnv } from "../env";
import { stringizeBufferObj } from "../lib/BufferUtils";
import { loadDirRecursive } from "../lib/FileUtils";

const NOOP_CALLBACKS: ContextCallbacks = {
  onEvent: () => {},
  onError: () => {},
};

function cloneSession(partial: Partial<StorySession>): Partial<StorySession> {
  return JSON.parse(JSON.stringify(partial));
}

export type MockLlmFixture = {
  name: string;
  systemIncludes: string[];
  userIncludes: string[];
  schemaIncludes: string[];
  reply: unknown | ((input: { instructions: LLMInstruction[]; schema: JsonSchema; models: string[] }) => unknown | Promise<unknown>);
};

type MockLlmInput = {
  instructions: LLMInstruction[];
  schema: JsonSchema;
  models: string[];
};

export async function execStoryTest(
  src: string | StoryCartridge,
  partial: Partial<StorySession>,
  mock: boolean = false,
) {
  const ctx = createTestContext(src, cloneSession(partial), mock);
  await step(ctx);
  ctx.session.history.forEach((event) => console.info(singleLineEvent(event)));
  return ctx.session;
}

export async function execMultiStepTest(
  src: string | StoryCartridge,
  steps: Partial<StorySession>[],
  mock: boolean = false,
) {
  const ctx = createTestContext(src, cloneSession(steps[0] ?? {}), mock);
  await step(ctx);
  for (let i = 1; i < steps.length; i++) {
    const stepConfig = steps[i];
    if (stepConfig.inputs) {
      ctx.session.inputs = stepConfig.inputs;
    }
    await step(ctx);
  }
  ctx.session.history.forEach((event) => console.info(singleLineEvent(event)));
  return ctx.session;
}

export async function execStoryTestWithLlm(
  src: string | StoryCartridge,
  partial: Partial<StorySession>,
  llm: (instructions: LLMInstruction[], schema: JsonSchema, models: string[]) => unknown | Promise<unknown>,
) {
  const ctx = createTestContext(src, cloneSession(partial), true);
  const callMockLlm = async (instructions: LLMInstruction[], schema: JsonSchema, models: string[]) => {
    return (await llm(instructions, schema, models)) ?? null;
  };
  const baseIo = ctx.io;
  ctx.llm = async (instructions, schema, options) => {
    return callMockLlm(instructions, schema, options?.models ?? []);
  };
  ctx.io = async <K extends IORequest["kind"]>(request: Extract<IORequest, { kind: K }>) => {
    if (request.kind === "llm") {
      const llmReq = request as Extract<IORequest, { kind: "llm" }>;
      return (await callMockLlm(llmReq.instructions, llmReq.schema, llmReq.models)) as IOResult<K>;
    }
    return baseIo(request);
  };
  await step(ctx);
  ctx.session.history.forEach((event) => console.info(singleLineEvent(event)));
  return ctx.session;
}

export async function execStoryTestWithMockLlm(
  src: string | StoryCartridge,
  partial: Partial<StorySession>,
  fixtures: MockLlmFixture[],
) {
  return execStoryTestWithLlm(src, partial, buildFixtureMockLlm(fixtures));
}

export async function execMultiStepTestWithMockLlm(
  src: string | StoryCartridge,
  steps: Partial<StorySession>[],
  fixtures: MockLlmFixture[],
) {
  const ctx = createTestContext(src, cloneSession(steps[0] ?? {}), true);
  ctx.llm = async (instructions, schema, options) => {
    return (await buildFixtureMockLlm(fixtures)(instructions, schema, options?.models ?? [])) ?? null;
  };
  await step(ctx);
  for (let i = 1; i < steps.length; i++) {
    const stepConfig = steps[i];
    if (stepConfig.inputs) {
      ctx.session.inputs = stepConfig.inputs;
    }
    await step(ctx);
  }
  ctx.session.history.forEach((event) => console.info(singleLineEvent(event)));
  return ctx.session;
}

export function createTestContext(src: string | StoryCartridge, partial: Partial<StorySession>, mock: boolean = false) {
  const cartridge = reifyCartridge(src);
  const sources = compileCartridge(cartridge);
  const session = reifySession(partial);
  const io = createIO(
    loadEnv({
      MOCK_PROVIDER: mock ? "1" : "",
    }),
  );
  return createContext(io, session, sources, NOOP_CALLBACKS);
}

export function loadCartridge(dir: string): StoryCartridge {
  return stringizeBufferObj(loadDirRecursive(dir));
}

function buildFixtureMockLlm(fixtures: MockLlmFixture[]) {
  return async (instructions: LLMInstruction[], schema: JsonSchema, models: string[]) => {
    const input = { instructions, schema, models };
    const match = fixtures.find((fixture) => matchesFixture(fixture, input));
    if (!match) {
      throw new Error(`No mock LLM fixture matched.\nSystem:\n${readInstructionText(instructions, "system")}\n\nUser:\n${readInstructionText(instructions, "user")}`);
    }

    if (typeof match.reply === "function") {
      return (await match.reply(input)) ?? null;
    }
    return match.reply ?? null;
  };
}

function matchesFixture(fixture: MockLlmFixture, input: MockLlmInput) {
  const system = readInstructionText(input.instructions, "system");
  const user = readInstructionText(input.instructions, "user");
  const schema = JSON.stringify(input.schema);
  return (
    includesAll(system, fixture.systemIncludes) &&
    includesAll(user, fixture.userIncludes) &&
    includesAll(schema, fixture.schemaIncludes)
  );
}

function readInstructionText(instructions: LLMInstruction[], role: "system" | "user") {
  return instructions
    .filter((item) => item.role === role)
    .map((item) => item.content)
    .join("\n");
}

function includesAll(text: string, needles: string[]) {
  return needles.every((needle) => text.includes(needle));
}
