# Dramatoric

<p align="center"> <img src="logo.png" alt="Dramatoric" width="200" /> </p>

Dramatoric is an interactive narrative engine for creating dynamic, branching stories. Think interactive fiction (intfic), story-driven games, and generative media — but with AI-powered dialogue, dynamic rendering, and a scripting language designed for human-AI collaboration. You can play the detective in a true crime thriller, the villain in a sweeping fantasy, or the narrator of a collaborative romance. Dramatoric handles the story layer — plot, dialogue, characters, and logic — and leaves rendering to whatever medium you choose: audio, text, visuals, or something new entirely.

Note: The README of this repo is generated from a real Dramatoric script file. Do not edit the README.md file directly. See `fic/readme/main.dram` and make changes there.

## Dramatoric Story Language

Stories are written in Dramatoric Story Language (DSL), which reads like a script with a bit of logic mixed in. You write dialogue, add branching and variables, and optionally hand lines off to an AI for improvisation. The engine handles execution; rendering is up to whatever medium you target.

Dramatoric is built for human-AI collaboration. You can write every word yourself, let AI generate character dialogue, or land anywhere in between. Start small, add complexity as you need it.

For technical docs, see [docs](./docs/).

If you want to learn how to write Dramatoric stories, keep reading:

### Stanzas: The Building Blocks

```well
NARRATOR:
It's a bright autumn evening in the assembly room.
```

Dramatoric scripts are made up of stanzas: a _heading_ followed by a _body_. Headings end with a colon (like `My Stanza:`) and can contain letters, numbers, spaces, and some symbols. The body is whatever text you want. When the story plays, this stanza is performed as the `NARRATOR:`, delivered in that character's voice and style.

```well
NARRATOR:
Candles glow against pale walls.

NARRATOR:
You have just arrived, your gloves still cool from the night air.
```

