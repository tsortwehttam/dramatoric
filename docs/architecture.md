# Dramatoric Engine Architecture

Technical reference for contributors and developers working with the Dramatoric Story Language (DSL) engine.

## Overview

Dramatoric is an event-driven interpreter for interactive audio stories (a DSL for narrative building). DSL scripts compile to an AST of directives that react to events (namely player input, but also other events). The engine is designed for tight LLM integration at multiple layers: input parsing, content generation, and dynamic dialogue.

**Aspects**:

- Paradigm: Event-driven, declarative with imperative blocks
- Typing: Dynamic, loosely typed with implicit coercion
- Execution: Interpreted via tree-walking evaluator
- Syntax: Colon-terminated stanzas (influenced by screenplay format, YAML, Inform 7)

**Influences**:

- Ink (Inkle)
- ChoiceScript
- Twine/Harlowe
- Traditional parser IF
- Ruby
- Screenplay conventions

**Design goals**:

- Readable and writeable by non-programmers
- Natural authoring experience for veteran IF writers
- AI-native (LLM calls are first-class)
- Audio-first (TTS, music, sound as core outputs)

## Compilation Pipeline

Dramatoric source code is written in `.dram` files. A collection of files that constitute a story (`.dram` scripts plus optional `.json`, `.yaml`, or `.js`/`.ts` files) is called a **cartridge**. Files are passed into a simple compilation pipeline:

```
Source (.dram files)
       │
       ▼
┌─────────────────┐
│  Pre-processing │  Strip comments, normalize indentation, extract frontmatter
└────────┬────────┘
         ▼
┌─────────────────┐
│   PEG Parser    │  Grammar definition → raw AST
└────────┬────────┘
         ▼
┌─────────────────┐
│   Compiler      │  Normalize structure, validate expressions
└────────┬────────┘
         ▼
   Compiled story (AST + metadata + errors)
```

The components of the compiler pipeline are:

### Lexer

Tokenizes directive arguments and expressions into typed tokens: quoted strings, numeric literals, identifiers/dot-paths, punctuation, and whitespace. Note: The lexer ends up being used both at compile time (static analysis) as well as at runtime (for parameter parsing during script interpretation).

### Parser

Uses a PEG grammar to parse colon-terminated stanzas. Key constructs:

- **Directives**: `HEADER: args DO ... END`
- **Assignments**: `varName = HEADER: args`
- **Blocks**: `DO ... END` wrappers for multi-line bodies

Note: Code is pre-processed before reaching the PEG layer to (1) extract YAML front matter, (2) strip `//` comments, and (3) normalize indentation.

### Compiler Transforms

After parsing, the compiler:

1. Finds all `.dram` files and merges them, moving any file named `main.dram` to the top
2. Extracts metadata from any JSON or YAML files in the cartridge
3. Hoists `BLOCK:` definitions to global scope so they can be called from anywhere
4. Wraps top-level content that isn't inside a handler into an implicit `ON: $input` handler
5. Validates script expressions for syntax errors and undefined references

## AST Structure

Every node in the AST has:

- **type**: Directive name (e.g., `IF`, `SET`) or a special internal type
- **args**: Everything between the header colon and `DO` or newline
- **kids**: Child nodes (the body content)
- **vars**: Assignment targets when using `x =` or `x, y[] =` syntax
- **eave**: Iteration variable names inspired by Ruby block/pipe syntax (e.g., `|item, idx|`)

Some node types are internal (not written by authors directly): `ROOT` is the top-level container for the compiled story, `TEXT` represents body text lines within a directive, and `GROUP` is an implicit wrapper for sequential execution.

## Directive System

Directives are the execution primitives. Each registered directive specifies which type names it handles and provides an async execution function. Resolution is first-match-wins; a fallthrough directive with no specified types handles unknown headers as dialogue/speech. (The engine also supports custom "operators" that callers can register for domain-specific behavior, but this is an advanced use case.)

### Parameter Marshalling

Directive arguments get parsed into multiple useful forms:

- Raw string and tokens
- Semicolon-split clauses (e.g., `foo 1; bar 2` → two clauses)
- Key-value pairs (first word = key, rest = value)
- Evaluated artifacts (variables resolved, expressions computed)

This lets directives interpret arguments flexibly depending on their semantics.

### Core Directives

| Directive                           | Purpose                                               |
| ----------------------------------- | ----------------------------------------------------- |
| `ON:` / `ONCE:`                     | Event handlers                                        |
| `IF:` / `ELSE:` / `CASE:` / `WHEN:` | Conditional branching                                 |
| `WHILE:` / `LOOP:` / `BREAK:`       | Iteration                                             |
| `SET:` / `INCR:` / `DECR:`          | State mutation                                        |
| `CAPTURE:`                          | Pause handler, await next input, optionally normalize |
| `LLM:`                              | Direct LLM call with schema                           |
| `EMIT:`                             | Fire custom event                                     |
| `RUN:` / `BLOCK:`                   | Reusable content blocks                               |
| `EACH:` / `MAP:`                    | Array iteration                                       |
| `VARY:`                             | Shuffle/pick/omit for variety                         |
| `SOUND:` / `MUSIC:`                 | Audio output                                          |
| _(fallthrough)_                     | Dialogue stanzas                                      |

