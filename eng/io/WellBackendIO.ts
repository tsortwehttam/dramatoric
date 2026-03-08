import Anthropic from "@anthropic-ai/sdk";
import { S3Client } from "@aws-sdk/client-s3";
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import OpenAI from "openai";
import { join, sep } from "path";
import { cwd } from "process";
import { Env } from "../../env";
import { generateJsonWithSchema as anthropicGenerateJsonWithSchema } from "../../lib/AnthropicUtils";
import { Cache } from "../../lib/Cache";
import { autoFindVoiceId, composeTrack, generateSoundEffect, generateSpeechClip } from "../../lib/ElevenLabsUtils";
import { castToBoolean } from "../../lib/EvalCasting";
import { fetch } from "../../lib/HTTPHelpers";
import {
  ANTHROPIC_BASE_URL,
  defaultsForBackend,
  LLMBackend,
  normalizeModels,
  OPENAI_BASE_URL,
  OPENROUTER_BASE_URL,
} from "../../lib/LLMTypes";
import { LocalCache } from "../../lib/LocalCache";
import { generateJsonWithSchema } from "../../lib/OpenRouterUtils";
import { S3Cache } from "../../lib/S3Cache";
import { generatePredictableKey, isBlank, parameterize } from "../../lib/TextHelpers";
import { LibraryVoiceSpec } from "../../lib/VoiceHelpers";
import { IOFunc, IORequest, IOResult, StorySession } from "../Helpers";

function detectBackend(env: Env): { backend: LLMBackend; apiKey: string; baseURL: string } {
  if (env.OPENROUTER_API_KEY) {
    return {
      backend: "openrouter",
      apiKey: env.OPENROUTER_API_KEY,
      baseURL: env.OPENROUTER_BASE_URL || OPENROUTER_BASE_URL,
    };
  }
  if (env.ANTHROPIC_API_KEY) {
    return {
      backend: "anthropic",
      apiKey: env.ANTHROPIC_API_KEY,
      baseURL: ANTHROPIC_BASE_URL,
    };
  }
  if (env.OPENAI_API_KEY) {
    return {
      backend: "openai",
      apiKey: env.OPENAI_API_KEY,
      baseURL: OPENAI_BASE_URL,
    };
  }
  throw new Error("No LLM API key provided. Set OPENROUTER_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY.");
}

function resolveCacheDir(dirpath: string | null | undefined) {
  if (!dirpath || isBlank(dirpath)) {
    return join(cwd(), "tmp", "cache");
  }
  if (dirpath.startsWith(sep)) {
    return dirpath;
  }
  return join(cwd(), dirpath);
}

