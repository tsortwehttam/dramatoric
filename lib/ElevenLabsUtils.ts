import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import {
  MusicComposeRequestOutputFormat,
  TextToSoundEffectsConvertRequestOutputFormat,
  TextToSpeechConvertRequestOutputFormat,
  TextToVoiceDesignRequestOutputFormat,
} from "@elevenlabs/elevenlabs-js/api";
import { HOST } from "../eng/Helpers";
import { inferGenderFromName } from "./DialogHelpers";
import { NEUTRAL_VOICE } from "./ElevenLabsVoices";
import { LibraryVoiceSpec, StoryVoiceSpec } from "./VoiceHelpers";

const DEFAULT_OUTPUT_FORMAT = "mp3_44100_128" as const;

async function streamToUint8Array(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const total = chunks.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

export const composeTrack = async ({
  client,
  prompt,
  musicLengthMs,
  outputFormat = DEFAULT_OUTPUT_FORMAT as MusicComposeRequestOutputFormat,
  modelId = "music_v1",
}: {
  client: ElevenLabsClient;
  prompt: string;
  musicLengthMs: number;
  outputFormat?: MusicComposeRequestOutputFormat;
  modelId?: "music_v1";
}) => {
  const stream = await client.music.compose({
    prompt,
    musicLengthMs,
    modelId,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export const generateSoundEffect = async ({
  client,
  text,
  durationSeconds,
  promptInfluence = 0.3,
  loop = false,
  modelId = "eleven_text_to_sound_v2",
  outputFormat = DEFAULT_OUTPUT_FORMAT as TextToSoundEffectsConvertRequestOutputFormat,
}: {
  client: ElevenLabsClient;
  text: string;
  durationSeconds?: number;
  promptInfluence?: number;
  loop?: boolean;
  modelId?: string;
  outputFormat?: TextToSoundEffectsConvertRequestOutputFormat;
}) => {
  const stream = await client.textToSoundEffects.convert({
    text,
    durationSeconds,
    promptInfluence,
    loop,
    modelId,
    outputFormat,
  });
  return streamToUint8Array(stream);
};

export const generateSpeechClip = async ({
  client,
  voiceId,
  text,
  modelId = "eleven_v3",
  outputFormat = DEFAULT_OUTPUT_FORMAT as TextToSpeechConvertRequestOutputFormat,
  languageCode,
  seed,
}: {
  client: ElevenLabsClient;
  voiceId: string;
  text: string;
  modelId?: string;
  outputFormat?: TextToSpeechConvertRequestOutputFormat;
  languageCode?: string | null;
  seed?: number;
}) => {
  const stream = await client.textToSpeech.convert(voiceId, {
    text,
    modelId,
    outputFormat,
    languageCode: languageCode ?? undefined,
    seed,
  });
  return streamToUint8Array(stream);
};

export const generateVoiceFromPrompt = async ({
  client,
  voiceName,
  voiceDescription,
  modelId = "eleven_ttv_v3",
  text,
  autoGenerateText = true,
  outputFormat = "mp3_44100_192" as TextToVoiceDesignRequestOutputFormat,
  loudness = 0.5,
  guidanceScale = 5,
  quality,
  seed,
  referenceAudioBase64,
  promptStrength,
}: {
  client: ElevenLabsClient;
  voiceName: string;
  voiceDescription: string;
  modelId?: "eleven_multilingual_ttv_v2" | "eleven_ttv_v3";
  text?: string;
  autoGenerateText?: boolean;
  outputFormat?: TextToVoiceDesignRequestOutputFormat;
  loudness?: number;
  guidanceScale?: number;
  quality?: number | null;
  seed?: number;
  referenceAudioBase64?: string | null;
  promptStrength?: number | null;
}) => {
  const design = await client.textToVoice.design({
    voiceDescription,
    modelId,
    text: text ?? undefined,
    autoGenerateText,
    outputFormat,
    loudness,
    guidanceScale,
    quality: quality ?? undefined,
    seed,
    referenceAudioBase64: referenceAudioBase64 ?? undefined,
    promptStrength: promptStrength ?? undefined,
  });

  const preview = design.previews?.[0];
  if (!preview) throw new Error("No voice previews returned");
  const generatedVoiceId = preview.generatedVoiceId;

  const created = await client.textToVoice.create({
    voiceName,
    voiceDescription,
    generatedVoiceId,
  });

  return {
    voiceId: created.voiceId,
    generatedVoiceId,
  };
};

export const searchVoices = async ({
  client,
  search,
  voiceType,
  category,
  voiceIds,
  sort,
  sortDirection,
  pageSize,
  nextPageToken,
}: {
  client: ElevenLabsClient;
  search?: string;
  voiceType?: "personal" | "community" | "default" | "workspace" | "non-default";
  category?: "premade" | "cloned" | "generated" | "professional";
  voiceIds?: string[];
  sort?: "created_at_unix" | "name";
  sortDirection?: "asc" | "desc";
  pageSize?: number;
  nextPageToken?: string;
}) => {
  const response = await client.voices.search({
    search,
    voiceType,
    category,
    voiceIds,
    sort,
    sortDirection,
    pageSize,
    nextPageToken,
  });
  return response;
};

export type PartialSpeechSpec = {
  speaker: string | null;
  voice: string | null;
  tags: string[];
};

const TAG_WEIGHT_GROUPS: Array<[string[], number]> = [
  [["male", "female", "woman", "man", "boy", "girl"], 4],
  [
    [
      "british",
      "brit",
      "american",
      "american-english",
      "arab",
      "arabic",
      "australian",
      "aussie",
      "canadian",
      "chinese",
      "dutch",
      "french",
      "german",
      "hispanic",
      "latino",
      "latina",
      "indian",
      "irish",
      "italian",
      "japanese",
      "korean",
      "mexican",
      "norwegian",
      "polish",
      "portuguese",
      "russian",
      "scottish",
      "scots",
      "spanish",
      "swedish",
      "welsh",
    ],
    3,
  ],
  [["young", "old", "elderly", "teen", "child"], 2],
];

function getTagWeight(tag: string): number {
  const lowerTag = tag.toLowerCase();
  for (const [tags, weight] of TAG_WEIGHT_GROUPS) {
    if (tags.includes(lowerTag)) {
      return weight;
    }
  }
  return 1;
}

export function autoFindVoiceId(spec: Partial<StoryVoiceSpec>, voices: LibraryVoiceSpec[]): string {
  const tags = spec.tags || [];

  // id (or ref) match is highest precedence
  // ref is provided in case the external system had a different identifier for the same voice
  // id is always the elevenlabs voice id, ref is some external id
  for (let i = 0; i < voices.length; i++) {
    const id = voices[i].id;
    const ref = voices[i].ref;
    if (tags.includes(id) || (ref && tags.includes(ref))) {
      return id;
    }
  }

  // match by given speaker or find name match in tags
  for (let i = 0; i < voices.length; i++) {
    if (tags.includes(voices[i].name) || (spec.name && spec.name.toLowerCase() === voices[i].name.toLowerCase())) {
      return voices[i].id;
    }
  }

  // if given a name (but didn't match) try to guess its tags
  if (spec.name) {
    const gender = inferGenderFromName(spec.name);
    if (gender && !tags.includes(gender)) {
      tags.push(gender);
    }
  }

  // find best fit given weighted tag matches
  let bestMatch = null;
  let maxScore = 0;
  for (let i = 0; i < voices.length; i++) {
    const voice = voices[i];
    let score = 0;
    for (const voiceTag of voice.tags) {
      if (tags.some((t) => t.toLowerCase() === voiceTag.toLowerCase())) {
        score += getTagWeight(voiceTag);
      }
    }
    if (score > maxScore) {
      maxScore = score;
      bestMatch = voice;
    }
  }
  if (bestMatch) {
    return bestMatch.id;
  }
  if (spec.name && (spec.name.toLowerCase() === HOST.toLowerCase() || spec.name.toLowerCase() === "narrator")) {
    return NEUTRAL_VOICE;
  }
  return voices[0] ? voices[0].id : NEUTRAL_VOICE;
}
