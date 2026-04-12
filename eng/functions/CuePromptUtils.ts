import { JsonSchema } from "../../lib/CoreTypings";
import { isBlank } from "../../lib/TextHelpers";
import { LLMInstruction } from "../../lib/LLMTypes";
import { StoryEventContext } from "../Helpers";
import { buildPromptEntityDoc, readMutableEntryIds, renderEntityPromptBlock } from "./EntityEntryHelpers";
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
    "Consider your own authored entries (`you`), and the visible `people`, `things`, `places`, and recent `events`.",
    "Only change authored entries by returning explicit edits targeting entry ids.",
    "Use `replace` to revise an entry value and `remove` to delete an entry entirely.",
    "Do not invent ids. Use only ids shown in the prompt context.",
    "Determine how to act and react given the current visible world.",
    "You must return only strict JSON matching this schema:",
    JSON.stringify(schema, null, 2),
    'Return JSON with keys "edits" and "actions".',
    '"edits" is an array of entry edits for your own record only.',
    '"actions" is an array of in-world actions with keys "type", "to", and "body".',
    'Use type="say" for spoken dialogue; the body is your exact utterance.',
    "Use `to=[]` for general actions and directed targets only when clear.",
    "Keep actions minimal, concrete, and in character.",
    "If nothing meaningful changes, return empty arrays.",
    ...readMutableEntryNotes(entity.entries),
    ...localSystem,
  ];

  const user = [
    renderEntityPromptBlock(ctx.session, actor, pov),
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

export function buildEntityDialoguePrompt(actor: string, ctx: StoryEventContext): string {
  const doc = buildPromptEntityDoc(ctx.session, actor, actor);
  if (!doc) {
    return "";
  }
  return JSON.stringify(doc, null, 2);
}

function readMutableEntryNotes(entries: StoryEventContext["session"]["entities"][string]["entries"]) {
  const ids = readMutableEntryIds(entries);
  if (ids.length < 1) {
    return ["There are no mutable authored entries. Return no edits unless the script explicitly changes state elsewhere."];
  }
  return [
    `Only revise mutable entries when needed: ${ids.join(", ")}.`,
    "Treat non-mutable entries as authored context.",
  ];
}