One thing to watch: colons are how Dramatoric identifies structure. Every heading needs one. But you _cannot_ use a colon in your stanza body unless you escape it with a backslash (`\`):

```well
NARRATOR:
The room is full of strangers and half-strangers\: neighbors, officers, families you know by reputation.

SOUND: loop true; duration 20s
The gentle din of a high society social gathering
```

Stanzas can be multiple lines, as long as each line immediately follows the previous one. Special stanzas like `SOUND:` produce things other than speech (here, a sound effect). Notice the _settings_ after `SOUND:` on the same line (`loop true; duration 20s`). Settings control how a stanza behaves, separated by semicolons. See the Directives Reference for the full list.

### Capturing Player Input

```well
MR. BINGLEY:
My dear Darcy, you must allow yourself to enjoy the evening. The company is lively.

MR. DARCY:
I see nothing here that tempts me to conversation.

NARRATOR:
Their eyes drift, briefly, toward you. A pause. A judgment, perhaps.
You feel it, sharp and unmistakable. How do you react? Do you speak to them, or ignore?

decision = CAPTURE:
Convert the input into either "talk" or "ignore"
```

`CAPTURE:` grabs the player's input. The `decision =` prefix stores that input into a variable called `decision` for later use.

The player has two real choices here: `"talk"` or `"ignore"`. But they might type "Talk to them!" or "I want to speak to them" or "flirt." You don't want to handle every phrasing by hand. That's where the body of the `CAPTURE:` comes in: it tells Dramatoric's AI to normalize the input into `"talk"` or `"ignore"`, whichever fits. The normalized result is stored as `decision.result`. (The raw input is still available as `decision.value`.)

### Conditional Logic

```well
// The player chose whether to talk or ignore. Let's handle both cases.
IF: decision.result == "ignore" DO
  NARRATOR:
  You turn away, preferring the company of strangers to the scrutiny of these gentlemen.
  The evening passes uneventfully. Perhaps another time.

  // EXIT: ends your story. We'll learn about this more later.
  EXIT:
END

IF: decision.result == "talk" DO
  NARRATOR:
  Boldly, you turn to face the two men and stride toward them.

  // MUSIC: Is another special header. In the body of a MUSIC: stanza,
  // you can simply describe what type of music you want - and Dramatoric will generate it for you
  MUSIC: background true; loop true
  Light classical minuet centered on the fortepiano, harp, violin, and flute

  // You can use DO...END blocks anywhere, even just to enclose multiple paragraphs of speech.
  // Within DO...END blocks, dialog can have multiple empty lines between.
  NARRATOR: DO
    The men straighten and, with expressions of curiosity and surprise, turn to meet you.

    You sense they're nervous, being approached so boldly.
  END

  // Parentheses can be used to control characters' emotional nuance and tone.
  // Content in parens is never delivered to the player; it's only used to shape emotional inflection.
  MR. BINGLEY:
  Good evening. (hesitant) I do not believe we have been introduced. Your name...?

  // If you don't need AI to parse your input, you can write just "CAPTURE:"
  // But remember that, no matter what, we still need the colon!
  name = CAPTURE:

  // The double curly braces syntax {{like this}} can be used to inject dynamic values
  // into your story. Here, we reference the `.value` of the `name` variable that we captured above.
  MR. BINGLEY:
  A pleasure, {{name.value}}. I hope you find Meryton agreeable.
  The assembly can be overwhelming on a first night.
END
```

`IF:` adds conditional logic. A few new concepts appear in the example above:

- `//` starts a _comment_, visible only to the author, never played.

- The expression after `IF:` (e.g. `decision.result == "ignore"`) is a bit of
  code that gets evaluated at runtime.

- `DO` and `END` group stanzas into a block. You can nest anything inside.

- `MUSIC:` generates music from a text description.

- Parentheses control emotional tone. Content in parens is never spoken to the
  player; it only shapes inflection.

- `{{like this}}` injects dynamic values. Here, `{{name.value}}` inserts the
  captured name.

### Variables and Branching

`SET:` stores variables. `ELSE:` gives you alternate branches. Here they are together:

```well
// Continuing our scene... Mr. Darcy speaks up.
// SET: lets you define variables that you can use later.
// Here, we're keeping track of Mr. Darcy's mood.
SET: darcyMood "cold"

// You can set multiple variables at once, separated by semicolons.
SET: bingleyMood "warm"; ballroomCrowded true

MR. DARCY:
(cold, dismissive) I trust you will not stay long. These gatherings exhaust me.

NARRATOR:
Mr. Darcy's tone is clipped. You sense he would rather be anywhere else.
Do you try to charm him, or do you match his coldness?

response = CAPTURE: DO
  From the user's input, determine if they are trying to be "charm" or "cold".
  Give back just one of those options - "charm" or "cold".
END

// ELSE: is a heading that can appear inside of an IF: block, indicating an alternate
// path to take if the condition wasn't met.
IF: response.result == "charm" DO
  SET: darcyMood "curious"

  NARRATOR:
  You flash a warm smile and step closer.

ELSE: DO
  SET: darcyMood "hostile"

  NARRATOR:
  You let your expression cool to match his.
  END
END
```

Variables hold strings (`"cold"`), numbers (`42`), or booleans (`true`). Use them in dialogue with `{{darcyMood}}` or in conditions.

`ELSE:` goes inside an `IF:` block for the alternate path. Note that `ELSE: DO` requires its own `END`, and the outer `IF:` also needs one.

Technical note: `CAPTURE:` stores an _object_ with sub-properties (accessed via dot syntax, like `name.value`). `SET:` stores a plain value directly, so no `.value` needed.

### Inline Variation

Sometimes you want small bits of variety without a full branch. Double brackets give you inline randomization, called "dynamic content variation" (DCV).

```well
// As the conversation continues, Bingley fills the silence with small talk.
MR. BINGLEY:
{{Delightful|Splendid|Marvelous}}! It is always a pleasure to meet new faces.

NARRATOR:
The ballroom is {{alive with chatter|buzzing with conversation|full of murmured gossip}}.
You notice {{a woman in a striking red gown|an elderly gentleman dozing in the corner|a pair of young men arguing quietly}}.

// You can also add special syntax to control how/when these dynamic options are chosen.
// With ~, the options are shuffled. Each option appears once before any can repeat, like drawing cards from a deck.
MR. BINGLEY:
{{~Have you tried the punch?|The orchestra is splendid tonight, is it not?|I do hope the weather holds.}}

// With ^, the options cycle in order: first "first", then "second", then "third", then back to "first" again.
NARRATOR:
Mr. Darcy sighs. This is the {{^first|second|third}} time you've tested his patience tonight.
```

`SET:` for memory, `IF:`/`ELSE:` for branching, `{{...}}` for variety. Simple pieces, but they combine well.

### Loops and Counters

`LOOP:` repeats a block while a condition holds. `INCR:` and `DECR:` adjust numeric variables without rewriting them.

Here, we loop a conversation with Mr. Darcy. The AI scores how irritating the player's input is. If irritation hits 1.0, Darcy storms off. If the player says goodbye, the loop exits early.

```well
SET: irritation 0

NARRATOR:
Mr. Darcy regards you with a cool, appraising stare. The conversation could go anywhere from here.

LOOP: irritation < 1.0 DO
  reply = CAPTURE: DO
    The player is speaking to Mr. Darcy, a proud and reserved gentleman.
    Based on what they said, score how irritating it would be to him.
    Return ONLY a number from 0.0 to 1.0, where 0 is perfectly polite and 1 is infuriating.
    If the player is saying goodbye or ending the conversation, return "goodbye" instead.
  END

  // If the player wants to leave, exit the loop early with BREAK:
  IF: reply.result == "goodbye" DO
    NARRATOR:
    You offer a polite nod and step away. Mr. Darcy inclines his head, barely.

    MR. DARCY:
    Good evening.

    BREAK:
  END

  // INCR: increases a variable. Here we add the irritation score to the running total.
  INCR: irritation {{reply.result}}

  // For branching on multiple conditions, CASE: with WHEN: is cleaner than nested IFs.
  // First, we convert the continuous irritation value into a discrete level.
  // calcFloor() rounds down, so 0.0-0.32 becomes 0, 0.33-0.65 becomes 1, 0.66-0.99 becomes 2.
  SET: level {{calcFloor(irritation * 3)}}

  CASE: level DO
    WHEN: 0 DO
      MR. DARCY:
      (measured) {{I see.|Quite.|Hm.}}
    END

    WHEN: 1 DO
      MR. DARCY:
      (strained) {{You are... persistent.|I find your manner peculiar.|Indeed.}}
    END

    ELSE: DO
      MR. DARCY:
      (cold) {{I grow weary of this exchange.|You try my patience.|Enough.}}
    END
  END
END

// If we exited because irritation hit 1.0, Darcy storms off.
IF: irritation >= 1.0 DO
  NARRATOR:
  Mr. Darcy's jaw tightens. Without another word, he turns on his heel and strides away.

  MR. BINGLEY:
  I do apologize. He is not always so... abrupt. Well. (with a sigh) He is. But not usually quite so much.
END
```

`LOOP:` runs its block while the condition holds. `INCR: irritation {{reply.result}}` adds the AI's score to the running total each iteration. When irritation reaches 1.0, the condition fails and execution falls through.

`BREAK:` exits the nearest loop immediately.

`CASE:...WHEN:...END` is cleaner than nested `IF:` for multi-way branching. It evaluates once and checks each `WHEN:` in order. `ELSE:` is the fallback.

Double braces can also contain expressions and function calls. Dramatoric includes helpers for strings (`strTrim()`, `toTitle()`, `toPlural()`), math (`calcFloor()`, `clamp()`, `getRoundTo()`), and more. See the Functions Reference for the full list.

### Embedded Conditionals

You can also embed `IF:` and `CASE:` _inside_ a stanza's body to include or exclude parts of what a character says based on state. Bingley's response here varies depending on what happened with Darcy:

```well
// Bingley's response varies based on how things went with Darcy.
// We enclose the stanza in DO...END to embed logic inside.
MR. BINGLEY: DO
  (awkward) Well, then...

  IF: irritation >= 1.0 DO
    I do apologize for Mr. Darcy. He can be... difficult.
  END

  IF: darcyMood == "curious" DO
    You seem to have made an impression on him. That is no small feat.
  END

  (light chuckle) I do hope you are still enjoying the ball.
END
```

If Darcy stormed off, Bingley apologizes. If the player charmed him, Bingley notices. If neither is true, those lines are absent. The speech reads naturally either way.

`CASE:` works inline too, which is useful for picking between several variants inside a longer speech:

```well
// The narrator reflects on the encounter.
NARRATOR: DO
  The music swells as the dance continues around you.

  CASE: darcyMood DO
    WHEN: "hostile" DO
      You've made an enemy tonight, it seems. Mr. Darcy will not forget this slight.
    END

    WHEN: "curious" DO
      Something has shifted. Mr. Darcy watches you now with interest rather than disdain.
    END

    ELSE: DO
      Mr. Darcy remains an enigma — cold, distant, unreadable.
    END
  END

  The evening stretches on.
END
```

Double angle brackets (`<< >>`) send instructions to the AI inline. These are called _LLM blocks_, covered in the next section. One use worth previewing: you can put an LLM block inside a conditional. The AI evaluates the statement against story context and returns a true/false result for the `IF:`.

```well
NARRATOR: DO
  IF: <<Based on the recent exchange, is Mr. Darcy openly hostile toward the player right now?>> DO
    His tone carries unmistakable frost.
  ELSE: DO
    His reserve remains intact, but not yet openly hostile.
  END
  END
END
```

### AI-Powered Dialogue with LLM Blocks

Every line of dialogue so far has been hand-written. LLM blocks let you describe a character and have the AI write their lines instead.

An LLM block is content wrapped in `<< like this >>`. When Dramatoric sees one inside a stanza, the AI generates the dialogue, staying in character based on your instructions.

```well
MR. BINGLEY:
<<
You are Mr. Bingley, a cheerful and amiable gentleman.
You are eager to make friends and always see the best in people.
You speak warmly and with genuine enthusiasm.
>>
```

The player never sees the instructions. They hear Mr. Bingley say something friendly and in character. The AI uses both your description and the conversation history, so the response fits the moment.

You can put conditionals inside an LLM block too. Dramatoric resolves them before sending anything to the AI, so you can adjust instructions based on story state:

```well
MR. DARCY: DO
  <<
  You are Mr. Darcy, a proud and reserved gentleman.

  IF: darcyMood == "hostile" DO
    You are currently quite irritated. Be curt and dismissive.
  END

  IF: darcyMood == "curious" DO
    You are intrigued by this person. Show a hint of warmth beneath your reserve.
  END

  Respond to what the player just said.
  >>
END
```

The AI only sees the final assembled instructions, not the `IF:` blocks. If `darcyMood` is `"hostile"`, Darcy's prompt includes the irritation line. If `"curious"`, he gets the warmer one. You shape behavior without writing every possible line.

Think of it as stage directions for an actor who improvises. You set the guardrails; the AI fills in the rest.

### Entities: Persistent Characters

Writing `<< >>` descriptions every time a recurring character speaks gets old. `ENTITY:` defines a character once, and Dramatoric remembers the rest. After that, any stanza with that character's name auto-generates dialogue from the stored persona.

```well
// Mr. Collins arrives! Define him as an entity.
// The body supports structured data (YAML or JSON).
// "persona" becomes the character's AI instructions; other fields become stats.
ENTITY: MR. COLLINS DO
  confidence: 10
  flattery: 100
  persona: You are Mr. Collins, a pompous and obsequious clergyman. You speak in long-winded, self-important sentences and never miss an opportunity to mention your patroness, Lady Catherine de Bourgh.
END

NARRATOR:
A portly man in clerical dress bustles toward you with alarming enthusiasm.

// MR. COLLINS is now a registered entity — just his name triggers
// AI-generated dialogue from his stored persona. No << >> block needed!
MR. COLLINS:
```

`MR. COLLINS:` with no `<< >>` block triggers AI dialogue from the stored persona. If you don't need stats, skip the YAML and write raw persona text:

```well
// Without structured data, the whole body is treated as raw persona text.
ENTITY: MRS. BENNET DO
  You are Mrs. Bennet, a nervous and excitable mother of five daughters.
  Your sole mission in life is to see them all married well.
  You speak rapidly and with great dramatic flair.
END
```

Stats are accessible with `stat()` and modifiable with `setStat()`. Check existence with `hasEntity()`. Redeclaring an entity merges new stats and replaces the persona, so characters can evolve mid-story:

```well
// Query a stat
SET: conf {{stat("MR. COLLINS", "confidence")}}

// After Mr. Collins embarrasses himself, update his entity.
// New stats merge in; the persona is replaced.
ENTITY: MR. COLLINS; confidence 2 DO
  You are Mr. Collins, freshly humiliated after a disastrous introduction.
  You are stammering and nervous.
  You still mention Lady Catherine, but with less conviction.
END

// His next line reflects his updated persona.
MR. COLLINS:
```

A `<< >>` block always overrides the entity persona for that line. Entity bodies support `{{}}` interpolation too.

```well
// << >> overrides the entity's automatic persona for this line.
MR. COLLINS:
<< Apologize to Mr. Darcy for stepping on his foot. Mention Lady Catherine at least twice. >>
```

Entities give characters persistent identity: automatic in-character dialogue, trackable stats, and mid-story updates.

## Reusable Blocks and Random Variation

`BLOCK:` defines a reusable passage. `RUN:` executes it wherever you need it.

```well
// Define blocks at the top of your story, before they're used.
BLOCK: Ballroom Ambience DO
  SOUND: loop true; duration 30s
  The murmur of conversation, clinking glasses, and a string quartet playing softly

  NARRATOR:
  Crystal chandeliers cast warm light across the room. The air smells of candle wax and perfume.
END

// Later in your story...
RUN: Ballroom Ambience

// Even later, you can run it again...
RUN: Ballroom Ambience
```

Defining a `BLOCK:` saves it without playing it. `RUN:` executes the contents in place. You can pass variables into a block:

```well
BLOCK: Character Introduction DO
  NARRATOR:
  You notice {{name}}, who appears to be {{mood}}.
END

RUN: Character Introduction; name "Mr. Collins"; mood "insufferably pleased with himself"
RUN: Character Introduction; name "Miss Bennet"; mood "quietly observant"
```

`VARY:` shuffles, picks from, or randomly omits stanzas for replay variety.

```well
// SHUFFLE randomizes the order
VARY: SHUFFLE DO
  NARRATOR:
  A woman in blue catches your eye.

  NARRATOR:
  An elderly gentleman nods in your direction.

  NARRATOR:
  Two young officers whisper and glance your way.
END

// PICK selects a specific number at random
VARY: PICK 1 DO
  MR. BINGLEY:
  Delightful weather we're having!

  MR. BINGLEY:
  Have you tried the refreshments?

  MR. BINGLEY:
  The orchestra is in fine form tonight!
END

// OMIT drops a fraction of the items (0.5 means keep about half)
VARY: SHUFFLE; OMIT 0.5 DO
  NARRATOR:
  You hear laughter from the card room.

  NARRATOR:
  A servant slips past with a tray of champagne.

  NARRATOR:
  The candles flicker as someone opens a door.
END
```

`SHUFFLE` randomizes order. `PICK 1` selects one at random. `OMIT 0.5` drops roughly half. They compose: `SHUFFLE; OMIT 0.3` shuffles, then drops ~30%.

## Structured Data and Iteration

`DATA:` defines structured data (JSON or YAML). `EACH:` iterates over it.

```well
guests = DATA: DO
  - name: Mr. Bingley
    mood: cheerful
    persona: You are warm, friendly, and eager to please.

  - name: Mr. Darcy
    mood: reserved
    persona: You are proud and guarded. You speak only when necessary.

  - name: Mr. Collins
    mood: obsequious
    persona: You are pompous and long-winded. You love to flatter.
END

NARRATOR:
Several guests approach you in turn.

EACH: guests DO |guest|
  {{guest.name}}:
  <<
  {{guest.persona}}
  Greet the player briefly.
  >>
END
```

Each guest gets an AI-generated greeting from their persona. The `|guest|` syntax names the current loop item, giving you access to `guest.name`, `guest.mood`, etc. You can also use the built-in `$element` and `$index` variables instead.

## Event Listeners

Stories flow top to bottom, but sometimes you need things to happen in the background or in response to events. `ONCE:` runs its block exactly once per session:

```well
// Place this at the top of your story
ONCE: DO
  NARRATOR:
  Welcome to Meryton. This is a story of manners, misunderstandings, and perhaps... love.
END
```

`EMIT:` fires custom events. `ON:` listens for them:

```well
// Define the handler at the top of your story
ON: darcyAngered DO
  MUSIC: duration 10s
  Tense, foreboding strings

  NARRATOR:
  The atmosphere in the room shifts. Conversations falter.
END

// Later, in the story, fire the event when appropriate
IF: irritation >= 1.0 DO
  EMIT: darcyAngered
END
```

The music and narration fire automatically whenever Darcy gets angry, regardless of where that happens in the story. `DONE:` retires a handler so it stops listening:

```well
// A one-time reaction to the player's first words
ON: $input DO
  NARRATOR:
  The room notices your presence. All eyes turn toward you.

  DONE:
END
```

After `DONE:` runs, this handler never triggers again.

## Ending the Story

`EXIT:` ends the story:

```well
// After the eventful evening, the ball winds down.
NARRATOR:
The candles burn low. Guests begin to drift toward the door.

NARRATOR: DO
  You gather your things and step out into the cool night air.

  CASE: darcyMood DO
    WHEN: "hostile" DO
      The encounter with Mr. Darcy lingers in your mind. You've made an enemy tonight.
    END

    WHEN: "curious" DO
      You smile to yourself. Mr. Darcy is an enigma — but perhaps one worth solving.
    END

    ELSE: DO
      The evening was pleasant enough. Who knows what tomorrow will bring?
    END
  END
END

EXIT:
```

That covers the language. The best way to learn is to write: make a character speak, add a choice, see what happens.

## About

Dramatoric was created by Matthew Trost, a software engineer, writer, and interactive fiction enthusiast who talked to _Dr. Sbaitso_ at age nine and never quite got over it. Dramatoric draws on a long history of text adventures and was written largely by hand, in close collaboration with AI.

## More Technical Info & API Documentation

- [Architecture](./docs/architecture.md)
- [Directives Reference](./docs/directives-reference.md)
- [Functions Reference](./docs/functions-reference.md)
- [PEG Grammar](./eng/Compiler.ts) (inline in `WELLTALE_GRAMMAR`)
- [Syntax Definitions & Language Support](.vscode/extensions/dramatoric)
- [Consumer Integration Guide](./docs/consumer-integration.md)
- [Developing & Contributing](./docs/developing-contributing.md)

## Copyright

Copyright © 2026 - All Rights Reserved
