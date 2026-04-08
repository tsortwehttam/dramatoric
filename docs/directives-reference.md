# Directives Reference

Directives are the building blocks of a Dramatoric story. They tell the story engine what to do: speak a line, wait, play sound, listen for input, or choose between paths.

Most directives look like a heading with a colon, followed by text or a `DO...END` block. The heading names the action, and the body describes what should happen. Some directives can take extra settings on the same line after semicolons.

Think of each stanza as a tiny instruction. You can stack them to shape pacing, mood, and interactivity. The reference below shows each directive in a consistent format so you can copy patterns and keep going.

## BLOCK

**Summary**
Define a reusable block of story content that can be inserted later with RUN.

**Syntax**
```dramatoric
BLOCK: Block Name DO
  ...
END
```

**Examples**
```dramatoric
BLOCK: Encounter Intro DO
  HOST:
  The encounter begins.
END

BLOCK: Encounter Outro DO
  SOUND:
  Triumphant horns
END

RUN: Encounter Intro
RUN: Encounter Outro; mood "brave"; speed 2
```

**Notes**
- Defining a BLOCK does not play it immediately.

## BREAK

**Summary**
Exit the nearest WHILE/LOOP early.

**Syntax**
```dramatoric
BREAK:
```

**Examples**
```dramatoric
coins = 3

WHILE: coins > 0 DO
  choice = INPUT:

  IF: choice == "quit" DO
    BREAK:
  END

  SET: coins {{coins - 1}}
END
```

**Notes**
- BREAK is only valid inside WHILE or LOOP.

## CAPTURE

**Summary**
Pause an ON handler and resume it on the next matching event, optionally
transforming the input.

**Syntax**
```dramatoric
CAPTURE:
name = CAPTURE:
answer = CAPTURE: NORMALIZE DO
  Normalize to: yes, no
END
answer = CAPTURE: NORMALIZE; models (anthropic/claude-sonnet-4.5) DO
  Normalize to: yes, no
END
```

**Examples**
```dramatoric
ON: $input DO
  HOST: What's your name?
  name = CAPTURE:
  HOST: Hello, {{name.value}}!
END
```

```dramatoric
ON: $input DO
  HOST: Yes or no?
  answer = CAPTURE: NORMALIZE DO
    Normalize to: yes, no
  END
  HOST: You said {{answer.result}}.
END
```

**Notes**
- The assigned variable receives the input event object.
- Use `.value` for the raw input and `.result` for the normalized result.
- Use `models (...)` to hint preferred model(s) for normalization.

## CASE

**Summary**
Branch on a single expression by matching it against WHEN clauses.

**Syntax**
```dramatoric
CASE: expression DO
  WHEN: value DO
    ...
  END

  ELSE: DO
    ...
  END
END
```

**Examples**
```dramatoric
mood = "calm"

CASE: mood DO
  WHEN: "calm" DO
    HOST:
    You breathe slowly.
  END

  WHEN: "tense" DO
    HOST:
    Your pulse quickens.
  END

  ELSE: DO
    HOST:
    You steady yourself.
  END
END
```

**Notes**
- The first WHEN that matches runs; ELSE runs if nothing matches.
- WHEN and ELSE are only valid inside CASE.

## CODE

**Summary**
Run a short scripting block when you need more complex expressions.

**Syntax**
```dramatoric
CODE: DO
  a = 1 + 2; b = a * 3
END
```

**Examples**
```dramatoric
result = CODE: DO
  a = 10; b = 2; a / b
END
```

**Notes**
- Separate expressions with semicolons (`;`).

## DATA

**Summary**
Embed structured data (JSON or YAML) and assign it to a variable.

**Syntax**
```dramatoric
myData = DATA: DO
  ...
END
```

**Examples**
```dramatoric
someVar = DATA: DO
  {"hello": "json"}
END
```

```dramatoric
heroStats = DATA: DO
  hunger: 0
  mood: calm
END
```

**Notes**
- If parsing fails, the result is an empty object.

## DECR

**Summary**
Decrease one or more numeric variables.

**Syntax**
```dramatoric
DECR: key
DECR: key amount
DECR: key amount; otherKey otherAmount
```

**Examples**
```dramatoric
DECR: health
```

