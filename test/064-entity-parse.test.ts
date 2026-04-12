import dedent from "dedent";
import { parseEntityBody, parseEntityRecordBody, parseLooseEntityItems, parseEntityRecordSpec } from "../eng/EntityParseHelpers";
import { expect, expectHas } from "./TestUtils";

function testParseLooseEntityItems() {
  const items = parseLooseEntityItems(dedent`
    @label: Apartment
    !shape: rect
    ~mood: smooth
    @~Believes in UFOs
    boundary: [[0, 0], [10, 0], [10, 8], [0, 8]]
    size: {x: 10, y: 20}
    pos: [2.2, 4.1, 0]
    angle: 20
    skybox: sky.png
    floor: {texture: parquet_oak.png}
    ceiling: {texture: plaster_white.png, height: 2.7}
    walls: [{texture: wall_a.png}, {texture: wall_b.png}]
    foo: |
      You're
      a cool
      person
    - a
    - b
    - c
    i love you
    you are great
  `);

  expect(items.length, 18);
  expectHas(items[0] as Record<string, unknown>, { key: "label", public: true, value: "Apartment" });
  expectHas(items[1] as Record<string, unknown>, { key: "shape", root: true, value: "rect" });
  expectHas(items[2] as Record<string, unknown>, { key: "mood", mutable: true, value: "smooth" });
  expectHas(items[3] as Record<string, unknown>, { value: "Believes in UFOs", public: true, mutable: true });
  expectHas(items[4] as Record<string, unknown>, { key: "boundary", value: [[0, 0], [10, 0], [10, 8], [0, 8]] });
  expectHas(items[5] as Record<string, unknown>, { key: "size", value: { x: 10, y: 20 } });
  expectHas(items[8] as Record<string, unknown>, { key: "skybox", value: "sky.png" });
  expectHas(items[9] as Record<string, unknown>, { key: "floor", value: { texture: "parquet_oak.png" } });
  expectHas(items[10] as Record<string, unknown>, { key: "ceiling", value: { texture: "plaster_white.png", height: 2.7 } });
  expectHas(items[11] as Record<string, unknown>, { key: "walls", value: [{ texture: "wall_a.png" }, { texture: "wall_b.png" }] });
  expectHas(items[12] as Record<string, unknown>, { key: "foo", value: "You're\na cool\nperson" });
  expectHas(items[13] as Record<string, unknown>, { value: "- a" });
  expectHas(items[17] as Record<string, unknown>, { value: "you are great" });
}

function testParseEntityBody() {
  const parsed = parseEntityBody(dedent`
    @label: Apartment
    !shape: rect
    ~mood: smooth
    @~Believes in UFOs
    boundary: [[0, 0], [10, 0], [10, 8], [0, 8]]
    size: {x: 10, y: 20}
    pos: [2.2, 4.1, 0]
    angle: 20
    skybox: sky.png
    floor: {texture: parquet_oak.png}
    ceiling: {texture: plaster_white.png, height: 2.7}
    walls: [{texture: wall_a.png}, {texture: wall_b.png}]
    foo: |
      You're
      a cool
      person
    - a
    - b
    - c
    i love you
    you are great
  `);

  expectHas(parsed.stats, {
    public: {
      label: "Apartment",
      facts: ["Believes in UFOs"],
    },
    space: {
      shape: "rect",
      boundary: [[0, 0], [10, 0], [10, 8], [0, 8]],
      size: { x: 10, y: 20 },
      pos: [2.2, 4.1, 0],
      angle: 20,
    },
    render: {
      skybox: "sky.png",
      floor: { texture: "parquet_oak.png" },
      ceiling: { texture: "plaster_white.png", height: 2.7 },
      walls: [{ texture: "wall_a.png" }, { texture: "wall_b.png" }],
    },
    private: {
      mood: "smooth",
      foo: "You're\na cool\nperson",
    },
  });
  expect(parsed.entries.filter((item) => item.mutable).map((item) => item.path), ["private.mood", "public.facts[]"]);
  expect(parsed.entries.filter((item) => item.path === "prompt[]").map((item) => item.value), ["- a", "- b", "- c", "i love you", "you are great"]);
}

function testParseEntityRecordBody() {
  const parsed = parseEntityRecordBody(dedent`
    @mood: calm
    drunk: 1
    place: ROOM
    rel: in
    sprite: trip.png
    i should be ignored here
  `) as Record<string, unknown>;

  expectHas(parsed, {
    public: {
      mood: "calm",
    },
    private: {
      drunk: 1,
    },
    location: {
      place: "ROOM",
      rel: "in",
    },
    render: {
      sprite: "trip.png",
    },
  });
  expect("persona" in parsed, false);
}

function testParseEntityRecordSpec() {
  const parsed = parseEntityRecordSpec(dedent`
    @~Believes in UFOs
    ~emotion: angry at Sam
    @mood: composed
  `);

  expectHas(parsed.stats, {
    public: {
      facts: ["Believes in UFOs"],
      mood: "composed",
    },
    private: {
      emotion: "angry at Sam",
    },
  });
  expect(parsed.entries.filter((item) => item.mutable).map((item) => item.path), ["public.facts[]", "private.emotion"]);
}

testParseLooseEntityItems();
testParseEntityBody();
testParseEntityRecordBody();
testParseEntityRecordSpec();
