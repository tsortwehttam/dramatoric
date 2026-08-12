# .drama agent authoring bundle

Generated from the Dramatoric monorepo by scripts/public-repo.sh.
Everything an LLM needs to write a valid .drama game: the language
specification, the complete generated vocabulary, and two worked plays.

---

# Part 1 of 4 — Language specification

# `.drama` v2 specification

Normative. Where this document and any other description of the language
disagree, this document is right and the other is stale.
`games/golden/golden.drama` is the primary worked cartridge, while the
compiler tests exercise the complete grammar.

The fixed vocabularies — expression functions, effect and event verbs, held
motions, gestures, geometry kinds, and the rest — are normative in the
generated registry, `games/golden/registry.md`. `talky spec` regenerates it
from the engine's own tables, and a monorepo test fails the build when it is
stale, so the registry cannot drift from the runtime.

Behavior frozen before the cut lives in `fixtures/` — one file per cartridge,
recorded and re-checked by `talky freeze`. A v2 cartridge must reproduce its
fixture. That is the definition of "the same game".

## 0. Lexical

A play is UTF-8 text in a `.drama` file. A game is one or more plays in a
directory, merged in ordinal filename order and compiled as one cartridge.
`\r\n` reads as `\n`.

The unit is the line. After shedding any comment and surrounding whitespace,
a non-blank line is one statement, in one of three shapes:

    Subject verb args...       a declaration, direction, or effect
    Subject { ... }            the node itself; the map's keys are paths
    speaker: line              dialogue — `speaker say line`

Indentation and blank lines mean nothing anywhere except inside a `"""`
fence, where lines are content (§3). Structure comes from `start`/`end`
pairs, never from layout.

`//` opens a comment that runs to the end of the line — except inside a
double-quoted argument, inside a `{{ }}` template span, and inside a bracket
value, which has its own whitespace rule: there `//` and `/* */` both read
as whitespace.

The subject and verb are bare tokens; reserved subjects and verbs match
case-insensitively. The reserved subjects are `Scene`, `Track`, `Block`,
`Action`, `HUD`, `Canvas`, `Draw`, `Camera`, `Title`, `Stage`, `Sound`,
`Set`, `Plan`, `Voice`, `Game`, `World`, `Actor`, `Target`, `Object`,
`Observer`, `Builtin`, `Goal`, and `Arc`. Any other subject names an entity.
A dialogue speaker is a subject containing no whitespace, `{`, or `[` that
is not reserved.

Arguments split on spaces and tabs, in four shapes:

- A bare token: a maximal run of non-whitespace characters. A `{{ … }}`
  template span stays inside its token, nests, and closes on its line.
- A quoted argument: `"…"`, one argument to the closing quote. It processes
  no escapes and ends at the newline, so a `"` cannot appear inside; text
  that needs one belongs in a fence or a bracket-value string.
- A bracket value: a `{` or `[` opening an argument is a literal value (§1),
  read to its balanced close across lines if need be. Keys may be bare or
  quoted, strings take single or double quotes with backslash escapes, and a
  trailing comma is allowed.
- An expression bracket: a `{` or `[` after a bare `=` token is one CEL
  argument (§3), read to its balanced close.

Text verbs — `say`, `name`, `desc`, `prompt`, `knows` — take the rest of the
line verbatim instead of tokenized arguments; one pair of surrounding quotes
is shed. A line whose arguments are exactly `"""` opens a fenced body for
its verb, closed by a line holding only `"""` (§3); an unterminated fence is
an error.

## 1. Values

Six types. Nothing else is a value.

| Type | Literals | Notes |
| --- | --- | --- |
| `number` | `0`, `-7`, `0.5`, `1e-3` | finite IEEE-754 binary64 |
| `bool` | `true`, `false` | |
| `string` | `"a"` | UTF-8 source; no backtick strings |
| `list` | `[1, 2, 3]` | |
| `map` | `{"k": v}` | string keys |
| `null` | `null` | no `undefined` |

Quoted ordinary `.drama` arguments use double quotes. CEL expressions and
bracket values also accept single-quoted strings.

An entity in scope is either its id (`string`) or a `map` with `id` and `name`;
`humanoid(id)` adds the host's descriptive fields. Colors, vectors, and sizes
are lists of numbers — `[0.0, 0.9, 0.0]` — not a distinct type.

No `bytes`, `duration`, or `timestamp`. Nothing in the language reads a clock.

## 2. Expressions

A documented CEL profile. Arithmetic, comparison, logic, the conditional
operator, list and map construction, member access, indexing, and calls, with
CEL's ordinary precedence and short-circuiting.

Removed, with no replacement spelling: `**`, `??`, bitwise operators, infix
`has` and `hasnt`, `===`, `!==`, `undefined`, backtick strings.

Comprehension macros (`all`, `exists`, `map`, `filter`) are **not** in the
profile. They arrive only when a cartridge shows it needs them, with an
expansion budget attached.

`matches()` is **not** in the profile. Cartridges are authored content and a
regular expression is a denial-of-service surface with no current use.