```dramatoric
DECR: stamina 0.5
DECR: focus 1; patience 0.25
```

**Notes**
- Missing amounts default to `-1`.
- Values are treated as numbers.

## DEFAULT

**Summary**
Set a variable only if it is currently unset.

**Syntax**
```dramatoric
DEFAULT: key value
DEFAULT: key value; otherKey otherValue
```

**Examples**
```dramatoric
DEFAULT: hunger 0
DEFAULT: mood "calm"; retries 0
```

**Notes**
- Existing values are preserved.

## Dialogue Stanzas (Default)

**Summary**
Any stanza header that is not a directive is treated as a speaker name, and
its body is spoken as dialogue.

**Syntax**
```dramatoric
SPEAKER:
Spoken line(s) here.
```

**Examples**
```dramatoric
HOST:
Once upon a time... (gravely) Lightning struck.

SARAH:
(softly) It's going to be alright.
```

```dramatoric
FRANK: to JIM
<< You are Frank, a gruff used car salesman. Be pushy but funny. >>
```

```dramatoric
BOB:
Hey you! << angry command to stop >> Show me some ID!
```

**Notes**
- Parentheses set emotional tone and are not spoken aloud.
- `<< >>` blocks are inline LLM generation slots. Authored text around them
  is preserved literally, and the LLM generates content to fill each slot.
- If the speaker is a registered entity, the entity persona is always layered
  in as base context for LLM generation, even when explicit `<< >>` blocks
  are present.

## DONE

**Summary**
Permanently stop the current ON handler from running again.

**Syntax**
```dramatoric
DONE:
```

**Examples**
```dramatoric
ON: $input DO
  HOST: Welcome to the story!
  name = CAPTURE:
  HOST: Hello, {{name.value}}! The adventure begins...
  DONE:
END
```

**Notes**
- Use DONE for one-time handlers like intros or tutorials.

## EACH / MAP

**Summary**
Iterate over one or more arrays and run the body once per element. MAP is an
alias that returns the collected results.

**Syntax**
```dramatoric
EACH: array DO
  ...
END

EACH: array DO |item, idx|
  ...
END
```

**Examples**
```dramatoric
items = DATA: DO
  - red
  - green
  - blue
END

EACH: items DO
  SET: outerVar $index
END
```

```dramatoric
numbers = DATA: DO
  - 10
  - 20
END

EACH: numbers DO |item, idx|
  LOG: {{item}} at {{idx}}
END
```

**Notes**
- `$array`, `$element`, and `$index` are available inside the loop body.
- If multiple arrays are provided, the body runs for each element of each array.

## EMIT

**Summary**
Fire a custom event that you can handle with ON.

**Syntax**
```dramatoric
EMIT: eventType
EMIT: eventType; key value; other "value"
EMIT: type eventType; key value
```

**Examples**
```dramatoric
EMIT: someEvent
```

```dramatoric
EMIT: someEvent; from hero; mood "tense"
```

```dramatoric
EMIT: type someEvent; from hero; mood "tense"
```

**Notes**
- If the first parameter is a bare token, it becomes the event `type`.
- Additional parameters become fields on the emitted event.

## ENTITY

**Summary**
Declare or update a named entity with stats and a persona (modus).
The body is parsed in multiple passes: first as structured data (JSON/YAML),
then as raw persona text. Redeclaring the same entity merges stats and replaces
the modus.

**Syntax**
```dramatoric
ENTITY: RATZ DO
  You are Ratz, a grizzled bartender with a Russian accent.
END
```

```dramatoric
ENTITY: RATZ DO
  name: Ratz
  health: 100
  mood: calm
  persona: You are Ratz, a grizzled bartender with a Russian accent.
END
```

```dramatoric
ENTITY: RATZ; health 100; mood "calm" DO
  You are Ratz, a grizzled bartender.
  << Respond in a gruff, world-weary tone. >>
END
```

**Examples**
```dramatoric
ENTITY: GUARD DO
  health: 50
  persona: You are a stern palace guard.
END

GUARD:
Halt! Who goes there?

// Later, update the entity stats
ENTITY: GUARD; health 30 DO
  You are a wounded palace guard, struggling to stay on your feet.
END
```

