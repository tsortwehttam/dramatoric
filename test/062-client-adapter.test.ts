import {
  buildClientSnapshot,
  isClientEvent,
  StoryClientEventMessageSchema,
  StoryClientSnapshotMessageSchema,
  toClientEventMessage,
  toClientSnapshotMessage,
} from "../lib/ClientAdapter";
import { reifyEvent, reifySession, StoryEventType } from "../eng/Helpers";
import { expect, expectHas } from "./TestUtils";

function testSnapshotProjection() {
  const session = reifySession({
    mode: "text",
    time: 12,
    turns: 3,
    entities: {
      GRACE: {
        entries: [],
        stats: {
          kind: "person",
          public: {
            mood: "tense",
          },
          private: {
            goal: "be understood",
          },
          location: {
            place: "APARTMENT",
            rel: "by the bar",
          },
          space: {
            pos: [3, 2, 0],
            angle: 180,
          },
          render: {
            sprite: "grace_tense.png",
          },
        },
      },
    },
  });

  const snapshot = buildClientSnapshot(session);
  expectHas(snapshot, {
    mode: "text",
    time: 12,
    turns: 3,
    entities: {
      GRACE: {
        kind: "person",
        public: {
          mood: "tense",
        },
        location: {
          place: "APARTMENT",
          rel: "by the bar",
        },
        space: {
          pos: [3, 2, 0],
          angle: 180,
        },
        render: {
          sprite: "grace_tense.png",
        },
      },
    },
  });
  expect("private" in snapshot.entities.GRACE, false);
  expect("persona" in snapshot.entities.GRACE, false);

  const message = toClientSnapshotMessage(session);
  expect(StoryClientSnapshotMessageSchema.safeParse(message).success, true);
}

function testEventProjection() {
  const say = reifyEvent(
    {
      type: StoryEventType.$message,
      channel: "output",
      from: "TRIP",
      to: ["PLAYER"],
      value: "We're not arguing. We're entertaining.",
    },
    Math.random,
  );
  const move = reifyEvent(
    {
      type: "location.move",
      from: "GRACE",
      origin: "LIVING ROOM",
      destination: "KITCHEN",
    },
    Math.random,
  );
  const parsedInput = reifyEvent(
    {
      type: StoryEventType.$message,
      channel: "input",
      from: "PLAYER",
      value: "hello",
      raw: "hello",
    },
    Math.random,
  );

  expect(isClientEvent(say), true);
  expect(isClientEvent(move), true);
  expect(isClientEvent(parsedInput), false);

  const sayMessage = toClientEventMessage(say);
  const moveMessage = toClientEventMessage(move);
  const inputMessage = toClientEventMessage(parsedInput);

  expect(sayMessage != null, true);
  expect(moveMessage != null, true);
  expect(inputMessage, null);
  expect(StoryClientEventMessageSchema.safeParse(sayMessage).success, true);
  expect(StoryClientEventMessageSchema.safeParse(moveMessage).success, true);
}

testSnapshotProjection();
testEventProjection();
