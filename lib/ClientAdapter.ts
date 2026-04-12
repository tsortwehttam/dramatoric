import z from "zod";
import { SerialValue } from "./CoreTypings";
import { ActSchema, StoryEvent, StoryEventType, StorySession } from "../eng/Helpers";
import { projectEntitySnapshot } from "../eng/functions/WorldFunctions";

const SerialValueSchema: z.ZodType<SerialValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(SerialValueSchema), z.record(SerialValueSchema)]),
);

const SerialRecordSchema = z.record(SerialValueSchema);

export const StoryClientEntitySchema = z.object({
  kind: z.string().nullable(),
  public: SerialRecordSchema.nullable(),
  location: SerialRecordSchema.nullable(),
  space: SerialRecordSchema.nullable(),
  render: SerialRecordSchema.nullable(),
});

export type StoryClientEntity = z.infer<typeof StoryClientEntitySchema>;

export const StoryClientSnapshotSchema = z.object({
  mode: z.union([z.literal("text"), z.literal("audio")]),
  player: z.object({
    id: z.string(),
    label: z.string(),
  }),
  time: z.number(),
  turns: z.number(),
  entities: z.record(StoryClientEntitySchema),
});

export type StoryClientSnapshot = z.infer<typeof StoryClientSnapshotSchema>;

export const StoryEventSchema: z.ZodType<StoryEvent> = z.object({
  id: z.string(),
  created: z.number(),
  processed: z.number(),
  rendered: z.number(),
  captured: z.number(),
  act: ActSchema,
  channel: z.union([z.literal("input"), z.literal("output"), z.literal("emit"), z.literal("engine"), z.literal("other")]),
  type: z.string(),
  from: z.string(),
  to: z.array(z.string()),
  origin: z.string().nullable(),
  destination: z.string().nullable(),
  obs: z.array(z.string()),
  excl: z.array(z.string()),
  value: z.string(),
  raw: z.string(),
  result: SerialValueSchema,
  tags: z.array(z.string()),
  priority: z.number(),
  scene: z.string().nullable(),
  ante: z.string().nullable(),
  voice: z.string().nullable(),
  url: z.string().nullable(),
  background: z.number(),
  duration: z.number(),
  loop: z.number(),
  volume: z.number(),
});

export const StoryClientSnapshotMessageSchema = z.object({
  type: z.literal("session_snapshot"),
  snapshot: StoryClientSnapshotSchema,
});

export type StoryClientSnapshotMessage = z.infer<typeof StoryClientSnapshotMessageSchema>;

export const StoryClientEventMessageSchema = z.object({
  type: z.literal("story_event"),
  event: StoryEventSchema,
});

export type StoryClientEventMessage = z.infer<typeof StoryClientEventMessageSchema>;

export const StoryClientMessageSchema = z.union([StoryClientSnapshotMessageSchema, StoryClientEventMessageSchema]);

export type StoryClientMessage = z.infer<typeof StoryClientMessageSchema>;

const CLIENT_EVENT_TYPES = new Set<string>([
  StoryEventType.$entity,
  StoryEventType.$exit,
  StoryEventType.$media,
  StoryEventType.$message,
  StoryEventType.$wait,
  "location.enter",
  "location.exit",
  "location.move",
]);

export function buildClientEntity(stats: Record<string, SerialValue>): StoryClientEntity {
  return {
    kind: typeof stats.kind === "string" ? stats.kind : null,
    public: asSerialRecord(stats.public),
    location: asSerialRecord(stats.location),
    space: asSerialRecord(stats.space),
    render: asSerialRecord(stats.render),
  };
}

export function buildClientSnapshot(session: StorySession): StoryClientSnapshot {
  const entities: Record<string, StoryClientEntity> = {};
  for (const name in session.entities) {
    const projected = projectEntitySnapshot(session, name, {
      observer: null,
      includePrivate: false,
      includeSpace: true,
      includeRender: true,
      includeExtra: false,
    });
    const record = (projected && typeof projected === "object" && !Array.isArray(projected)
      ? projected
      : {}) as Record<string, SerialValue>;
    entities[name] = buildClientEntity(record);
  }

  return {
    mode: session.mode,
    player: session.player,
    time: session.time,
    turns: session.turns,
    entities,
  };
}

export function isClientEvent(event: StoryEvent): boolean {
  if (CLIENT_EVENT_TYPES.has(event.type)) {
    return event.channel !== "input" || event.type !== StoryEventType.$message;
  }
  return !event.type.startsWith("$") && event.channel !== "input";
}

export function toClientEventMessage(event: StoryEvent): StoryClientEventMessage | null {
  if (!isClientEvent(event)) {
    return null;
  }
  return {
    type: "story_event",
    event,
  };
}

export function toClientSnapshotMessage(session: StorySession): StoryClientSnapshotMessage {
  return {
    type: "session_snapshot",
    snapshot: buildClientSnapshot(session),
  };
}

function asSerialRecord(value: SerialValue | undefined): Record<string, SerialValue> | null {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    return null;
  }
  return value as Record<string, SerialValue>;
}