**Notes**
- If the body parses as structured data with a `persona` field, that field
  becomes the entity's modus and remaining fields become stats.
- If the body does not parse as structured data, it is treated as raw persona text.
- Inline parameters (after semicolons) are merged into stats.
- Redeclaring the same entity merges new stats and replaces the modus.
- When a speaker name matches a registered entity, the entity's persona is
  automatically injected into dialogue generation.
- Access entity stats with `stat("ENTITY_NAME", "statKey")`.

## EXIT

**Summary**
End the current handler and signal that the story is exiting.

**Syntax**
```dramatoric
EXIT:
```

**Examples**
```dramatoric
IF: playerChoice == "quit" DO
  EXIT:
END
```

```dramatoric
ON: $exit DO
  HOST: Thanks for playing.
END
```

**Notes**
- Use `ON: $exit` to react to an exit signal.

## FETCH

**Summary**
Fetch one or more URLs (HTTP GET) and return the response data.

**Syntax**
```dramatoric
result = FETCH: https://example.com
a, b = FETCH: url1; url2
```

**Examples**
```dramatoric
myData = FETCH: https://www.example.com
```

```dramatoric
heroProfile, heroInventory = FETCH: https://api.example.com/heroes/123; https://api.example.com/inventory/123
```

```dramatoric
remoteUrl = "https://example.com/story"
rawDoc = FETCH: {{remoteUrl}}
```

**Notes**
- URLs are separated by semicolons; missing or failing requests yield `null`.
- Responses are returned as parsed JSON when possible, otherwise text.

## GOTO

**Summary**
Jump to a named SCENE, transferring flow permanently.

**Syntax**
```dramatoric
GOTO: Scene Name
```

**Examples**
```dramatoric
SCENE: Kitchen DO
  NARRATOR:
  The smell of fresh bread fills the air.
END

GOTO: Kitchen
```

**Notes**
- GOTO does not return to the caller. Flow continues from the target scene.
- GOTO works from inside loops, conditionals, and blocks — it unwinds the entire call stack.
- Chained GOTOs are supported (a scene can GOTO another scene).
- A hop counter prevents infinite GOTO loops (max 1000 hops per step).

## GROUP / ROOT

**Summary**
GROUP lets you wrap sequential content inside a PARALLEL block. ROOT is a
reserved structural stanza and is not written directly by authors.

**Syntax**
```dramatoric
GROUP: DO
  ...
END
```

**Examples**
```dramatoric
PARALLEL: DO
  GROUP: DO
    HOST:
    This runs in order.
  END

  SOUND:
  A distant storm
END
```

**Notes**
- ROOT is reserved and not used directly in story scripts.

## IF / WHEN / ON / ONCE

**Summary**
Control flow and event handling: IF/WHEN for conditional branching, ON for
reacting to events, and ONCE for one-time execution.

**Syntax**
```dramatoric
IF: condition DO
  ...
END

IF: condition DO
  ...
  ELSE: DO
    ...
  END
END

WHEN: condition DO
  ...
END

ON: $input DO
  ...
END

ONCE: DO
  ...
END
```

**Examples**
```dramatoric
heroHasTorch = true

IF: heroHasTorch DO
  SIDEKICK:
  It's dark but at least you have a torch, hero!
END
```

```dramatoric
playerMood = "calm"

IF: playerMood == "calm" DO
  HOST:
  You move with care.

  ELSE: DO
    HOST:
    You charge in recklessly.
  END
END
```

```dramatoric
ON: $input DO
  HOST: Say anything.
  said = CAPTURE:
  HOST: You said {{said.value}}.
END
```

```dramatoric
ONCE: DO
  HOST: This line plays only once.
END
```

**Notes**
- WHEN can be used like IF for readability, and is also used inside CASE.
- ON listens for events like `$input` or custom types emitted with EMIT.
- You can list multiple ON event types separated by semicolons.
- ONCE can take an optional condition, just like IF.

## INCR

**Summary**
Increase one or more numeric variables.

**Syntax**
```dramatoric
INCR: key
INCR: key amount
INCR: key amount; otherKey otherAmount
```

**Examples**
```dramatoric
INCR: steps
```

```dramatoric
INCR: health 0.5
INCR: stamina 1; focus 0.25
```

