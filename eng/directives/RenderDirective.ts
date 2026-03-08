import { castToArray, castToString } from "../../lib/EvalCasting";
import { parseDurationToMs } from "../../lib/TextHelpers";
import { readBody } from "../Execution";
import { ENGINE, RENDER_TYPE, StoryDirectiveFuncDef, StoryEventType } from "../Helpers";

export const RENDER_directive: StoryDirectiveFuncDef = {
  type: [RENDER_TYPE],
  func: async (node, ctx, pms) => {
    const kind = castToString(pms.pairs.kind ?? pms.artifacts[0] ?? "").trim().toLowerCase();
    if (!kind) {
      console.warn("RENDER requires kind (speech, sound, music, image, video)");
      return;
    }
    const body = await readBody(node, ctx);

    if (kind === "speech") {
      const text = castToString(pms.pairs.text ?? body).trim();
      if (!text) {
        console.warn("RENDER speech requires text");
        return;
      }
      const name = castToString(pms.pairs.voice ?? pms.pairs.name ?? "NARRATOR").trim() || "NARRATOR";
      const id = castToString(pms.pairs.voiceId ?? name).trim() || name;
      const tags = castToArray(pms.pairs.tags ?? []).map(castToString).filter((tag) => !!tag);
      const out = await ctx.io({ kind: "speech", text, voice: { name, id, tags } });
      ctx.emit({
        type: StoryEventType.$media,
        channel: "output",
        from: ENGINE,
        value: text,
        url: out.url,
      });
      return [{ kind, url: out.url, text, voice: { name, id, tags } }];
    }

    if (kind === "sound" || kind === "music") {
      const prompt = castToString(pms.pairs.prompt ?? body).trim();
      if (!prompt) {
        console.warn(`RENDER ${kind} requires prompt`);
        return;
      }
      const durationMs = parseDuration(pms.pairs.duration, 5_000);
      const out = await ctx.io({ kind, prompt, durationMs });
      ctx.emit({
        type: StoryEventType.$media,
        channel: "output",
        from: ENGINE,
        value: prompt,
        url: out.url,
        duration: durationMs,
      });
      return [{ kind, url: out.url, prompt, durationMs }];
    }

    if (kind === "image") {
      const prompt = castToString(pms.pairs.prompt ?? body).trim();
      if (!prompt) {
        console.warn("RENDER image requires prompt");
        return;
      }
      const out = await ctx.io({ kind: "image", prompt });
      ctx.emit({
        type: StoryEventType.$media,
        channel: "output",
        from: ENGINE,
        value: prompt,
        url: out.url,
      });
      return [{ kind, url: out.url, prompt }];
    }

    if (kind === "video") {
      const prompt = castToString(pms.pairs.prompt ?? body).trim();
      if (!prompt) {
        console.warn("RENDER video requires prompt");
        return;
      }
      const durationMs = parseDuration(pms.pairs.duration, 5_000);
      const format = castToString(pms.pairs.format ?? "mp4").trim() || "mp4";
      const assets = castToArray(pms.pairs.assets ?? pms.pairs.inputs ?? [])
        .map(castToString)
        .filter((entry) => !!entry);
      const out = await ctx.io({ kind: "video", prompt, durationMs, format, assets });
      ctx.emit({
        type: StoryEventType.$media,
        channel: "output",
        from: ENGINE,
        value: prompt,
        url: out.url,
        duration: durationMs,
      });
      return [{ kind, url: out.url, prompt, durationMs, format, assets }];
    }

    console.warn(`RENDER unsupported kind "${kind}"`);
  },
};

function parseDuration(value: unknown, fallback: number): number {
  const raw = castToString(value ?? "").trim();
  if (!raw) {
    return fallback;
  }
  const duration = parseDurationToMs(raw);
  return duration ?? fallback;
}