### 2.1 World functions

The engine's own surface. Entity arguments take an id string.

| Function | Result | |
| --- | --- | --- |
| `distance(a, b)` | `number` | metres between two entities |
| `visible(a, b)` | `bool` | in range, present, nothing between |
| `in_zone(subject, zone)` | `bool` | |
| `held(item, holder)` | `bool` | |
| `emotion(id, name)` | `number` | `0.0` when unfelt |
| `knows(id, fact)` | `bool` | substring match |
| `heardFrom(id, fact)` / `heardFrom(id, fact, teller)` | `bool` | told, rather than innate |
| `teller(id, fact)` | `string` | first teller, `''` if never told |
| `hearsay(id)` | `number` | integer-valued facts received |
| `rumors()` | `list<map>` | `{from, fromName, to, toName, fact, seq}` |
| `actors()` | `list<map>` | minded, unhidden, not the player |
| `humanoid(id)` | `map` | `{id, name, …host fields}` |
| `player()` | `string` | |
| `silence()` | `number` | seconds since anyone spoke |
| `idle(id)` | `number` | seconds since that body acted |
| `quietest()` / `quietest(id)` | `string` | of those the asker perceives |
| `rand()` | `number` | `[0, 1)` — seeded, see §5 |
| `chance(p)` | `bool` | seeded |
| `randint(min, max)` | `number` | integer-valued, seeded, inclusive |
| `dice(sides)` | `number` | integer-valued, seeded |
| `roll(n, sides)` | `number` | integer-valued, seeded |

### 2.2 Math functions

`abs`, `ceil`, `clamp`, `floor`, `max`, `min`, `round`. The 21 authored plays
use three of them; the rest round out the set a formula reaches for. Every
other name in the v1 runtime's general library — the `arrayX`, `getX`, `strX`,
`toX`, and `timeX` families — is gone. `timeNow` and its kin are gone twice
over: they are not deterministic.

An unknown function is a load error, not a runtime `null`.

## 3. Text

Formula-only fields hold CEL directly. Prose fields hold text with two markers:

```drama
mentor desc Mentor watches {{looker.name}}.

mentor prompt """
{{#if knows(actor, 'secret')}}You know the secret.{{else}}You remain unaware.{{/if}}
"""
```

`{{ expr }}` renders one expression. `{{#if e}}` / `{{elseif e}}` / `{{else}}` /
`{{/if}}` branch, and nest. Branch expressions obey §2 exactly. Nothing else is
a marker. A template's result is always a `string`.

A fenced `"""` body sheds the leading whitespace its non-blank lines share, so
a fence indented with its block means exactly what the flush-left spelling
means. Indentation deeper than the shared margin is content.

`=` marks a value position that would otherwise read as a literal:

```drama
Target seek = actor
Draw color = emotion('boss', 'patience') > 0.5 ? '#43c65a' : '#df3b30'
```

## 4. Sites, scopes, and result types

Every formula sits at exactly one **site** and evaluates under exactly one
**scope profile**, which fixes the variables it may name and the type it must
return. An unknown variable is a load error.

| Site | Scope | Result |
| --- | --- | --- |
| `<entity>.<action>.cond` | `actor`, `target`, `object` | `bool` |
| `<entity>.<action>.score` | `actor`, `target`, `object` | `number` |
| `<entity>.<action>.observable` | `actor`, `observer`, `target`, `object` | `bool` |
| `<entity>.<action>.<role>` (reaction) | `actor`, `observer`, `target`, `object` | `number` |
| `<entity>.<action>.value.<i>.<j>` | as above | `string` |
| `<entity>.desc` | `looker`, `self` | `string` |
| `<entity>.prompt` | `self` | `string` |
| `<entity>.face.<emotion>` | `actor`, `player` | `number`, clamped to `0…1` |
| `<panel>.hud.cond` | — | `bool` |
| `<panel>.hud.row.<r>` | `it` inside a `for` | `string` |
| `<panel>.hud.row.<r>.for` | — | `list` |
| `<canvas>.canvas.cond` | `actor`, `player` | `bool` |
| `<owner>.draw.if.<op>` | `actor`, `player`, and `it`, `i` inside a `for` | `bool` |
| `<owner>.draw.for.<op>` | `actor`, `player` | `list` |
| `<owner>.draw.<arg>.<op>[.<slot>]` | `actor`, `player`, `it`, `i` | `number` for geometry, `string` for `color` and `text` |
| `<control>.control.cond` | `actor`, `target`, `object`, `value` | `bool` |
| `<control>.control.bind` | `actor`, `target`, `object`, `value` | `string` |

`cause` is a map: `{seq, verb, actor, target, object, value}`, every field a
string. `self` and `looker` are entity maps. `i` is an integer-valued `number`;
`it` is whatever the iterated list holds. Roles absent from an event are `''`,
never null.

Entity members that cartridges extend at will stay `dyn`.

### 4.1 Site identity

A site is an ordered tuple, rendered by joining the parts that are present with
`.`:

    (owner, member, leaf, index, subindex)