**Notes**
- Missing amounts default to `+1`.
- Values are treated as numbers.

## LLM

**Summary**
Call a language model and capture its output.

**Syntax**
```dramatoric
result = LLM: GENERATE DO
  ...
END

result = LLM: PARSE; models (model/a, model/b) DO
  SCHEMA: DO
    ...
  END
END
```

**Examples**
```dramatoric
summary = LLM: GENERATE DO
  Describe {{scene}} in two vivid sentences.
END
```

```dramatoric
analysis = LLM: CLASSIFY DO
  USER PROMPT:
  I am a tightrope walker and I vote Democrat.

  SCHEMA: DO
    circusPerformer = float -1 to 1
  END
END
```

```dramatoric
someVar = LLM: PARSE; models (openai/gpt-4o-mini, anthropic/claude-sonnet-4.5) DO
  SCHEMA: DO
    move = enum run | fight | hide
  END
END
```

```dramatoric
myVar = LLM: DO
  SYSTEM PROMPT:
  You are a helpful AI assistant. Answer the user's question.

  USER PROMPT:
  Where is Paris?

  SCHEMA: DO
    answer: string of your answer to the user
  END
END
```

**Notes**
- Subcommands: PARSE, GENERATE, CLASSIFY, NORMALIZE (first one wins).
- SYSTEM PROMPT, USER PROMPT, and SCHEMA are optional.
- Use `models (...)` to hint preferred model(s). Unknown model entries are ignored.

## LOAD

**Summary**
Load a saved session by ID and return it.

**Syntax**
```dramatoric
savedGame = LOAD: "checkpoint_1"
```

**Examples**
```dramatoric
savedGame = LOAD: "checkpoint_1"
```

**Notes**
- Returns the saved session or `null` if none exists.
- The ID is rendered, so you can use expressions or interpolation.

## LOG

**Summary**
Write debug information while authoring or running a story.

**Syntax**
```dramatoric
LOG: expression
LOG: expression DO
  ...
END
```

**Examples**
```dramatoric
LOG: heroStats
```

```dramatoric
LOG: heroStats DO
  Checking hero stats at {{time}}
END
```

```dramatoric
LOG: {{player.hp}} DO
  HP before encounter is {{player.hp}}
END
```

**Notes**
- LOG does not affect story flow.
- The optional body is rendered and included with the log output.

## MUSIC / SOUND

**Summary**
Describe non-dialog audio like ambience, cues, or background music.

**Syntax**
```dramatoric
SOUND:
Audio description here.

MUSIC: duration 5000; loop true
Audio description here.
```

**Examples**
```dramatoric
SOUND:
The sound of birds chirping near a babbling brook
```

```dramatoric
MUSIC: duration 5000
Rock music with medieval overtones
```

```dramatoric
SOUND: loop true; volume 0.25
Gentle waves rolling under the docks
```

**Notes**
- The body is a natural-language description of the audio.
- Parameters like `duration`, `loop`, and `volume` customize playback.

## PARALLEL

**Summary**
Run multiple blocks at the same time, then continue when all finish.

**Syntax**
```dramatoric
PARALLEL: DO
  ...
END
```

**Examples**
```dramatoric
BLOCK: Branch A DO
  HOST:
  Path A begins.
END

BLOCK: Branch B DO
  HOST:
  Path B begins.
END

PARALLEL: DO
  RUN: Branch A
  RUN: Branch B
END
```

```dramatoric
PARALLEL: DO
  SOUND:
  Water flowing down a ravine

  WAIT: duration 2s
END
```

**Notes**
- Use PARALLEL for overlapping audio, timed events, or independent branches.

## POP

**Summary**
Remove and return the last element from one or more arrays.

**Syntax**
```dramatoric
POP: key
POP: key; otherKey
```

**Examples**
```dramatoric
POP: logEvents
POP: logEvents; alerts
```

**Notes**
- Non-array values are treated as empty arrays.
- Popping an empty array returns nothing.

## PRELUDE / RESUME / EPILOGUE

**Summary**
Lifecycle event handlers that run at specific points in the story session.
PRELUDE runs on fresh start, RESUME runs when loading a save, EPILOGUE runs on exit.

