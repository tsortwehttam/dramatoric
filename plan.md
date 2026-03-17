# Plan: LINEAGE directive + lineage() function

## Overview

Add NPC ancestry backstopping via begat integration. Two new constructs:
1. **`LINEAGE:` directive** — declares a begat population with trait definitions and blend rules
2. **`lineage()` expression function** — queries ancestry data for an entity linked to a LINEAGE

Entities link into a lineage via a new `npc` param: `ENTITY: MR. DARCY; npc Meryton 42`.

When an entity with a linked NPC speaks, its computed ancestry context is automatically injected into the persona for LLM grounding.

## DSL Syntax

```dramatoric
LINEAGE: Bennets DO
  adam:
    surname: Bennet
    hairColor: brown
    temperament: 0.7
  eve:
    surname: Gardiner
    hairColor: auburn
    temperament: 0.4
  blend:
    surname: father
    hairColor: average
    temperament: average
END

ENTITY: MR. DARCY; npc Bennets 42 DO
  You are Mr. Darcy, a proud and reserved gentleman.
END

// Query ancestry explicitly
SET: info {{lineage("MR. DARCY", 3)}}
```

## Implementation Steps

### 1. Copy begat's NPC.ts into the repo as `lib/NPC.ts`

begat is a tiny, zero-dep module. Rather than adding a package dependency (it's not published to npm), copy `src/NPC.ts` into `lib/NPC.ts`. This is the cleanest path — the file is self-contained (~330 lines), strongly typed, and has no imports.

### 2. Add `LINEAGE_TYPE` constant and session storage

In `eng/Helpers.ts`:
- Add `LINEAGE_TYPE = "LINEAGE"` constant
- Add it to `DIRECTIVE_TYPES` array
- Add `lineages: Record<string, { settings: Settings<Traits>; depth: number }>` to `StorySession`
- Initialize to `{}` in `reifySession()`

### 3. Create `eng/directives/LineageDirective.ts`

The `LINEAGE:` directive:
- Parses the body as YAML/JSON expecting `adam`, `eve`, and optionally `blend` keys
- Reads optional `depth` from trailer params (default 2)
- Converts the `blend` map into a `blendRule` function for begat's Settings
- Constructs a begat `Settings<Traits>` object with sensible defaults for `traits()`, `bioFather()`, `lifespan()`, `exists()`
- Stores in `session.lineages[name]`

### 4. Extend `EntityDirective.ts` to handle `npc` param

When an entity has `npc` in its trailer params (e.g., `npc Bennets 42`):
- Parse the lineage name and NPC ID from the param
- Store `{ lineage: string, npcId: bigint }` alongside the entity in `session.entities`
- This is stored as two new fields on the entity record: `lineage` and `npcId`

Extend the entity type in `StorySession` to include optional `lineage: string` and `npcId: number`.

### 5. Add ancestry context injection in `resolveEntityPersona()`

In `EntityDirective.ts`, modify `resolveEntityPersona()`:
- If the entity has a linked NPC (`lineage` + `npcId`), instantiate `new NPC(settings, BigInt(npcId))`
- Compute ancestry up to the configured depth
- Format as a structured text block appended to the persona
- Format: `[ANCESTRY — canonical facts about your family; never contradict these]\nYou: ...\nMother: ...\n...`

### 6. Add `lineage()` expression function

In `Engine.ts`, add a `lineage` function to the function registry:
- Signature: `lineage(entityName, depth?)`
- Looks up the entity's linked NPC, instantiates it, and returns a serialized ancestry object
- Returns the formatted ancestry text (same format as what gets injected into persona)

### 7. Add `formatAncestry()` helper in `lib/LineageHelpers.ts`

Shared function used by both the persona injection and the `lineage()` expression function:
- Takes an NPC instance and depth
- Walks the lineage tree up to `depth` generations
- Produces a structured text representation of parents, siblings, grandparents, etc.
- Also returns a SerialValue object for programmatic access

### 8. Register LINEAGE directive

In `eng/Directives.ts`, import and push `LINEAGE_directive`.

### 9. Write tests

New test file `test/036-lineage.test.ts`:
- Test LINEAGE declaration stores settings correctly
- Test ENTITY with `npc` param links to lineage
- Test `lineage()` function returns ancestry data
- Test persona injection includes ancestry context
- Test trait blending works correctly
- Test depth parameter controls ancestry depth

### 10. Write unit tests for `lib/LineageHelpers.ts`

New test file `test/010-lineage-helpers.test.ts`:
- Test `formatAncestry()` produces correct output
- Test with different depths
- Test trait serialization

## Files Changed

| File | Change |
|------|--------|
| `lib/NPC.ts` | New — copied from begat |
| `lib/LineageHelpers.ts` | New — formatAncestry() and settings builder |
| `eng/Helpers.ts` | Add LINEAGE_TYPE, extend StorySession |
| `eng/directives/LineageDirective.ts` | New — LINEAGE directive |
| `eng/directives/EntityDirective.ts` | Extend for npc param + ancestry injection |
| `eng/Directives.ts` | Register LINEAGE_directive |
| `eng/Engine.ts` | Add lineage() function |
| `test/036-lineage.test.ts` | New — integration tests |
| `test/010-lineage-helpers.test.ts` | New — unit tests |

## Key Decisions

- **Copy begat, don't depend** — it's not on npm, and copying ~330 lines is cleaner than git submodules
- **Context injection, not tool calls** — ancestry data is small and bounded; injecting into persona avoids round-trips and hallucination risk
- **Default depth 2** — parents + grandparents covers 95% of NPC self-knowledge
- **`npc` as a compound param** — `npc LineageName ID` keeps the ENTITY syntax clean with no new directive needed
- **Ancestry formatted as text, not JSON** — LLMs parse structured text better for grounding