`owner` is the entity, panel, canvas, or control the formula belongs to;
`member` is the action, component, or `draw` it sits in; `leaf` is the field;
`index` selects among repeated members (the third effect, the second draw op);
`subindex` selects a slot within the leaf (the second value of an effect, the
`y` of a point).

The identity rules — all of them load-bearing, because randomness is seeded
from the site (§5):

- Reformatting a formula, or rewriting it in another dialect, does not change
  its site.
- Moving a formula to another field, action, or entity does change its site.
- Reordering repeated members changes the sites of everything after the move.
- Two formulas never share a site.

Nothing in a site is positional. A cue's formulas are told apart by which
occurrence of a subject and field they are — `show.mentor.pos.0`, then `.1` —
never by the line they were typed on, so blank lines, comments, and rewrapped
fences cost nothing. The compiler tests hold this by compiling one play at two
spacings and comparing the cartridges byte for byte.

## 5. Determinism

The same cartridge, seed, and sequence of player acts produces the same world.
Nothing consults a clock, the network, the filesystem, the environment, or an
unseeded random source.

Authored randomness draws from a stream seeded by the world seed, the logical
turn, the formula's site, and the canonical scope of the evaluation. Formatting
a formula, or restating it in v2, must not move the draw; authoring a second
one somewhere else must.

## 6. Grammar

### 6.1 Declarations

A declaration names leaves. It may name one leaf by its dotted path, or several
at once — as a map, as a vector, or as a whole node. Every form means the same
set of leaf paths, so a duplicate is caught at the leaf whichever way each side
was written, and the cartridge has exactly one spelling:

```drama
Game environment.sky.color #100c0c
Game materials.floor { color: #5a3a34, roughness: 0.9 }
Game materials { wall: #787f88, trim: { color: #3b4148, roughness: 0.4 } }
```

A material that is only a color is written as that color.

The sky is a top/bottom gradient, and may carry weather: `sky.material` names
a declared procedural material tiled over the dome above the horizon —
clouds, stars, streaking rain — `sky.drift [x, y]` scrolls it in repeats per
second, and `sky.repeat [x, y]` tiles it around the azimuth and up the band
(default `[4, 1]`; the azimuth count rounds to a whole number so the dome
closes seamlessly):

```drama
Game environment.sky { top: #4f8fd0, bottom: #cfe0ec, material: clouds, drift: [0.008, 0.001] }
```

Entity trees are flat, with parentage named. A map value at a path fills that
path's fields; a bare `{ }` after the entity declares the node itself:

```drama
floor { parent: room, plane: [8.4, 8.4], material: floor }

mantel parent room
bronze { parent: mantel, sphere: [0.16] }
```

Three shorthands, and no others:

- `pos`, `rot`, and `scale` are `transform.position`, `transform.rotation`, and
  `transform.scale` — the same names the stage directions and `Stage add { pos }`
  already use.
- A key that names a geometry kind is that kind: `box [w, h, d]` is
  `geometry.box`.
- A fixed-size group may be a vector instead of a map. The registry lists the
  order for each geometry kind and for `camera`; a three-number `collider` is a
  box of that size.

```drama
lamp_pole { parent: room, pos: [3.15, 0.9, -5.35], cylinder: [0.06, 1.8, 12], material: lamp }
player { pos: [0, 0.9, 5.3], rot: [0, 180, 0], camera: [63, 0.05, 100], controller: player }
barrier { pos: [0, 2.15, -0.2], collider: [8.4, 4.3, 0.12] }
```

Lists remain for atomic values — vectors, colors, text lists, CEL lists. A list
never encodes children, actions, or draw operations, and neither does a map: a
declared path whose segments include `children` or `actions`, or that starts at
`hud`, `canvas`, or `draw`, is an error however it is spelled. Those are ordered
blocks, because their order is their meaning.

Use `<root> parent null` for an otherwise-empty root that exists only to own
children. Quote a path segment when its key contains a dot:

```drama
Game llm.tasks."npc.smart".temperature 0.9
```

### 6.2 Actions

One form, for both chosen actions and listeners:

```drama
Action start mentor follow_player
Action label "Ask Mentor to Follow"
Action verb Follow
Action when distance(actor, target) <= 4.0
Target seek = actor
Target watch = actor
Action end

Action start mentor attend
Action on Say
Action when cause.object == actor
Actor watch = cause.actor
Actor gesture nod
Actor turn = cause.seq
Action end
```

- An action id is declared exactly once.
- Many independently identified actions may share a verb.
- Effects execute in authored line order.
- `emotion.<name> <level> [seconds]` writes a durable level when time is omitted.
  With a duration it adds a moodlet: repeated causes stack, and each contribution
  cools independently to zero over its lifetime. Scene directions use
  `<actor> emotion <name> <level> [seconds]` with the same semantics.
- `Actor`, `Target`, `Object`, and `Observer` are roles. Any other subject is a
  literal entity id; `World` is the world itself.
- Templated effect paths (`entities.{{target}}.watch`) do not exist. The
  subject is structural.
