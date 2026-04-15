# DX Plan

## Intent

This note captures the current target authoring direction for Dramatoric's spatial/presentational model.

The goal is to keep the engine's world model small, explicit, and renderer-agnostic while making authoring feel centered on authored drama rather than low-level scene graph plumbing.

The current direction is:

- `anchor` is the core spatial primitive
- `ATTACH` and `DETACH` are explicit world-state operations
- `ACTION` is the core behavior primitive
- `require` gates whether an action can run
- actions may emit dialogue, mutate state, and perform attachment transitions

Important constraints:

- anchors are named local transforms, not validators
- anchors do not carry `accepts` in the core runtime model
- attachment correctness is author-driven, not inferred from generic compatibility rules
- actions define behavior; anchors define spatial reference points
- `ROOM`, `WALL`, `PERSON`, and similar constructs can still be sugar later, but should lower to one consistent underlying model

This keeps the runtime model simple while preserving room for higher-level DSL sugar later.

## Example Scene

```dram
SCENE: One Room

CLASS: ROOM DO
  kind: place

  size: [4, 3, 4]

  anchor.north_wall: [0, 1.5, -2]; [0, 0, 0]
  anchor.south_wall: [0, 1.5, 2]; [0, 180, 0]
  anchor.east_wall: [2, 1.5, 0]; [0, -90, 0]
  anchor.west_wall: [-2, 1.5, 0]; [0, 90, 0]

  anchor.player_spawn: [0, 0, 1.2]; [0, 180, 0]
  anchor.tom_spawn: [0, 0, -0.8]; [0, 0, 0]
  anchor.pen_spot: [0.7, 0, -0.1]; [0, 25, 0]
END

CLASS: WALL DO
  kind: thing

  size: [4, 3, 0.1]

  anchor.foot: [0, -1.5, 0]; [0, 0, 0]
  anchor.picture: [0, 0.1, 0.06]; [0, 0, 0]
END

CLASS: PERSON DO
  kind: person

  anchor.feet: [0, -0.9, 0]; [0, 0, 0]
  anchor.hand: [0.25, 0.2, 0.1]; [0, 0, 0]
  anchor.talk: [0, 0, 0.8]; [0, 180, 0]
END

CLASS: PICTURE DO
  kind: thing

  size: [0.8, 0.6, 0.04]

  anchor.mount: [0, 0, 0]; [0, 0, 0]

  ACTION: look DO
    require: near PLAYER 2.0

    HOST:
    It is a framed black-and-white landscape.
    The glass is slightly cracked.
  END
END

CLASS: PEN DO
  kind: thing

  size: [0.14, 0.02, 0.02]

  anchor.rest: [0, 0, 0]; [0, 0, 0]
  anchor.grip: [0, 0, 0]; [0, 0, 0]

  ACTION: look DO
    require: near PLAYER 1.5

    HOST:
    It is a blue ballpoint pen with a cracked cap.
  END

  ACTION: pickup DO
    require: near PLAYER 1.5
    require: stat("PEN_1", "location.place") != "PLAYER"

    DETACH: PEN_1
    ATTACH: PEN_1.grip -> PLAYER.hand
    SET: _ {{applyPatches("PEN_1", [
      { op: "set", path: "location.place", value: "PLAYER" },
      { op: "set", path: "location.rel", value: "held" }
    ])}}

    HOST:
    You pick up the pen.
  END
END

ENTITY<ROOM>: ROOM_1

ENTITY<WALL>: WALL_NORTH
ENTITY<WALL>: WALL_SOUTH
ENTITY<WALL>: WALL_EAST
ENTITY<WALL>: WALL_WEST

ATTACH: WALL_NORTH.foot -> ROOM_1.north_wall
ATTACH: WALL_SOUTH.foot -> ROOM_1.south_wall
ATTACH: WALL_EAST.foot -> ROOM_1.east_wall
ATTACH: WALL_WEST.foot -> ROOM_1.west_wall

ENTITY<PERSON>: PLAYER DO
  @label: You
END

ATTACH: PLAYER.feet -> ROOM_1.player_spawn

ENTITY<PERSON>: TOM DO
  @label: Tom

  ACTION: talk DO
    require: near PLAYER 2.0

    TOM:
    I'm Tom.
    Ask what you want.
  END
END

ATTACH: TOM.feet -> ROOM_1.tom_spawn

ENTITY<PICTURE>: PICTURE_1 DO
  @label: Framed Picture
END

ATTACH: PICTURE_1.mount -> WALL_NORTH.picture

ENTITY<PEN>: PEN_1 DO
  @label: Pen
  location.place: ROOM_1
  location.rel: on floor
END

ATTACH: PEN_1.rest -> ROOM_1.pen_spot

ONCE: DO
  HOST:
  You are in a small square room.
  Tom is standing across from you.
  A framed picture hangs on the north wall.
  A pen lies on the floor.
END
```

## Core Semantics

- `anchor`: a named local transform on an entity
- `ATTACH: A.x -> B.y`: bind entity `A` to entity `B` by aligning anchor `x` to anchor `y`
- `DETACH: A`: remove `A` from its current attachment
- `ACTION`: a named affordance an entity supports
- `require`: a predicate that must hold for an action to run

Action bodies may emit dialogue, mutate state, and perform `ATTACH` / `DETACH` transitions.
