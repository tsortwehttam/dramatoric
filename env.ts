import { config } from "dotenv";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

config({ path: join(dirname(fileURLToPath(import.meta.url)), ".env"), quiet: true });

export const ZEnvSchema = z.object({
  AUDIO_WS_PORT: z.string(),
  NODE_ENV: z.union([
    z.literal("development"),
    z.literal("production"),
    z.literal("test"),
  ]),
  ELEVENLABS_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  CACHE_LOCAL_DIR: z.string().optional(),
  CACHE_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  MOCK_PROVIDER: z.string().optional(),
});

export type Env = z.infer<typeof ZEnvSchema>;

export const loadEnv = (params: Partial<Env> = {}): Env => {
  try {
    return ZEnvSchema.parse({ ...process.env, ...params });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors
        .map((err) => err.path.join("."))
        .join(", ");
      throw new Error(
        `Missing or invalid environment variables: ${missingVars}`
      );
    }
    throw error;
  }
};