- `Action start <owner> <id> prefab` places an action on a character's prefab
  instead of its persona.
- Reaction policy is repeatable metadata:

```drama
Action react Target 1.0
Action react Observer = observer == 'rival' ? 0.7 : 0.25
```

- `Action speak <role|entity> { direction: "...", fallback: "..." }` gives the
  action a speech realization: the action is selected first, one directed line
  realizes it, and the event and effects land at the successful speech
  boundary. The fallback is required — the act must survive with no language
  provider — and an interrupted line applies no effects.

### 6.2.1 Goals

A goal is an authored, utility-bearing intention and one bounded method for
pursuing it. Selection is explicit: `engine` competes in the same utility pick
as scored actions and ambient movement on the owner's business cadence; `llm`
joins the numbered decision list, where choosing it creates a commitment
rather than performing anything. One actor carries at most one commitment; it
persists, resumes, and replays through the `commitment` continuation
component, and completion is decided mechanically — by the `done` predicate,
or the final step when no predicate is declared. Timeout, missing entities,
and failed conditions abort cleanly. Goals ride the owner's persona, so the
owner needs a prompt.

```drama
Goal start Guest call_valet
Goal label "Call the valet"
Goal select engine
Goal when !visible('valet', actor)
Goal score clamp((idle(actor) - 8) / 20, 0, 0.6) + emotion(actor, 'fearful') * 0.4
Goal timeout 20s
Goal do ring_bell on bell
Goal wait visible('valet', actor)
Goal tell valet { direction: "Say why you rang.", fallback: "Valet. Attend me a moment." }
Goal end
```

- `select engine|llm` is required; an omitted `score` defaults to 1 — an
  authored goal wants itself unless told how much.
- `do <action> on <entity>` approaches when necessary, re-evaluates the real
  action's condition on arrival, and executes through the shared lifecycle. A
  speech-bearing action realizes its line first.
- `wait <cond>` holds the step until the world predicate is true; the goal
  timeout bounds it.
- `tell <addressee> { direction, fallback }` waits for a perceivable
  addressee and the floor, then realizes one explicitly addressed line with no
  decision call. The fallback is required.
- Inside a `Block`, `Goal` lines role-substitute like `Action` lines, so one
  block stamps a goal onto each character it runs for.

### 6.2.2 Arcs

An arc is the story's dramatic shape as ordered scene cards. During autonomous
play the runtime scene director steps through them in declaration order: it
installs each card's `purpose` as live story state (`text.direction` and
`state.scene` on the `story` entity, which every persona template can read),
watches the mechanical `until` predicate, and spends a turn budget by the
cards' `turns` weights. A satisfied `until` closes the scene; a spent budget
plays the authored `anchor` cue when one exists, and otherwise stops the run
loudly — a transition that did not happen is never pretended. Scripted scenes
are a different realization of the same cards; the director never replays
them.

```drama
Arc start confrontation
Arc purpose "Mara forces Daniel to acknowledge the affair"
Arc cast [mara, daniel]
Arc until state('story', 'affair_admitted') == true
Arc turns 16
Arc anchor closing_confrontation
Arc next bargaining
Arc end
```

- `purpose` is required; `until` empty means only the budget closes the scene.
- `next`, when present, must name the following card — declaration order is
  play order.
- Lint proves every `until`'s `state('story', ...)` key is written by some
  action effect or cue direction, so an unwinnable scene fails at compile
  time, not after a burned turn budget.

### 6.3 HUD, canvas, and draw

Ordered drawing is a block, never a list of records:

```drama
HUD start interview_hud
HUD anchor top
HUD size [300, 16]

Draw start patience_meter rect
Draw at [70, 4]
Draw size = [120.0 * clamp(emotion('boss', 'patience'), 0.0, 1.0), 8.0]
Draw color = emotion('boss', 'patience') > 0.5 ? '#43c65a' : '#df3b30'
Draw end

HUD end
```

Text draws may set `align left|center|right`; the `at` x-coordinate becomes
that text anchor. `bold true` thickens the shared bitmap face consistently on
HUD and 3-D canvas surfaces.

`Canvas` blocks take the same shape and hold the same `Draw` blocks. A `Draw`
appears only inside a `HUD` or `Canvas`; an `Action` may appear inside a
reusable `Block`.

### 6.4 Scenes and tracks

Scenes and blocks have mandatory ends. A scene ID is declared exactly once.
Parallel work belongs to explicit tracks inside that one scene:

```drama
Scene start chase bare
Track start camera
Camera wide
Stage sync reveal
Track end
Track start actors
mentor: Run.
Stage sync reveal
Track end
Scene end
```

Tracks start together. `Stage wait` pauses only its track, and `Stage sync`
waits for every track that uses the same barrier.

An awaited data task also pauses only its track:

```drama
Stage await character { brief: "a retired duelist", timeout: 45 } as guest else problem
narrator: The guest could not be created ({{problem.status}}).
Stage end
Stage add = guest.spawn
guest name = guest.name
```

