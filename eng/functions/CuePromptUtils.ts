import yaml from "js-yaml";
import { JsonSchema, SerialValue } from "../../lib/CoreTypings";
import { castToString, isRecord } from "../../lib/EvalCasting";
import { isBlank } from "../../lib/TextHelpers";
import { LLMInstruction } from "../../lib/LLMTypes";
import { StoryEventContext } from "../Helpers";
import { getEntityPov } from "./WorldFunctions";

export function buildCuePromptInstructions(
  actor: string,
  ctx: StoryEventContext,
  schema: JsonSchema,
  local: LLMInstruction[],
): LLMInstruction[] {
  const entity = ctx.session.entities[actor];
  if (!entity) {
    return local;
  }

  const pov = getEntityPov(ctx.session, actor);
  const localSystem = local.filter((item) => item.role === "system").map((item) => item.content.trim()).filter(Boolean);
  const localUser = local.filter((item) => item.role === "user").map((item) => item.content.trim()).filter(Boolean);
  const info: string[] = [
    `You are ${actor}. Respond in character as ${actor}.`,
    "Consider your persona (`you`), and the visible `people`, `things`, `places`, and recent `events`.",
    "Update your own durable state only when something genuinely changes.",
    "Determine how to act and react given the current visible world.",
    "You must return only strict JSON matching this schema:",
    JSON.stringify(schema, null, 2),
    'Return JSON with keys "state" and "actions".',
    '"state" is a partial durable update for your own record only.',
    '"actions" is an array of in-world actions with keys "type", "to", and "body".',
    'Use type="say" for spoken dialogue; the body is your exact utterance.',
    "Use `to=[]` for general actions and directed targets only when clear.",
    "Keep actions minimal, concrete, and in character.",
    "If nothing meaningful changes, return empty objects/arrays.",
    ...localSystem,
  ];

  const user = [
    entityToPersonaDoc(actor, entity.persona, pov),
    ...localUser,
    `React to the situation as ${actor} and respond with JSON.`,
  ]
    .filter((part) => !isBlank(part))
    .join("\n\n");

  return [
    { role: "system", content: info.join("\n") },
    { role: "user", content: user },
  ];
}

function entityToPersonaDoc(actor: string, persona: string, pov: SerialValue) {
  const record = isRecord(pov) ? (pov as Record<string, SerialValue>) : {};
  const you = readMap(record.you);
  const people = readNamedMap(record.people);
  const things = readNamedMap(record.things);
  const places = readNamedMap(record.places);
  const events = Array.isArray(record.events)
    ? record.events.map((item) => eventToPromptFrag(item)).filter((item) => !isBlank(item))
    : [];
  const doc = {
    you: {
      name: actor,
      persona,
      ...you,
    },
    people,
    things,
    places,
    events,
  };
  return yaml.dump(doc, { lineWidth: -1, noRefs: true }).trim();
}

function readMap(value: SerialValue): Record<string, SerialValue> {
  return isRecord(value) ? ({ ...(value as Record<string, SerialValue>) } as Record<string, SerialValue>) : {};
}

function readNamedMap(value: SerialValue) {
  if (!Array.isArray(value)) {
    return {};
  }
  const out: Record<string, Record<string, SerialValue>> = {};
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (!isRecord(item)) {
      continue;
    }
    const record = { ...(item as Record<string, SerialValue>) };
    const name = castToString(record.name ?? "").trim();
    if (!name) {
      continue;
    }
    delete record.name;
    out[name] = record;
  }
  return out;
}

function eventToPromptFrag(value: SerialValue) {
  if (!isRecord(value)) {
    return "";
  }
  const event = value as Record<string, SerialValue>;
  const from = castToString(event.from ?? "").trim();
  const body = castToString(event.value ?? "").trim();
  if (!from && !body) {
    return "";
  }
  return `${from}: ${body}`.trim();
}
