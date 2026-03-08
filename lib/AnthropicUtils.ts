import Anthropic from "@anthropic-ai/sdk";
import { JsonSchema, NonEmpty } from "./CoreTypings";
import { safeJsonParse } from "./JSONAndYAMLHelpers";
import { LLM_SLUGS, LLMInstruction, toDirectSlug } from "./LLMTypes";

type AnthropicModel = (typeof LLM_SLUGS)[number];

function prepModel(models: NonEmpty<AnthropicModel>): string {
  const slugs = models.map((m) => toDirectSlug(m, "anthropic")).filter((m): m is string => m !== null);
  if (slugs.length === 0) {
    throw new Error("No compatible models for anthropic backend");
  }
  return slugs[0];
}

function splitInstructions(instructions: LLMInstruction[]): {
  system: string;
  messages: Anthropic.MessageParam[];
} {
  const systemParts: string[] = [];
  const messages: Anthropic.MessageParam[] = [];
  for (const inst of instructions) {
    if (inst.role === "system") {
      systemParts.push(inst.content);
    } else {
      messages.push({ role: "user", content: inst.content });
    }
  }
  if (messages.length === 0) {
    messages.push({ role: "user", content: "" });
  }
  return { system: systemParts.join("\n\n"), messages };
}

function readText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function extractJsonFromText(text: string): string {
  const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (match) return match[1].trim();
  const braceMatch = text.match(/\{[\s\S]*\}/);
  if (braceMatch) return braceMatch[0];
  return text;
}

export async function generateText(
  client: Anthropic,
  instructions: LLMInstruction[],
  models: NonEmpty<AnthropicModel>,
): Promise<string> {
  const model = prepModel(models);
  const { system, messages } = splitInstructions(instructions);
  const r = await client.messages.create({
    model,
    max_tokens: 4096,
    ...(system ? { system } : {}),
    messages,
  });
  return readText(r);
}

export async function generateJson(
  client: Anthropic,
  instructions: LLMInstruction[],
  schema: Record<string, unknown>,
  models: NonEmpty<AnthropicModel>,
): Promise<Record<string, unknown>> {
  const preface = [
    "Follow the user's prompt.",
    "Return ONLY a valid JSON object.",
    "This schema describes the expected output shape:",
    JSON.stringify(schema, null, 2),
  ].join(" ");

  const { system: existingSystem, messages } = splitInstructions(instructions);
  const system = existingSystem ? `${preface}\n\n${existingSystem}` : preface;

  const model = prepModel(models);
  const r = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    messages,
  });
  const txt = extractJsonFromText(readText(r)) || "{}";
  return JSON.parse(txt);
}

export async function generateJsonWithSchema<T = Record<string, unknown>>(
  client: Anthropic,
  instructions: LLMInstruction[],
  schema: JsonSchema,
  models: NonEmpty<AnthropicModel>,
): Promise<T | null> {
  const model = prepModel(models);
  const { system: existingSystem, messages } = splitInstructions(instructions);

  const systemParts = [
    "Return ONLY valid JSON matching this schema:",
    JSON.stringify(schema, null, 2),
  ];
  if (existingSystem) systemParts.unshift(existingSystem);
  const system = systemParts.join("\n\n");

  const r = await client.messages
    .create({
      model,
      max_tokens: 4096,
      system,
      messages,
    })
    .catch((err) => {
      console.warn("Failed to generate structured JSON", err);
      return null;
    });

  if (!r) return null;

  const txt = extractJsonFromText(readText(r));
  const data = safeJsonParse(txt);
  if (!data) {
    console.warn("Structured response was not valid JSON");
    return null;
  }
  return data as T;
}