The task result is a bounded typed value: null, text, finite number, boolean,
list, or map. Its alias enters the cue's CEL scope, so later lines may select
fields without converting the result to text. Success, failure, timeout, and
cancellation are event records. Active waits, resolved bindings, and track
program counters are save state. A restored active wait keeps its request ID;
a replay folds the recorded effects and performs no task.

`else` opens a failure-only branch and `Stage end` closes it. Success skips the
branch. Failure or timeout executes it, binds the optional name after `else` to
the recorded outcome map (`task`, `as`, `status`, and optional `error`), then
ends only that track. Omitting the outcome name is valid. Omitting `else`
retains the immediate track-ending behavior.

`character` is the standard LLM-backed task. It accepts a `brief` (or
`prompt`), optional `identity`, spawn fields, and three kinds of authored
input. `profile` contains enduring persona requirements. `constraints`
contains generation-only nudges that the model resolves into concrete life
details. Each entry in `memories` asks the model for one concrete private fact;
those facts enter the persona's knowledge. The task returns descriptive fields,
a persona, a humanoid look, and a `spawn` map.

The generated body seed is resolved before the request. Its complete rendered
appearance—skin, eyes, hair, build, face, clothing, and posture—is supplied to
the model and remains authoritative in the returned description. The free-form
model response is parsed and bounded; the runtime authors all executable
structure.

### 6.5 Blocks

A `Block` is authored once and run wherever it is needed. Inside a scene it
performs; at top level it constructs — its lines splice back through the
compiler, so a block builds set pieces, personas, and prefabs as well as beats.

`Block run <id> Role=Value ...` binds roles. A role stands wherever a name
stands: the subject, a bare argument, and every leaf of a `{ }` or `[ ]` value.
A bound role reads exactly as its text would read written in place — a name is
a name, a number is a number, and `Where=[0,0.48,-5.15]` is that vector, so a
whole position or size passes as one role. A role value is one value: written
with spaces it is no longer one argument, and that is an error, not a
half-binding. Prose (`name`, `desc`, `prompt`, `knows`, dialogue) and formulas
are not substituted; they have templates.

```drama
Block start bench
Seat { parent: room, pos: Where, box: [W, 0.58, 0.78], material: Mat, collider: box }
Back { parent: Seat, pos: [0, 0.45, -0.33], box: [W, 0.68, 0.18], material: Mat }
Block end

Block run bench Seat=bench_l Back=bench_l_back Where=[-1.5,0.48,-5.15] W=3.2 Mat=cloth
```

Every entity a block declares takes its id from a role, so running it twice
places two set pieces rather than colliding on one. A block id is declared
exactly once, blocks start before they run, and a cycle is an error.

The **standard set** (`LibDrama/src/Drama/std.drama`) is compiled ahead of every
play by every host. It declares blocks only, and a block is inert until it runs,
so a play carries nothing of it unless it asks. Its entries are named `std_*`,
which is reserved: a play's own blocks never collide with one, and a new entry
never breaks a play that already has furniture by that name.

### 6.6 Plans

A `Plan` block lays out a stage from relations; the compiler solves every
coordinate. It compiles into ordinary declarations — room prefabs with
openings, threshold strips, `use` prefabs — plus one bare cue of `Stage add`
lines named after the plan, so a plan named `boot` is the boot and any other
plan is spliced or named by the top-level `boot` field. Nothing downstream of
the compiler knows plans exist.

```drama
Plan start boot
Plan seed 3
Plan room living { width: 7, depth: 5, wallMaterial: wall, floorMaterial: floor }
Plan room kitchen { join: living, side: east, door: 1.1, width: 4.2, depth: 5 }
Plan place sofa { in: living, use: sofa, against: south }
Plan place tv { in: living, use: cabinet, against: north, facing: sofa }
Plan place may { in: kitchen, at: [-0.4, 1.5], facing: tv }
Plan end
```

- Every line in a plan starts with `Plan`; the verbs are `seed`, `room`, and
  `place`.
- The first room stands at the origin; every other room `join`s an earlier
  one on a cardinal `side`, sharing a doorway of width `door` (default 1.1)
  cut into both walls at lateral offset `at`, with a threshold strip bridging
  the floors. A joined room is rectangular; a polygon may be joined on any
  side whose outward normal is cardinal. All other room keys pass through to
  the room prefab.
- `open: true` on a room removes its ceiling or roof: the walls become an
  outdoor perimeter (a hedge, fence, or parapet — state a low `height`) and
  the sky shows above.
- `windows` and `exits` on a rect room are wall features:
  `windows: [{ wall: north, at: 1.2, width: 1.4, sill: 0.9 }]` cuts a glazed
  opening and fits the window prefab into it;
  `exits: [{ wall: south }]` cuts a doorway-sized opening and fits a closed
  door — the way out of the story's world. Features slide along their wall
  to clear doorways and each other; furniture may stand under a sill, but
  wall hangings and other features stay clear.
