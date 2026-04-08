# Apr 9 Plan: World-State POV and Agentic Entity Steps

## Goal

Add the minimum general-purpose primitives needed to author a spatial-social simulation like `juryroom` inside Dramatoric without creating a separate sub-language that only fits one style of game.

The target outcome is:

- Dramatoric keeps its current event-driven story model
- `SCENE` remains narrative flow control, not world topology
- `ENTITY` expands cleanly to support typed world entities and visibility-aware state
- authors can derive per-entity POV context from shared world state
- authors can use normal `LLM`, `IF`, `ON`, `RUN`, templates, and interpolation with that POV
- any ergonomics added later are sugar over those primitives

## Principles

- Prefer extending existing Dramatoric primitives over adding a separate simulation DSL
- Keep world state and narrative flow distinct
- Add reusable concepts, not juryroom-specific mechanics
- Make POV/visibility available as data/functions first, syntax second
- Use schema-backed structured LLM output wherever state mutation is involved
- Ensure new concepts interoperate with `ENTITY`, `LLM`, `IF`, `CASE`, `ON`, `EMIT`, templates, and `{{ }}`

## Scope

### In scope

- Expand `ENTITY` authoring to support world-state fields
- Add world-space helpers for location and visibility
- Add POV/context projection helpers
- Add patch application helpers for structured LLM results
- Add transition/event emission for location changes
- Add docs and tests

### Out of scope for first pass

- A new `ROOM:` directive
- A custom NPC simulation mini-language
- Hardcoded juryroom response schemas
- Full geometry/line-of-sight simulation
- Replacing current `SCENE` / `GOTO` semantics

## Proposed Model

### Narrative flow vs world topology

Keep the distinction explicit:

- `SCENE`: narrative jump target used by `GOTO`
- `place`: world entity kind used for containment/location

Do not overload `SCENE` to mean room/location.

### Entity shape

Extend `ENTITY` bodies to support a structured world-state form like:

```dramatoric
ENTITY: ALICE DO
  kind: person
  persona: You are Alice, a skeptical juror.
  public:
    mood: guarded
  private:
    goal: get home
    belief: the defendant may be innocent
  location:
    place: JURY ROOM
    rel: in
END
```

Notes:

- Keep `persona` as the canonical author-facing field
- Continue supporting raw body text as persona-only shorthand
- Keep current stat access patterns working
- Treat `public`, `private`, `location`, and `kind` as reserved structured keys with defined semantics
- Preserve flexibility for arbitrary fields beyond these

### POV projection

Add runtime support for deriving the visible subjective context for a given entity.

Initial API target:

- `pov(name)`
- `visibleTo(observer, target)`
- `loc(name)`
- `coLocated(a, b)`

The projected POV object should include:

- `you`
- `people`
- `things`
- `places` if useful
- `events`

Filtering rules for first pass:

- self sees own `public` and `private`
- others expose only `public`
- visibility is determined by containment/location overlap, not just direct equality
- observed events are filtered by location overlap and time overlap where available

### Structured action/state loop

Support authoring patterns where a character reacts via LLM with structured output.

First-class engine support should be utilities plus a documented pattern, not necessarily a new directive on day one.

Initial authoring target:

```dramatoric
view = SET: {{pov("ALICE")}}

step = LLM: PARSE DO
  SYSTEM PROMPT:
  {{entityPrompt("ALICE")}}

  USER PROMPT:
  {{toYaml(view)}}

  SCHEMA: DO
    actions[]:
      to[]: string
      type: string
      body: string
    patches[]:
      op: set | del
      path: string
      value: any
  END
END
```

Then apply:

- `patches` to entity/world state
- `actions` as emitted events/messages

If this pattern proves solid, add sugar later:

- `STEP: ALICE DO ... END`
- `ACT: ALICE DO ... END`

## Phases

## Phase 1: Clarify Existing Semantics

### Work

- Update docs to define `SCENE` more narrowly as narrative flow
- Add documentation introducing `place` as a world entity kind, not a directive
- Standardize docs on `persona` terminology
- Demote `modus` to internal/legacy wording only

### Deliverables

- README updates
- directives reference updates
- architecture docs updates

## Phase 2: Expand `ENTITY` for World State

### Work

- Extend `ENTITY` parsing semantics for structured world-state keys:
  - `kind`
  - `public`
  - `private`
  - `location`
  - optionally `locations` / `locs`
- Decide merge semantics for redeclaration:
  - shallow merge on `public` and `private`
  - replace-or-merge strategy for `location`
  - replace persona when explicitly supplied
- Preserve current access through session entity registry

### Open questions

- Whether to call the type field `kind` or `type`
  - Recommendation: use `kind` to avoid confusion with node/directive `type`
- Whether `location` history should be implicit engine-maintained state or author-managed
  - Recommendation: current location explicit, history engine-maintained if movement helpers are introduced

### Tests