## Expression Evaluator

Dramatoric comes with its own built-in expression evaluator that is used in cases where simple code expressions are required, e.g. evaluationg `IF:` conditionals. It uses the same lexer as the compiler. Expressions can be placed in many different locations within the author's script code.

- Within `{{handlebars(like(this()))}}` interpolation expressions
- Within directive conditions `IF: something() DO ... END`
- As the value of a `SET: key some(value(evaluated + here))` expression
- Anywhere key/value pairs can be given, e.g. `VARY: foo bar(); baz qux() DO ... END`

The evaluator tokenizes, parses (recursive descent with operator precedence), and tree-walks to evaluate. The evaluator also has fast-path logic in case the given expression is a simple literal or reference to a variable with dot-paths.

### Supported Constructs

- **Operators**: Arithmetic, comparison, logical, bitwise, ternary, null-coalescing (JS semantics)
- **Literals**: Numbers, strings, booleans, null, arrays, objects
- **Variables**: Simple names and dot-paths (`player.stats.health`)
- **Function calls**: `calcFloor(x)`, `strTrim(name)`, etc.

### Function Library

Around 150 built-in functions across categories: array manipulation, string processing, math, dates, and randomness. See `docs/functions-reference.md` for the complete list.

The randomness functions are all plugged into a psuedo-random number generator initialized with a `seed` value given when the engine is instantiated, so randomness is predictable and can be controlled/replayed during each run.

## Event System

The engine is fundamentally **event-driven**. All execution happens in response to events.

### Event Types

Built-in types include: initialization, session start/resume, exit, player input, semantic messages, media output, and timed waits. Authors can also emit and handle custom event types.

### Event Structure

Each event carries: unique ID, type, channel, sender, recipients, raw and normalized content, intent classification, timing fields, and media parameters.

The **channel** indicates the event's direction: `input` for player-originating events, `output` for engine-to-player events, and `emit` for internal events fired by the story script.

### Execution Flow

The host application triggers an engine "step" whenever input arrives or on a timer. Each step:

1. Raw input arrives (text or audio transcript)
2. Input processor classifies intent (fast-path for known commands, LLM for complex input)
3. Input becomes a story event, added to history
4. Engine processes all unprocessed events:
   - Each event is checked against all `ON:`/`ONCE:` handlers
   - Matching handlers execute, potentially emitting more events
   - Newly emitted events are processed in the same step
5. Turn counter and RNG cycle advance

### Handler Matching

Handlers specify which event types they respond to. Multiple types can be listed (OR logic). The special `$input` type matches player input events.

### CAPTURE and Checkpointing

`CAPTURE:` implements a **checkpoint/resume** pattern for multi-turn conversations:

1. First encounter: saves current execution path as checkpoint, halts handler
2. Handler stops, awaits next matching event
3. Next event arrives: checkpoint matches, handler resumes from that point
4. CAPTURE returns the event, optionally with LLM-normalized result

The checkpoint is stored as the path through the AST (an array of child indices), allowing the engine to resume execution at exactly the right point. This enables natural dialogue flows without explicit state machines.

## Session and State

### What Persists

The session tracks: player info, author-defined variables, input queue, event history, entity data, RNG state, turn counter, variation state (for `[[options]]`), ONCE flags, scope stack, handler checkpoints, and execution limits.

### Variable Scope

1. **Stack scope** (innermost): Temporary variables from `RUN:` parameters or `EACH:` iteration
2. **Session state**: Persistent author-defined variables set with `SET:`
3. **Context**: Magic variables (`$turns`, `$first`, `$event`), plus metadata

Lookup checks stack first (top-down), then session state.

### Entities as World State

`ENTITY:` is also the engine's world-state primitive. It stores a stable persona plus arbitrary stats, and now has a small set of reserved keys that support spatial-social simulation without introducing a second DSL:

- `kind`: broad category such as `person`, `place`, or `thing`
- `public`: visible shared state
- `private`: observer-local state visible only to self through `pov()`
- `location`: containment/location data such as `{ place: "JURY ROOM", rel: "in" }`

This keeps narrative flow and world topology separate:

- `SCENE` is still a narrative jump target for `GOTO`
- places are ordinary entities with `kind: place`

The runtime derives subjective context from shared entity state with helper functions like `entity()`, `loc()`, `coLocated()`, `visibleTo()`, and `pov()`. Structured LLM outputs can then be applied back into entity state with `applyPatches()` and converted into ordinary story events with `emitActions()`.

The intended authoring pattern is function-first: authors enter a simulation loop by using normal Dramatoric flow (`RUN`, `LOOP`, `IF`, `ON`, `LLM`) rather than by switching into a separate engine mode. If higher-level sugar is added later, it should desugar cleanly into that same block-and-event model.