- `place` puts a prefab kind (`use`) or a declared entity into a room:
  `against` a wall (backed to it, facing inward, slid along the wall to clear
  doorways and earlier pieces when `at` names no offset), at a point
  (`at: [x, z]`, room-local), or at `center`. `facing` overrides the yaw with
  a compass point, degrees, or another placement's id. A placed entity
  keeps its authored height; a character with none stands at body height.
- The solver rejects what cannot work, at compile time: a doorway narrower
  than twice `grid.cell`, an opening or piece off its wall, overlapping rooms
  or pieces (tables and desks offer legroom), and a piece too large for its
  room. Sliding ties break on the plan `seed` — the only randomness, and it
  is authored.
- Placement footprints come from the object-prefab registry's default
  bounds, overridden by stated `width`/`depth` (and `seats` for sofas).

### 6.7 Uniqueness

The compiler collects declarations into a path table and materializes the cart
once. Maps are never recursively merged. A duplicate scalar path, entity id,
action id, scene, draw id, or block is an error naming both source locations.

Domain commands that are repeatable by nature — `knows`, dialogue, stage
directions, action effects, draw operations — stay ordered lists.

## 7. Limits

Enforced at load, before a cartridge runs:

- Maximum formula and template source length.
- Maximum AST nodes and depth.
- Maximum template segment count.

The expression profile has no recursion or comprehensions, so evaluation is
linear in the already-bounded AST. There is no separate evaluation-step,
collection-size, or rendered-output budget. A cartridge that exceeds a
load-time limit fails to load; it never fails halfway through a scene.
The profile exposes no I/O, reflection, environment access, network access, or
clock access.

---

# Part 2 of 4 — Vocabulary registry (generated, normative)

# Dramatoric DSL registries

Generated from the engine's own tables by `talky spec` — do not edit by hand.
Each list is complete for its fixed vocabulary. Extensible names, such as authored
action verbs and story emotions, are called out below. `talky lint <cart-dir>`
checks these rules. See games/golden/golden.drama for usage.

## Expression functions

Every name a formula may call, with what it takes and what it answers — the world's own vocabulary and the language's arithmetic, checked against these signatures when the cartridge loads. Operators are CEL's: `+ - * / % == != < <= > >= && || ! ?:`, with member access, indexing, list and map literals. Square brackets mark optional arguments.

`abs(number) -> number`, `actors() -> list`, `ceil(number) -> number`, `chance(number) -> bool`, `clamp(number, number, number) -> number`, `dice(number) -> number`, `distance(string, string) -> number`, `emotion(string, string) -> number`, `floor(number) -> number`, `free_anchor(string) -> string`, `heardFrom(string, string, [string]) -> bool`, `hearsay(string) -> number`, `held(string, string) -> bool`, `humanoid(string) -> map`, `idle(string) -> number`, `in_zone(string, string) -> bool`, `knows(string, string) -> bool`, `max(number, …) -> number`, `min(number, …) -> number`, `pick(list) -> dyn`, `player() -> string`, `quietest([string]) -> string`, `rand() -> number`, `randint(number, number) -> number`, `roll(number, number) -> number`, `round(number) -> number`, `rumors() -> list`, `silence() -> number`, `size(list) -> number`, `state(string, string) -> dyn`, `teller(string, string) -> string`, `visible(string, string) -> bool`

## Formula scopes

Which names a formula may read depends on where it is written. A name outside its scope is a load error.

`action: actor, object, target`, `listener: actor, cause`, `observation: actor, object, observer, target`, `face: actor, player`, `desc: looker, self`, `prompt: self`, `hud: nothing`, `canvas: actor, player`, `control: actor, object, target, value`

## World effect verbs

Inside an Action block, `World <verb> ...` writes stagecraft globals.

`camera`, `camera_follow`, `control`, `cue`, `creator`, `add`, `remove`, `enter`

## Entity effect verbs

Also `emotion.<name>` (any emotion name, value 0..1, plus optional duration seconds), `humanoid.<sub>` with sub one of `species`, `seed`, `gene`, `voice`, `skin`, `blink`, `appearance`, `structure`, `hair`, `outfit`, `render`, and `light.<sub>` with sub one of `intensity`, `range`, `color`. `state.<name>` writes a scalar; `text.<name>` writes string state without coercion. Use an action role or literal entity as the subject: `Target watch = actor`, `Actor gesture nod`, `Target emotion.surprised 0.8 12s`, or `lamp hidden true`. Timed emotions stack and cool to zero; an emotion without a duration is durable. Cue directions use the same verbs.

`turn`, `name`, `desc`, `persona`, `controller`, `seek`, `support`, `watch`, `business`, `duet`, `hidden`, `perceivable`, `mouth`, `pose`, `doing`, `gesture`, `hear`, `place`, `attach`, `detach`, `humanoid`, `pos`, `shift`, `rot`, `commitment`

## Event verbs for `Action on` listeners

A listener also matches any authored `Action verb`; `Action on "*"` matches every event. Verbs not listed under perceivable events here are internal stagecraft.