function createS3Client(env: Env): S3Client {
  if (env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY) {
    return new S3Client({
      credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return new S3Client();
}

function createCache(env: Env): Cache {
  if (env.CACHE_S3_BUCKET) {
    return new S3Cache(createS3Client(env), env.CACHE_S3_BUCKET);
  }
  return new LocalCache(resolveCacheDir(env.CACHE_LOCAL_DIR));
}

export type IOConfig = {
  pronunciations: Record<string, string>;
  voices: LibraryVoiceSpec[];
};

export function createIO(env: Env, config: Partial<IOConfig> = {}): IOFunc {
  if (castToBoolean(env.MOCK_PROVIDER)) {
    return createMockIO();
  }

  const cache = createCache(env);
  const { backend, apiKey, baseURL } = detectBackend(env);
  const isAnthropic = backend === "anthropic";
  const openai = isAnthropic ? null : new OpenAI({ apiKey, baseURL });
  const anthropic = isAnthropic ? new Anthropic({ apiKey, baseURL }) : null;
  const defaultModels = defaultsForBackend(backend);
  const eleven = env.ELEVENLABS_API_KEY ? new ElevenLabsClient({ apiKey: env.ELEVENLABS_API_KEY }) : null;
  const pronunciations = config.pronunciations ?? {};
  const voices = config.voices ?? [];

  console.info(`[io] Using ${backend} backend${eleven ? ", ElevenLabs enabled" : ""}`);

  return async <K extends IORequest["kind"]>(req: Extract<IORequest, { kind: K }>): Promise<IOResult<K>> => {
    switch (req.kind) {
      case "llm": {
        const r = req as Extract<IORequest, { kind: "llm" }>;
        const models = normalizeModels({ models: r.models }, undefined, defaultModels);
        const schemaStr = JSON.stringify(r.schema);
        const promptKey = JSON.stringify(r.instructions);
        const idemp = `${JSON.stringify(models)}:${promptKey}:${schemaStr}`;
        const key = generatePredictableKey("json", idemp, "json");

        const cached = await cache.get(key);
        if (cached) {
          return JSON.parse(cached.toString()) as IOResult<K>;
        }

        const result = anthropic
          ? await anthropicGenerateJsonWithSchema(anthropic, r.instructions, r.schema, models)
          : await generateJsonWithSchema(openai!, r.instructions, r.schema, models, backend);
        if (!result) {
          console.warn("[io] Failed to generate JSON");
          return null as IOResult<K>;
        }

        const buffer = Buffer.from(JSON.stringify(result, null, 2));
        await cache.set(key, buffer, "application/json");
        return result as IOResult<K>;
      }

      case "fetch": {
        const r = req as Extract<IORequest, { kind: "fetch" }>;
        console.info(`[io] Fetch ~> ${r.url}`);
        const res = await fetch({ method: "GET", url: r.url });
        return { status: res.statusCode, data: res.data, contentType: res.contentType } as IOResult<K>;
      }

      case "save": {
        const r = req as Extract<IORequest, { kind: "save" }>;
        const key = generatePredictableKey("session", r.uid, "json");
        const buffer = Buffer.from(JSON.stringify(r.session));
        await cache.set(key, buffer, "application/json");
        console.info(`[io] Saved session ~> ${r.uid}`);
        return undefined as IOResult<K>;
      }

      case "load": {
        const r = req as Extract<IORequest, { kind: "load" }>;
        const key = generatePredictableKey("session", r.uid, "json");
        const cached = await cache.get(key);
        if (cached) {
          console.info(`[io] Loaded session ~> ${r.uid}`);
          return JSON.parse(cached.toString()) as IOResult<K>;
        }
        console.info(`[io] Session not found ~> ${r.uid}`);
        return null as IOResult<K>;
      }

      case "speech": {
        if (!eleven) {
          throw new Error("ELEVENLABS_API_KEY required for speech generation");
        }
        const r = req as Extract<IORequest, { kind: "speech" }>;
        const voiceId = autoFindVoiceId(r.voice, voices);
        let text = r.text;
        for (const [k, v] of Object.entries(pronunciations)) {
          if (k) text = text.split(k).join(v);
        }
        const idemp = `${r.voice.name ?? "unk"}:${JSON.stringify(r.voice.tags)}:${parameterize(text)}:${voiceId}`;
        const key = generatePredictableKey("vox", idemp, "mp3");
        const cached = await cache.get(key);
        if (cached) {
          const url = await cache.set(key, cached, "audio/mpeg");
          return { url } as IOResult<K>;
        }
        const audio = await generateSpeechClip({ client: eleven, voiceId, text });
        const url = await cache.set(key, Buffer.from(audio), "audio/mpeg");
        return { url } as IOResult<K>;
      }

      case "sound": {
        if (!eleven) {
          throw new Error("ELEVENLABS_API_KEY required for sound generation");
        }
        const r = req as Extract<IORequest, { kind: "sound" }>;
        const idemp = `${r.prompt}:${r.durationMs}`;
        const key = generatePredictableKey("sfx", idemp, "mp3");
        const cached = await cache.get(key);
        if (cached) {
          const url = await cache.set(key, cached, "audio/mpeg");
          return { url } as IOResult<K>;
        }
        const audio = await generateSoundEffect({
          client: eleven,
          text: r.prompt,
          durationSeconds: Math.ceil(r.durationMs / 1000),
        });
        const url = await cache.set(key, Buffer.from(audio), "audio/mpeg");
        return { url } as IOResult<K>;
      }

      case "music": {
        if (!eleven) {
          throw new Error("ELEVENLABS_API_KEY required for music generation");
        }
        const r = req as Extract<IORequest, { kind: "music" }>;
        const idemp = `${r.prompt}:${r.durationMs}`;
        const key = generatePredictableKey("music", idemp, "mp3");
        const cached = await cache.get(key);
        if (cached) {
          const url = await cache.set(key, cached, "audio/mpeg");
          return { url } as IOResult<K>;
        }
        const audio = await composeTrack({
          client: eleven,
          prompt: r.prompt,
          musicLengthMs: r.durationMs,
        });
        const url = await cache.set(key, Buffer.from(audio), "audio/mpeg");
        return { url } as IOResult<K>;
      }

      case "image": {
        const r = req as Extract<IORequest, { kind: "image" }>;
        const idemp = r.prompt;
        const key = generatePredictableKey("img", idemp, "png");
        const cached = await cache.get(key);
        if (cached) {
          const url = await cache.set(key, cached, "image/png");
          return { url } as IOResult<K>;
        }
        if (!openai) {
          throw new Error("Image generation requires an OpenAI-compatible backend. Set OPENAI_API_KEY.");
        }
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: r.prompt,
          n: 1,
          size: "1024x1024",
          response_format: "b64_json",
        });
        const b64 = response.data?.[0]?.b64_json;
        if (!b64) {
          throw new Error("Image generation returned no data");
        }
        const buffer = Buffer.from(b64, "base64");
        const url = await cache.set(key, buffer, "image/png");
        return { url } as IOResult<K>;
      }

      case "video": {
        throw new Error("Video generation is not implemented in default IO. Provide a custom IOFunc for kind=video.");
      }

      default:
        throw new Error(`Unknown IO request kind: ${(req as IORequest).kind}`);
    }
  };
}

function createMockIO(): IOFunc {
  const sessions = new Map<string, StorySession>();

  return async <K extends IORequest["kind"]>(req: Extract<IORequest, { kind: K }>): Promise<IOResult<K>> => {
    switch (req.kind) {
      case "llm":
        return null as IOResult<K>;
      case "fetch":
        return { status: 200, data: "", contentType: "text/plain" } as IOResult<K>;
      case "save": {
        const r = req as Extract<IORequest, { kind: "save" }>;
        sessions.set(r.uid, r.session);
        return undefined as IOResult<K>;
      }
      case "load": {
        const r = req as Extract<IORequest, { kind: "load" }>;
        return (sessions.get(r.uid) ?? null) as IOResult<K>;
      }
      case "speech":
      case "sound":
      case "music":
      case "image":
      case "video":
        return { url: "mock://media" } as IOResult<K>;
      default:
        throw new Error(`Unknown IO request kind: ${(req as IORequest).kind}`);
    }
  };
}

/*
 * ============================================================================
 * UNUSED CODE - Preserved for future use (voice generation, chat, moderation)
 * ============================================================================

import { z } from "zod";
import { generateVoiceFromPrompt } from "../../lib/ElevenLabsUtils";
import { AIChatMessage } from "../../lib/OpenRouterHelpers";
import {
  generateChatResponse,
  generateJsonWithWeb,
  generateText,
  moderateInput,
} from "../../lib/OpenRouterUtils";

// generateText implementation
async function ioGenerateText(
  openai: OpenAI,
  cache: Cache,
  instructions: LLMInstruction[],
  models: [Model, ...Model[]],
  useWebSearch: boolean,
): Promise<string> {
  const promptKey = JSON.stringify(instructions);
  const idemp = `${JSON.stringify(models)}:${promptKey}`;
  const key = generatePredictableKey("text", idemp, "txt");
  const cached = await cache.get(key);
  if (cached) {
    return cached.toString();
  }
  const result = await generateText(openai, instructions, useWebSearch, models);
  if (!result) {
    return "";
  }
  const buffer = Buffer.from(result);
  await cache.set(key, buffer, "text/plain");
  return result;
}

// generateVoice implementation
async function ioGenerateVoice(
  eleven: ElevenLabsClient,
  cache: Cache,
  prompt: string,
): Promise<{ id: string }> {
  const idemp = prompt;
  const key = generatePredictableKey("voice", idemp, "txt");
  const cached = await cache.get(key);
  if (cached) {
    return { id: cached.toString() };
  }
  const base = key.split("/").pop() || "voice";
  const name = `Voice ${base.replace(/\.[^.]+$/, "")}`;
  const res = await generateVoiceFromPrompt({
    client: eleven,
    voiceName: name,
    voiceDescription: prompt,
  });
  const buf = Buffer.from(res.voiceId);
  await cache.set(key, buf, "text/plain");
  return { id: res.voiceId };
}

// generateChat implementation
async function ioGenerateChat<T>(
  openai: OpenAI,
  cache: Cache,
  messages: AIChatMessage[],
  models: [Model, ...Model[]],
  schema?: z.ZodType<T>,
): Promise<AIChatMessage | T | null> {
  const schemaKey = schema ? JSON.stringify(schema._def) : "";
  const idemp = JSON.stringify(messages) + schemaKey;
  const key = generatePredictableKey("chat", idemp, "json");
  const cached = await cache.get(key);
  if (cached) {
    return JSON.parse(cached.toString());
  }
  if (schema) {
    const response = await generateChatResponse<T>(openai, messages, models, schema);
    if (response) {
      const buffer = Buffer.from(JSON.stringify(response, null, 2));
      await cache.set(key, buffer, "application/json");
    }
    return response;
  }
  const response = await generateChatResponse(openai, messages, models);
  const responseMessage: AIChatMessage = {
    role: "assistant",
    body: response,
  };
  const buffer = Buffer.from(JSON.stringify(responseMessage, null, 2));
  await cache.set(key, buffer, "application/json");
  return responseMessage;
}

*/