- `ENTITY` with structured world-state body
- merge behavior across redeclarations
- raw persona shorthand still works
- `public` and `private` remain distinct

## Phase 3: Add World-State Helper Functions

### Work

Add evaluator helpers and shared utilities for:

- `entity(name)`
- `hasEntity(name)`
- `loc(name)`
- `visibleTo(observer, target)`
- `coLocated(a, b)`
- `pov(name)`

Internally, implement shared logic for:

- location normalization
- containment traversal
- overlap tests
- event visibility filtering

### Design note

This should live as shared engine/runtime helpers, not be embedded ad hoc into one directive.

### Tests

- same-room visibility
- nested containment visibility
- self sees private fields
- others do not
- visible events filtered correctly

## Phase 4: Add Patch/Application Utilities

### Work

Add a general patch application facility for structured LLM output.

Initial target:

- `applyPatches(entityName, patches)`
- path validation limited to allowed world-state paths
- prohibit patching arbitrary engine internals

Potential path style:

- `public.mood`
- `private.goal`
- `location.place`

Avoid exposing raw session internals through patch paths.

### Tests

- set patch updates allowed field
- del patch removes allowed field
- invalid paths rejected or ignored predictably
- private/public paths behave correctly

## Phase 5: Add Structured Action Emission Helpers

### Work

Add utilities for turning structured action outputs into ordinary Dramatoric events.

Initial target:

- `emitActions(actorName, actions)`
- map `say` to story message/output event flow
- map other action types to emitted internal events with consistent payloads

This keeps action handling compatible with existing `ON:` handlers.

### Tests

- `say` becomes dialogue/message event
- non-say actions emit consistent typed events
- recipients/targets preserved

## Phase 6: Add Transition Events for Movement

### Work

When entity location changes, emit derived events such as:

- `$enter`
- `$exit`
- `$arrive`
- `$depart`

Possibly with payload fields:

- `entity`
- `from`
- `to`
- `rel`

These should be normal events that `ON:` can match.

### Design note

Do not add dedicated room-transition syntax first. Make movement observable through ordinary events.

### Tests

- movement emits enter/exit events
- handlers can react with `ON: $enter DO`
- no duplicate transition events on no-op move

## Phase 7: Document the Canonical Agent Loop

### Work

Add an end-to-end example showing:

- define place/person/thing entities
- move entities
- derive POV
- call `LLM: PARSE`
- apply patches
- emit actions
- react to movement and action events

This should be the official path for building a `juryroom`-style game without introducing separate syntax.

### Deliverables

- README section
- directives/functions reference additions
- one example `.dram` file

## Phase 8: Evaluate Optional Sugar

Only after the function-first workflow feels solid.

Potential sugar:

- `LOCATE: ALICE in JURY ROOM`
- `PATCH: ALICE.public.mood "irritated"`
- `STEP: ALICE DO ... END`

Criteria for adding sugar:

- must reduce repetition materially
- must desugar into the primitive model cleanly
- must compose with existing Dramatoric syntax
- must not introduce a parallel authoring style

## Naming Recommendations

### Keep

- `ENTITY`
- `SCENE`
- `GOTO`
- `RUN`

### Clarify

- `SCENE` docs should explicitly say "narrative passage / jump target"
- add docs/examples that use `kind: place` inside `ENTITY`

### Prefer

- `persona` over `modus`
- `kind` over `type` for entity category
- `POV` or `VIEW` over `KNOWLEDGE`
- `LOCATE` over `MOVE` if syntax sugar is added

### Avoid

- `ROOM` as a core directive
- `KNOWLEDGE` as the primary POV primitive
- overloading `SCENE` to mean physical room

## Initial File/Module Candidates

- `eng/directives/EntityDirective.ts`
- `eng/functions/UnifiedFunctions.ts`
- new shared helper file for world-state visibility logic, likely under `eng/` or `lib/`
- `docs/directives-reference.md`
- `docs/architecture.md`
- `README.md`
- tests:
  - new entity/world-state tests
  - new POV/visibility tests
  - new patch/action tests
  - transition event tests

## Suggested First Milestone

Implement the smallest demonstrable vertical slice:

1. `ENTITY` supports `kind`, `public`, `private`, `location`
2. `pov(name)` returns filtered subjective context
3. `applyPatches(name, patches)` updates allowed fields
4. example script uses `LLM: PARSE` to react as one character

This is enough to validate the core architecture before adding movement events or sugar.

## Risks

- conflating narrative scenes with world locations
- exposing too much internal engine state through patch paths
- adding sugar too early and locking in awkward semantics
- over-modeling physical simulation before the narrative/LLM loop is proven

## Success Criteria

- a `juryroom`-style interaction loop can be authored with ordinary Dramatoric constructs
- POV and visibility are reusable outside social-room games
- no new isolated DSL region is required
- `SCENE`, `ENTITY`, `LLM`, `ON`, and interpolation continue to feel coherent together