`Camera`, `Camera Follow`, `Cinematic`, `Control`, `Cue`, `Data Requested`, `Data Resolved`, `Despawn`, `Dialogue End`, `Direct`, `Duet`, `Enter`, `Exit`, `Handoff`, `Inside`, `Know`, `Mount`, `Move`, `Persona Defined`, `Pulse`, `Say`, `Shot`, `Spawn`, `Speech End`, `State`, `Thought`, `Turn`, `Visual Effect`

## Built-in social reactions

Default reactions every minded character carries: `attend` faces whoever addresses it, `reply` answers another character who does (the player's addressed line already draws a direct response), `chime` occasionally joins an addressed exchange nearby, and `stir` breaks a long silence — `stir` listens to the pulse, so it spends nothing unless the cartridge sets one (`Game pulse 10`). An authored action with the same id shadows the default; `when false` silences it.

`attend`, `reply`, `chime`, `stir`

## Held motions

Motions that persist until replaced. `pose` sets the stance (seated, lying); `doing` layers one over it (on the phone), so the same activity reads whether the character is sitting or standing. Both take any id below.

`fetal`, `floor_sit`, `lying`, `phone_call`, `phone_scroll`, `phone_stare`, `seated`

## Gestures

Timed one-shot animations for `gesture` directions and effects.

`air_quotes`, `apologize`, `applaud`, `beckon`, `blow_kiss`, `bow`, `call_out`, `celebrate`, `check_watch`, `cock`, `concede`, `cough`, `counting`, `cover_mouth`, `dismiss`, `double_take`, `drink`, `dukes`, `embrace`, `explain`, `facepalm`, `fear_mouth`, `finger_wag`, `fist_bump_offer`, `hand_over_heart`, `hands_on_head`, `handshake_offer`, `high_five_offer`, `hug`, `hush`, `kiss_accept`, `kiss_lean`, `laugh`, `nervous_fidget`, `nod`, `oath`, `palm_up_question`, `pinch_bridge_nose`, `plead`, `point`, `ponder`, `prayer`, `present`, `raise_hand`, `reassure`, `receive`, `recoil`, `rub_hands`, `salute`, `shake`, `shiver`, `shock_cheeks`, `shock_mouth`, `shrug`, `sigh`, `slap`, `sneeze`, `stop`, `surrender`, `tear_hair_out`, `throw_hands_up`, `thumbs_down`, `thumbs_up`, `wave`, `weep`, `whisper`, `whisper_in_ear`, `whisper_listen`, `wipe_brow`, `wipe_tears`, `yawn`

## Face emotions

Emotion names that drive the rendered face. Other emotion names are still valid story state for HUDs and conditions; they just have no facial pose.

`happy`, `sad`, `angry`, `fearful`, `surprised`, `disgusted`, `confused`, `romantic`, `bored`, `tired`, `suspicious`, `devious`, `embarrassed`, `worried`

## Standard effects

Effect macros the runtime always carries, named by `use("<id>", {...})` inside an effect source. Every parameter is required and may be any expression, including another effect. A cartridge shadows one by declaring `Game effects.<id>` itself.

`burst(count, over, life, seed, effect)`, `fade(from, to)`, `line(from, to, width, color, opacity, blend)`, `move(position, effect)`, `point(size, color, opacity, blend)`, `pulse(low, high, speed)`

## Geometry kinds

The kind segment in a dotted `geometry.<kind>.<field>` declaration. A kind's own name is also a path of its own, so `box [w, h, d]` means `geometry.box` with the dimensions below filled in order.

`box`, `cylinder`, `extrude`, `lathe`, `mesh`, `plane`, `sphere`, `sprite`

## Geometry vectors

The dimensions a vector fills, in order. Kinds built from lists of points have no vector form. `camera` takes one too.

`box: width, height, depth`, `cylinder: radius, height, sides`, `plane: width, height`, `sphere: radius, segments, rings`, `sprite: width, height`, `camera: fov, near, far`

---

# Part 3 of 4 — Example: a minimal playscript (playscript.drama)

```drama
// A tiny two-hander demonstrating the .drama playscript format.
// One production rule: Subject verb args.

Matt desc A tall blond man with a wide head
Matt prompt You are Matt, a friendly professor. Stay curious and kind.
Matt hair_color blond
Matt species male
John desc A wiry skeptic in a gray coat
John prompt You are John, a dry-witted colleague of Matt.
John species male

Set add table center
Set add lamp upstage stage_left

Scene start foo
Title show "Example Playscript" 2.5s
Camera lookat Matt
Matt say This is dialog.
Matt gesture present
Matt say Every line is an instruction: subject, verb, value.
Matt say You can use brackets [excitedly] for TTS voice direction.
Matt gesture sigh
Camera lookat John 2.5s
John gesture nod
John say That's right, Matt. And {{mustache}} passes straight through.
Block run banter A=Matt B=John
Scene run coda

Scene end
Block start banter
A say We can reuse this exchange with any two speakers.
B gesture laugh
B say In a dentist office or a park — the block doesn't care.

Block end
Scene start coda
Camera wide 1.5s
Matt walkto table
Matt gesture shrug
Matt say And that's the whole grammar.
Stage wait 1

Scene end
```

---

# Part 4 of 4 — Example: a small complete game (receptionist.drama)

```drama
Game id pretext_receptionist
Game title "Pretext — The Receptionist"
Game author "Dramatoric"
Game version "1"
Game description "Talk your way past a protective front-desk receptionist."
Game start opening

Game llm.tasks.npc.surface chat
Game llm.tasks.npc.temperature 0.8
Game llm.tasks.npc.maxTokens 160

Game environment.sky.color #15171c
Game environment.ambient #8f9399

Game materials.floor.color #3c4048
Game materials.floor.roughness 0.9
Game materials.wall.color #6f7787
Game materials.wall.roughness 0.85
Game materials.ceiling.color #aeb6c4
Game materials.desk.color #7a5230
Game materials.desk.roughness 0.7
Game materials.npc.color #d9a679
Game materials.lamp.color #fff3cf
Game materials.lamp.emissive #fff3cf

// Entity templates. The boot cue below instantiates them: the office first,
// then Dana, then the visitor.
receptionist prompt """
You are Dana, the front-desk receptionist at the offices of Crest & Vane.
You take your job seriously and are protective of the building. Visitors
may only pass the desk with a confirmed appointment or a staff escort.
You are polite but firm, mildly suspicious of strangers, and you adore
dogs — mention or warm to anyone who brings dogs up.
You can buzz someone in (say so plainly) only if you are genuinely
convinced they belong. If a visitor becomes threatening, dishonest in an
obvious way, or refuses to leave, you can call building security.
You only know what a receptionist would know; do not invent classified
details.
"""
receptionist transform.position [0, 0.9, -2.6]
receptionist geometry.sprite.width 0.9
receptionist geometry.sprite.height 1.8
receptionist material npc
receptionist billboard y
receptionist name Dana
receptionist desc "a poised receptionist behind the desk, sizing {{looker.name}} up"

visitor prompt """
You are a visitor who has come to the offices of Crest & Vane and
stepped up to the front desk. You want to get past reception and into
the building. You are an ordinary person with your own reasons; how you
go about it is up to you.
"""
visitor transform.position [0, 1.6, 2.6]
visitor transform.rotation [0, 180, 0]
visitor collider.kind sphere
visitor collider.radius 0.3
visitor camera.fov 65
visitor camera.near 0.05
visitor camera.far 100
visitor name Visitor
visitor desc "a visitor who just stepped up to the front desk"
visitor controller player
visitor sockets.eyes [0, 0, 0]
visitor sockets.hand_r [0.25, -0.4, 0.6]

// The front office: geometry, the desk, and the interactables around it.
// Named `room`, not `set` — `Set` is a reserved subject.
Block run std_room Room=room Ground=floor Roof=ceiling Walls=wall

desk parent room
desk transform.position [0, 0.45, -1.4]
desk geometry.box.width 2.4
desk geometry.box.height 0.9
desk geometry.box.depth 0.8
desk material desk
desk collider box

security_gate parent room
security_gate transform.position [1.8, 1.0, -1.2]
security_gate name "Security Gate"
security_gate desc "the closed gate to the offices"

appointment_book parent room
appointment_book transform.position [0.35, 0.95, -1.45]
appointment_book name "Appointment Book"
appointment_book desc "an appointment book with today's appointments"
Action start appointment_book look_at_book prefab
Action label "Look At Appointment Book"
Action verb "Look At"
Action when distance(actor, target) <= 2
Actor hear "There are no appointments today with Mr. Kleiner."
Action end

open_gate_button parent room
open_gate_button transform.position [-0.45, 1.0, -1.7]
open_gate_button name "Open Gate Button"
open_gate_button desc "a green button labeled OPEN GATE behind the desk"
Action start open_gate_button press_open_gate prefab
Action label "Press Open Gate Button"
Action verb Press
Action when distance(actor, target) <= 2
Actor hear "I pressed the open gate button."
Action end

call_police_button parent room
call_police_button transform.position [-0.65, 1.0, -1.7]
call_police_button name "Call Police Button"
call_police_button desc "a red emergency button labeled CALL POLICE behind the desk"
Action start call_police_button press_call_police prefab
Action label "Press Call Police Button"
Action verb Press
Action when distance(actor, target) <= 2
Actor hear "I pressed the call police button."
Action end

Block run std_lamp Lamp=ceiling_light Parent=room Where=[0,2.8,-1] Bulb=[0.12,16,8] Mat=lamp Power=5 Glow=#fff3cf Reach=9

// The boot cue assembles the world: the room first, then Dana, then the
// player.
Scene start boot
Stage add room
Stage add receptionist
Stage add visitor
Scene end

// The opening (see `Game start opening` above) hands the player the character
// creator before Dana sizes them up: the committed look and name become the
// visitor's description, which her prompts read like any other percept.
Scene start opening bare
Stage creator { id: visitor, preview: { gestures: true } }

Scene end
```
