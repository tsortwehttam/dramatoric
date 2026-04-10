import {
  DEFAULT_LLM_SLUGS,
  defaultsForBackend,
  LLMSlug,
  normalizeModels,
  slugsForBackend,
  structuredModelsForBackend,
  toDirectSlug,
} from "../lib/LLMTypes";
import { NonEmpty } from "../lib/CoreTypings";
import { expect } from "./TestUtils";

async function test() {
  // Test with no attms (should return defaultModels)
  expect(normalizeModels({ models: [] }, undefined), DEFAULT_LLM_SLUGS);

  // Test with empty attms string
  expect(normalizeModels({ models: [] }, ""), DEFAULT_LLM_SLUGS);

  // Test with single model name
  expect(normalizeModels({ models: [] }, "openai/gpt-5"), ["openai/gpt-5", ...DEFAULT_LLM_SLUGS]);

  // Test with multiple model names
  expect(normalizeModels({ models: [] }, "openai/gpt-5,anthropic/claude-3.5-sonnet"), [
    "anthropic/claude-3.5-sonnet",
    "openai/gpt-5",
    ...DEFAULT_LLM_SLUGS,
  ]);

  // Test with model tags (all mini models are already in DEFAULT_LLM_SLUGS)
  expect(normalizeModels({ models: [] }, "mini"), [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "openai/gpt-4.1-nano",
    "openai/gpt-4.1-mini",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
  ]);

  // Test with uncensored tag
  expect(normalizeModels({ models: [] }, "uncensored"), [
    "cognitivecomputations/dolphin-mistral-24b-venice-edition:free",
    ...DEFAULT_LLM_SLUGS,
  ]);

  const expectedWriting = [
    "thedrummer/rocinante-12b",
    "mistralai/mistral-small-creative",
    "google/gemini-pro-1.5",
    "moonshotai/kimi-k2-0905",
    "moonshotai/kimi-k2",
    "moonshotai/kimi-k2-0905:exacto",
    "moonshotai/kimi-k2-thinking",
    "moonshotai/kimi-k2:free",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.5-sonnet",
    ...DEFAULT_LLM_SLUGS,
  ] as const;

  expect(normalizeModels({ models: [] }, "WRITING"), expectedWriting);
  expect(normalizeModels({ models: [] }, "writing"), expectedWriting);

  // Test with options.models
  expect(normalizeModels({ models: ["deepseek/deepseek-r1"] }, undefined), [
    "deepseek/deepseek-r1",
    ...DEFAULT_LLM_SLUGS,
  ]);

  expect(normalizeModels({ models: ["deepseek/deepseek-r1"] }, ""), ["deepseek/deepseek-r1", ...DEFAULT_LLM_SLUGS]);

  // Test with both attms and options.models
  expect(normalizeModels({ models: ["deepseek/deepseek-r1"] }, "openai/gpt-5"), [
    "deepseek/deepseek-r1",
    "openai/gpt-5",
    ...DEFAULT_LLM_SLUGS,
  ]);

  // Test with custom defaultModels
  const customDefaults: typeof DEFAULT_LLM_SLUGS = ["anthropic/claude-3.5-sonnet"];
  expect(normalizeModels({ models: [] }, undefined, customDefaults), customDefaults);

  expect(normalizeModels({ models: [] }, "openai/gpt-5", customDefaults), ["openai/gpt-5", ...customDefaults]);

  // Test with invalid model name (should be ignored)
  expect(normalizeModels({ models: [] }, "invalid/model"), DEFAULT_LLM_SLUGS);

  // Test with mix of valid and invalid models
  expect(normalizeModels({ models: [] }, "openai/gpt-5,invalid/model,mini"), [
    "google/gemini-2.5-flash-lite",
    "google/gemini-2.5-flash",
    "openai/gpt-4.1-nano",
    "openai/gpt-4.1-mini",
    "openai/gpt-5-nano",
    "openai/gpt-5-mini",
    "openai/gpt-5",
  ]);

  // Test deduplication
  expect(normalizeModels({ models: ["openai/gpt-5-mini"] }, "openai/gpt-5-mini"), [
    "openai/gpt-5-mini",
    "openai/gpt-5-nano",
    "openai/gpt-4.1-mini",
    "openai/gpt-4.1-nano",
  ]);

  // Test order preservation (most recent first)
  expect(normalizeModels({ models: [] }, "openai/gpt-4o,openai/gpt-5"), [
    "openai/gpt-5",
    "openai/gpt-4o",
    ...DEFAULT_LLM_SLUGS,
  ]);

  // --- toDirectSlug with anthropic backend ---
  expect(toDirectSlug("anthropic/claude-sonnet-4", "anthropic"), "claude-sonnet-4");
  expect(toDirectSlug("anthropic/claude-3.5-sonnet", "anthropic"), "claude-3.5-sonnet");
  expect(toDirectSlug("openai/gpt-5", "anthropic"), null);
  expect(toDirectSlug("google/gemini-2.5-pro", "anthropic"), null);
  // openrouter passes through
  expect(toDirectSlug("anthropic/claude-sonnet-4", "openrouter"), "anthropic/claude-sonnet-4");
  // openai strips openai/ prefix
  expect(toDirectSlug("openai/gpt-5", "openai"), "gpt-5");
  expect(toDirectSlug("anthropic/claude-sonnet-4", "openai"), null);

  // --- slugsForBackend with anthropic ---
  const anthropicSlugs = slugsForBackend("anthropic");
  expect(anthropicSlugs.every((s) => s.startsWith("anthropic/")), true);
  expect(anthropicSlugs.length > 0, true);
  expect(anthropicSlugs.includes("anthropic/claude-sonnet-4"), true);
  // openrouter returns all
  expect(slugsForBackend("openrouter").length > anthropicSlugs.length, true);
  // openai returns only openai
  expect(slugsForBackend("openai").every((s) => s.startsWith("openai/")), true);

  // --- defaultsForBackend with anthropic ---
  const anthropicDefaults = defaultsForBackend("anthropic");
  expect(anthropicDefaults.every((s) => s.startsWith("anthropic/")), true);
  expect(anthropicDefaults.length > 0, true);

  const writingModels = [...expectedWriting] as NonEmpty<LLMSlug>;
  const writingModelsWithGpt5 = ["openai/gpt-5", ...expectedWriting] as NonEmpty<LLMSlug>;

  expect(structuredModelsForBackend(writingModels, "openrouter"), [
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.5-sonnet",
    ...DEFAULT_LLM_SLUGS,
  ]);
  expect(structuredModelsForBackend(writingModelsWithGpt5, "openrouter"), [
    "openai/gpt-5",
    "anthropic/claude-sonnet-4.5",
    "anthropic/claude-sonnet-4",
    "anthropic/claude-3.5-sonnet",
    ...DEFAULT_LLM_SLUGS,
  ]);
  expect(structuredModelsForBackend(["anthropic/claude-sonnet-4"], "anthropic"), ["anthropic/claude-sonnet-4"]);
}

test();