### Location Transition Events

When an existing entity changes `location.place`, the runtime emits derived transition events:

- `$exit`
- `$depart`
- `$enter`
- `$arrive`

These are ordinary story events, so authors can react with normal `ON:` handlers. The payload is carried in `event.result` with fields such as `entity`, `from`, `to`, `fromRel`, and `toRel`.

Story termination still uses `$exit`, but only the engine-emitted exit signal from `ENGINE` ends the run. Entity movement `$exit` events are safe to observe with ordinary handlers.

### Recommended Simulation Loop

The recommended scheduler model is still block-and-event based, not a second runtime mode:

1. Authored flow decides to `RUN` a simulation block.
2. That block loops while a stop condition is not met.
3. Each iteration chooses an actor, derives POV, gathers a structured step result, applies patches, and emits actions.
4. The loop either continues or sets a stop/yield variable.
5. Control returns to the caller, which decides whether to continue authored flow, ask for input, or `GOTO` elsewhere.

This keeps the boundary explicit:

- `RUN` enters a temporary simulation loop and returns
- `GOTO` performs a narrative handoff
- world movement remains observable through ordinary emitted events

In practice, the most useful stop conditions are:

- a story-facing event should interrupt and return control
- no meaningful actions were emitted
- a world predicate became true
- a turn or time budget was reached

### Dynamic Content Variation

The `[[option|option|option]]` syntax supports three modes:

- **Random** (default): Pick randomly each time
- **Cycle** (`^`): Round-robin through options
- **Bag** (`~`): Shuffle all options, exhaust before reshuffling

## AI/LLM Integration

LLMs are integrated as first-class and at multiple layers:

### Input Processing

Raw player input is classified into semantic events using LLM calls. Simple inputs (single words, known commands) use fast-path logic. Complex or ambiguous input goes through an LLM that identifies intent type and routes to appropriate recipients.

### CAPTURE Normalization

When the `CAPTURE:` directive is used, authors can include instructions in the body to guide how input is normalized:

```dramatoric
answer = CAPTURE: DO
  Normalize the player's response to one of: yes, no, maybe
END
```

The LLM transforms free-form input ("yeah sure!" → "yes") into constrained output. The original input is preserved in `.value` while the normalized result is available in `.result`.

### LLM Directive

The `LLM:` directive makes direct LLM calls. An optional output schema can be given:

```dramatoric
profile = LLM: GENERATE DO
  Generate a character profile for a warrior with various stats.

  SCHEMA: DO
    weight: number in kg, in the range 50...150
    height: in cm, from 100...200
    personality: angry | sad | happy
  END
END
```

The first parameter keyword controls behavior: `GENERATE` for open-ended generation, `PARSE` for extracting structured data, `CLASSIFY` for scoring against categories, or `NORMALIZE` for constraining to specific values.

### Persona Blocks

Dynamic dialogue can be generated using "LLM blocks" with angle-bracket syntax, `<<...>>`:

```dramatoric
MR_DARCY:
<<
You are Mr. Darcy, proud and reserved.
Respond curtly to the player's last remark.
>>
```

The persona content becomes the system prompt; the LLM generates the spoken line in character. Conversation history is automatically included as context.

## ServiceProvider Interface

The engine is **runtime-agnostic**, i.e. all external capabilities (LLM calls, audio generation, TTS, HTTP fetches, session persistence) are abstracted behind a provider interface. Implementations can target different backends: cloud APIs, local models, or mocks for testing.

## Client-Server Model

> **Note**: The client-server boundary is still being refined.

General model: clients capture input and render output (audio playback); servers run the engine, manage sessions, and call AI services. Communication happens via events flowing in both directions. Session state lives server-side; clients are stateless renderers.

## Rendering Pipeline

> **Under Construction**: Audio generation timing and rendering strategy are actively being developed.

Open questions:

- **When to generate**: Eager (pre-generate) vs lazy (on-demand) for TTS and music
- **Streaming**: Whether to stream audio as it generates
- **Caching**: Strategy for caching generated audio
- **Synchronization**: Coordinating speech, background music, and sound effects
- **Interruption**: Preemption semantics when new output arrives

Events carry rendering hints (duration, loop, volume, background) but orchestration is not yet finalized.

---

## Quick Reference

### Key Directories

- `eng/`: Core engine (lexer, parser, compiler, evaluator, execution, directives)
- `eng/directives/`: Individual directive implementations
- `eng/functions/`: Built-in expression functions
- `lib/`: Shared utilities and service abstractions
- `docs/`: Reference documentation

### Adding a Directive

1. Create a directive definition with matching type names and async execution function
2. Register it in the directive list (order matters for resolution)

### Adding Expression Functions

1. Define functions following the standard signature (variadic serializable args → serializable result)
2. Register in the base function library

---

_Last updated: 2025-12_
