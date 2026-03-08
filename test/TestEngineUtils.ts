import { compileCartridge } from "../eng/Compiler";
import { ContextCallbacks, createContext, step } from "../eng/Engine";
import { reifyCartridge, reifySession, singleLineEvent, StoryCartridge, StorySession } from "../eng/Helpers";
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