**Syntax**
```dramatoric
PRELUDE: DO
  NARRATOR:
  Welcome to the story!
END

RESUME: DO
  NARRATOR:
  Welcome back!
END

EPILOGUE: DO
  NARRATOR:
  Thanks for playing!
END
```

**Notes**
- PRELUDE is triggered by the $start event (first step of a new session)
- RESUME is triggered by the $resume event (loading a saved session)
- EPILOGUE is triggered by the $exit event (story ending)
- Top-level content not in a handler is implicitly wrapped in PRELUDE
- All three use checkpoint/resume semantics like ON, so CAPTURE works naturally

## PUSH

**Summary**
Append values to one or more arrays.

**Syntax**
```dramatoric
PUSH: key value
PUSH: key value; otherKey otherValue
```

**Examples**
```dramatoric
PUSH: logEvents "value"
```

```dramatoric
PUSH: breadcrumbs {{sceneId}}; alerts "danger"
```

**Notes**
- Non-array values are treated as empty arrays before appending.

## Reserved / Structural Stanzas

**Summary**
These stanzas are reserved or structural and are only used inside other
directives. They do not produce output on their own.

**Syntax**
```dramatoric
// Reserved; not written directly.
```

**Examples**
```dramatoric
// Reserved; not written directly.
```

**Notes**
- Use ELSE only inside IF, and WHEN only inside CASE.
- SYSTEM/USER PROMPT and SCHEMA are only valid inside LLM and CAPTURE.

## RUN

**Summary**
Insert and execute the contents of a previously defined BLOCK.

**Syntax**
```dramatoric
RUN: Block Name
RUN: Block Name; key value; other "value"
```

**Examples**
```dramatoric
BLOCK: Encounter Intro DO
  HOST:
  The encounter begins.
END

RUN: Encounter Intro
RUN: Encounter Intro; mood "tense"
```

**Notes**
- Parameters after the semicolons become temporary variables during the RUN.
- If no BLOCK with that name exists, nothing happens.

## SAVE

**Summary**
Save the current session state under a string ID.

**Syntax**
```dramatoric
SAVE: "checkpoint_1"
```

**Examples**
```dramatoric
SAVE: "checkpoint_1"
```

**Notes**
- The ID is rendered, so you can use expressions or interpolation.
- How and where saves are stored depends on your runtime.

## SCENE

**Summary**
Define a named scene that can be jumped to with GOTO.

**Syntax**
```dramatoric
SCENE: Scene Name DO
  ...
END
```

**Examples**
```dramatoric
SCENE: Market DO
  NARRATOR:
  Stalls line the cobblestone street.

  GOTO: Town Square
END

SCENE: Town Square DO
  NARRATOR:
  The fountain gurgles quietly.
END

GOTO: Market
```

**Notes**
- Defining a SCENE does not play it immediately.
- Scenes are jump targets for GOTO, similar to how BLOCKs are targets for RUN.
- Unlike RUN, GOTO transfers flow permanently (does not return to the caller).
- Use `$visits` inside a scene to check how many times it has been entered.

## SET

**Summary**
Set one or more state variables.

**Syntax**
```dramatoric
SET: key value
SET: key value; otherKey otherValue
SET: key DO
  multi-line text
END
```

**Examples**
```dramatoric
SET: foo 1
```

```dramatoric
SET: foo hello there
SET: foo "hello there"
```

```dramatoric
SET: foo 1; bar "I like cats; I like the way they purr"; baz -1.23
```

```dramatoric
SET: desc DO
  Any content you put in here becomes a single string.
END
```

**Notes**
- Variable names use letters, numbers, and underscores.
- Use quotes if a value contains semicolons.

## SHIFT

**Summary**
Remove and return the first element from one or more arrays.

**Syntax**
```dramatoric
SHIFT: key
SHIFT: key; otherKey
```

**Examples**
```dramatoric
SHIFT: queue
SHIFT: queue; stack
```

**Notes**
- Non-array values are treated as empty arrays.
- Shifting an empty array returns nothing.

## SPLICE

**Summary**
Remove one or more elements from an array starting at an index.

**Syntax**
```dramatoric
SPLICE: key index
SPLICE: key (startIndex, deleteCount)
```

**Examples**
```dramatoric
SPLICE: items 2
```

```dramatoric
SPLICE: items (2, 3)
```

**Notes**
- A single index removes one element.
- A tuple removes `deleteCount` elements starting at `startIndex`.

## TEXT

**Summary**
Return literal text content for assignment-style variable binding.

**Syntax**
```dramatoric
foo = TEXT: 5
foo = TEXT: {{name}}
foo = TEXT: DO
  multi-line text
END
```

**Notes**
- `TEXT:` is intended for `name = TEXT:` assignment form.
- It always returns a string value.
- It does not evaluate expressions or render `{{...}}` templates.

## TOGGLE

**Summary**
Flip one or more boolean variables.

**Syntax**
```dramatoric
TOGGLE: key
TOGGLE: key; otherKey
```

**Examples**
```dramatoric
TOGGLE: doorsLocked
TOGGLE: lightsOn; alarmArmed
```

**Notes**
- Values are treated as booleans and then inverted.

## UNSHIFT

**Summary**
Prepend values to one or more arrays.

**Syntax**
```dramatoric
UNSHIFT: key value
UNSHIFT: key value; otherKey otherValue
```

**Examples**
```dramatoric
UNSHIFT: queue "value"
```

```dramatoric
UNSHIFT: stack {{item}}; history "event"
```

**Notes**
- Non-array values are treated as empty arrays before prepending.

## VAR

**Summary**
Return string content for assignment-style variable binding.

**Syntax**
```dramatoric
foo = VAR: Some text
foo = VAR: 5
foo = VAR: [a, b, c]
foo = VAR: DO
  multi-line text
END
```

**Notes**
- `VAR:` is intended for `name = VAR:` assignment form.
- It parses literal values like numbers, booleans, null, and arrays.
- It does not evaluate expressions or render `{{...}}` templates.
- Use quotes when you want a string that looks like another literal, e.g. `foo = VAR: "5"`.
- Use `SET:` when you want expression evaluation.

## VARY

**Summary**
Add controlled variability: shuffle, omit a fraction, or pick a fixed count.

**Syntax**
```dramatoric
VARY: SHUFFLE DO
  ...
END

VARY: SHUFFLE; OMIT 0.5 DO
  ...
END

VARY: PICK 2 DO
  ...
END
```

**Examples**
```dramatoric
VARY: SHUFFLE DO
  HOST:
  Line one

  HOST:
  Line two
END
```

```dramatoric
VARY: SHUFFLE; OMIT 0.8 DO
  HOST:
  A

  HOST:
  B

  HOST:
  C
END
```

```dramatoric
VARY: PICK 2 DO
  HOST:
  Alpha

  HOST:
  Beta

  HOST:
  Gamma
END
```

**Notes**
- `SHUFFLE` randomizes order; `OMIT` drops a fraction; `PICK` selects a count.
- If `PICK` is provided, `OMIT` is ignored.

## WAIT

**Summary**
Pause playback for a specified duration.

**Syntax**
```dramatoric
WAIT: duration 2000
WAIT: duration 2s
WAIT: duration 1.5s
```

**Examples**
```dramatoric
HOST: You hear a whisper...
WAIT: duration 2s
HOST: ...from the dark.
```

**Notes**
- Duration can be milliseconds (`2000`) or seconds with `s` (`2s`, `1.5s`).
- If the duration is missing or invalid, the wait is ignored.

## WHILE / LOOP

**Summary**
Repeat a block while a condition remains true.

**Syntax**
```dramatoric
WHILE: condition DO
  ...
END

LOOP: condition DO
  ...
END
```

**Examples**
```dramatoric
WHILE: coins > 0 DO
  SET: coins {{coins - 1}}
END
```

```dramatoric
WHILE: true DO
  nextAction = INPUT:

  IF: $iteration > 2 DO
    BREAK:
  END
END
```

```dramatoric
WHILE: true DO
  choice = INPUT:

  IF: choice == "quit" DO
    BREAK:
  END
END
```

```dramatoric
WHILE: true DO |i|
  LOG: iteration {{i}}
END
```

**Notes**
- `$iteration` starts at `0` and increments after each loop.
- Use pipe syntax (`|i|`) to name your own iteration variable.
- Use BREAK to exit early.
