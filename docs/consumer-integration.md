# Consumer Integration Guide

This guide covers how to use Dramatoric as a library in your own JavaScript/TypeScript project — whether you're building a Three.js game, a text-based client, a chatbot, or anything else.

## Overview

The consumer integration pattern looks like this:

```
Your App (Three.js, terminal, web UI, etc.)
    │
    ├── ctx.send(input)          ← push player input / structured events
    │
    ├── onEvent(event)           ← react to story output
    │
    └── Custom IOFunc            ← provide your own rendering services
            │
            ├── llm    → your LLM backend
            ├── speech → Web Speech API, ElevenLabs, etc.
            ├── sound  → Web Audio, Howler.js, etc.
            └── save   → localStorage, server, etc.
```

## Setup

### 1. Compile your story

```typescript
import { compileCartridge } from "aramatoric/eng/Compiler";
import { reifyCartridge, reifySession } from "aramatoric/eng/Helpers";

const cartridge = reifyCartridge({
  "main.dram": `
    ENTITY: GUARD; x 5; y 0; z 3; expression "neutral" DO
      You are a stern palace guard.
    END

    ON: $start DO
      NARRATOR:
      You stand in the castle courtyard.
    END

    ON: $input DO
      GUARD:
      << Respond to what the player just said. >>
    END

    ON: click DO
      IF: arrayContains($event.to, "GUARD") DO
        GUARD:
        << The player just clicked on you. React with surprise. >>
      END
    END
  `,
});
const sources = compileCartridge(cartridge);
```

### 2. Create context

```typescript
import { createContext, step, ContextCallbacks } from "aramatoric/eng/Engine";

const callbacks: ContextCallbacks = {
  onEvent: (event) => {
    // This fires for every event the engine produces.
    // Route events to your rendering layer here.
  },
  onError: (error) => {
    console.error(error);
  },
};

const session = reifySession();
const io = createMyIO(); // See "Custom IO Adapters" below
const ctx = createContext(io, session, sources, callbacks);

// Run the first step (processes $start, ONCE, PRELUDE, etc.)
await step(ctx);
```

## Sending Input

Use `ctx.send()` to push input into the engine. It queues the input and runs a step in one call.

### Text input

For natural language from the player. The engine uses an LLM to parse intent, recipients, and act type:

```typescript
await ctx.send({ from: "PLAYER", raw: "Hello there, guard" });
```

Matched by `ON: $input DO ... END` in your script.

### Structured events

For UI interactions like clicks, drags, spatial triggers, etc. When you provide `type`, `act`, `to`, and `value`, the input bypasses LLM parsing entirely:

```typescript
await ctx.send({
  from: "PLAYER",
  raw: "click",
  type: "click",
  act: "command",
  to: ["GUARD"],
  value: "clicked GUARD",
});
```

Matched by `ON: click DO ... END` in your script. You can define any custom event type you want — `hover`, `proximity`, `inventory_use`, etc.

### Accessing event data in scripts

Inside an `ON:` handler, the current event is available as `$event`:

```dramatoric
ON: click DO
  SET: target $event.to
  IF: arrayContains($event.to, "GUARD") DO
    GUARD:
    << The player clicked on you. React. >>
  END
END
```

## Receiving Events

The `onEvent` callback fires for every event the engine produces. Filter by `event.type` and `event.channel` to route them:

```typescript
const callbacks: ContextCallbacks = {
  onEvent: (event) => {
    switch (event.type) {
      case "$message":
        // Dialogue or narration
        // event.from = speaker name, event.value = text
        if (event.channel === "output") {
          renderer.showDialogue(event.from, event.value);
        }
        break;

      case "$media":
        // Sound effect or music
        // event.value = prompt/description, event.url = generated URL
        renderer.playAudio(event.url ?? event.value);
        break;

      case "$entity":
        // Entity authored entries or derived state changed
        // event.from = entity name, event.result = current state snapshot
        renderer.updateCharacter(event.from, event.result);
        break;

      case "$exit":
        // Story ended
        renderer.showCredits();
        break;
    }
  },
  onError: (error) => console.error(error),
};
```

### A Minimal Client Adapter Surface

If you want one renderer-facing contract that works for both a Three.js client
and a text client, keep it to:

- one initial snapshot
- one stream of `StoryEvent`s

The helper module [`lib/ClientAdapter.ts`](../lib/ClientAdapter.ts) projects a
full `StorySession` into a smaller client snapshot and filters out engine-only
events:

```typescript
import { buildClientSnapshot, toClientEventMessage } from "aramatoric/lib/ClientAdapter";

const snapshot = buildClientSnapshot(ctx.session);

const maybeMessage = toClientEventMessage(event);
if (maybeMessage) {
  socket.send(JSON.stringify(maybeMessage));
}
```

The projected snapshot intentionally includes only renderer-relevant entity
state:

- `kind`
- `public`
- `location`
- `space`
- `render`

It does not include engine internals like authored prompt entries, `private`, DDV state, or
handler bookkeeping.

### Event types reference

| Type       | Channel  | Description                                  |
| ---------- | -------- | -------------------------------------------- |
| `$start`   | `engine` | Session started (first step)                 |
| `$message` | `output` | Dialogue, narration, or other spoken content |
| `$message` | `input`  | Player input (parsed into semantic message)  |
| `$media`   | `output` | Sound effect, music, or image                |
| `$entity`  | `engine` | Entity authored entries or derived state changed |
| `$wait`    | `output` | Pause for dramatic timing                    |
| `$exit`    | `engine` | Story ended                                  |

### Key fields on `StoryEvent`

| Field        | Type             | Description                                                               |
| ------------ | ---------------- | ------------------------------------------------------------------------- |
| `type`       | `string`         | Event type (see above, or custom)                                         |
| `channel`    | `string`         | `"input"`, `"output"`, `"emit"`, `"engine"`                               |
| `from`       | `string`         | Who produced this event (character name, `"PLAYER"`, `"ENGINE"`)          |
| `to`         | `string[]`       | Intended recipients                                                       |
| `value`      | `string`         | Text content                                                              |
| `result`     | `SerialValue`    | Structured data (e.g., changed entity stats)                              |
| `act`        | `string`         | Intent classification: `"dialog"`, `"command"`, `"media"`, `"info"`, etc. |
| `url`        | `string \| null` | Attached media URL                                                        |
| `duration`   | `number`         | Duration in seconds (for `$wait`, timed media)                            |
| `loop`       | `number`         | Loop count (for music/sound)                                              |
| `background` | `number`         | 0 = foreground, 1 = background                                            |

## Entities as Game State

Entity stats are arbitrary key-value pairs. Use them to store spatial, visual, or any other state your rendering layer needs:

```dramatoric
ENTITY: GUARD; x 5; y 0; z 3; facing "door"; expression "neutral" DO
  You are a stern palace guard.
END
```

### Updating entity state from scripts

```dramatoric
// Update via redeclaration (merges routed fields and replaces prompt lines when present)
ENTITY: GUARD; x 2; z 1; expression "alert" DO
  You are a palace guard who just noticed something suspicious.
END

// Update individual stats via setStat()
SET: _ {{setStat("GUARD", "expression", "angry")}}
SET: _ {{setStat("GUARD", "x", 0)}}
```

### Reacting to changes on the consumer side

Both approaches emit `$entity` events through `onEvent`:

- **`ENTITY:` directive** emits the entity's current derived state snapshot
- **`setStat()`** emits the current derived state snapshot after the mutation

```typescript
onEvent: (event) => {
  if (event.type === "$entity") {
    const name = event.from; // "GUARD"
    const changes = event.result; // { expression: "angry" } or full snapshot
    scene.getCharacter(name).applyChanges(changes);
  }
};
```

### Reading entity state directly

You can also read entity state at any time from the session:

```typescript
const guard = ctx.session.entities["GUARD"];
guard.stats.x; // 5
guard.stats.expression; // "neutral"
guard.entries; // Authored prompt/state entries with stable ids
```

## Custom IO Adapters

The IO adapter is how you provide external services to the engine. The default `createIO()` uses Anthropic/OpenAI for LLM calls, ElevenLabs for audio, and S3/local for caching. For a browser-based project, you'll want your own.

An `IOFunc` is a single async function that handles requests by `kind`:

```typescript
import { IOFunc, IORequest, IOResult } from "aramatoric/eng/Helpers";

function createBrowserIO(): IOFunc {
  return async (request) => {
    switch (request.kind) {
      case "llm":
        // Route to your LLM backend (API proxy, local model, etc.)
        const response = await fetch("/api/llm", {
          method: "POST",
          body: JSON.stringify({
            instructions: request.instructions,
            schema: request.schema,
            models: request.models,
          }),
        });
        return response.json();

      case "speech":
        // Use Web Speech API, or skip if text-only
        const utterance = new SpeechSynthesisUtterance(request.text);
        speechSynthesis.speak(utterance);
        return { url: "" };

      case "sound":
      case "music":
        // Generate or fetch audio
        return { url: "" };

      case "image":
        // Generate or fetch images
        return { url: "" };

      case "save":
        localStorage.setItem(`aramatoric:${request.uid}`, JSON.stringify(request.session));
        return undefined as never;

      case "load":
        const saved = localStorage.getItem(`aramatoric:${request.uid}`);
        return saved ? JSON.parse(saved) : null;

      case "fetch":
        const res = await fetch(request.url);
        return {
          status: res.status,
          data: await res.text(),
          contentType: res.headers.get("content-type") ?? "",
        };
    }
  };
}
```

### IO request kinds

| Kind     | Input                              | Output                          | Description                           |
| -------- | ---------------------------------- | ------------------------------- | ------------------------------------- |
| `llm`    | `instructions`, `schema`, `models` | Parsed JSON matching schema     | LLM generation with structured output |
| `speech` | `text`, `voice`                    | `{ url }`                       | Text-to-speech                        |
| `sound`  | `prompt`, `durationMs`             | `{ url }`                       | Sound effect generation               |
| `music`  | `prompt`, `durationMs`             | `{ url }`                       | Music generation                      |
| `image`  | `prompt`                           | `{ url }`                       | Image generation                      |
| `save`   | `uid`, `session`                   | `void`                          | Persist session state                 |
| `load`   | `uid`                              | `StorySession \| null`          | Load persisted session                |
| `fetch`  | `url`                              | `{ status, data, contentType }` | HTTP fetch                            |

The `llm` kind is the only one that's essential — everything else can return stubs if your project doesn't need audio, images, or persistence.

## Non-JavaScript Platforms (Unity, Godot, Unreal, etc.)

Dramatoric is written in TypeScript, but any platform that can open a WebSocket connection can consume it. Dramatoric ships a WebSocket server (`web/wss.ts`) that runs the engine server-side and exposes a JSON wire protocol. Your game client connects, sends input, and receives story events — no JS runtime required on the client side.

### Architecture

```
┌─────────────────────────┐       WebSocket (JSON)       ┌──────────────────┐
│  Dramatoric Server (Node)  │ ◄──────────────────────────► │  Your Game Client │
│                          │                              │  (Unity, Godot,   │
│  • Engine + IO adapter   │  ← boot, manual_input_final  │   Unreal, etc.)   │
│  • Story compilation     │  → game_event, game_error    │                   │
│  • LLM calls, caching    │                              │  • Rendering      │
└─────────────────────────┘                               │  • Input capture  │
                                                          └──────────────────┘
```

### Starting the server

```bash
# Set up .env with API keys, then:
npx tsx web/wss.ts
# Listens on ws://localhost:8787 (configurable via AUDIO_WS_PORT)
```

### Wire protocol

All messages are JSON objects with a `type` field. The full protocol is defined in `lib/SocketTypings.ts`.

**Client → Server (inbound):**

| Message              | Fields                              | Description                                     |
| -------------------- | ----------------------------------- | ----------------------------------------------- |
| `boot`               | `cartridge`, `session?`, `sources?` | Initialize a new game session with story source |
| `manual_input_final` | `text`                              | Send player text input                          |
| `get_session`        | —                                   | Request a full session state snapshot           |

**Server → Client (outbound):**

| Message            | Fields                  | Description                                        |
| ------------------ | ----------------------- | -------------------------------------------------- |
| `game_event`       | `data: StoryEvent`      | Story event (dialogue, media, entity change, etc.) |
| `game_error`       | `message`               | Error from engine or compiler                      |
| `session_snapshot` | `session: StorySession` | Full session state (in response to `get_session`)  |

### Example: Unity (C#)

Unity has built-in WebSocket support via `ClientWebSocket`. Here's the basic pattern:

```csharp
using System;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using UnityEngine;

public class DramatoricClient : MonoBehaviour
{
    ClientWebSocket ws;

    async void Start()
    {
        ws = new ClientWebSocket();
        await ws.ConnectAsync(new Uri("ws://localhost:8787"), CancellationToken.None);

        // Boot with story source
        await Send(JsonUtility.ToJson(new {
            type = "boot",
            cartridge = new { main_well = "your .dram script here" }
        }));

        // Start receiving events
        _ = ReceiveLoop();
    }

    async System.Threading.Tasks.Task ReceiveLoop()
    {
        var buffer = new byte[8192];
        while (ws.State == WebSocketState.Open)
        {
            var result = await ws.ReceiveAsync(buffer, CancellationToken.None);
            var json = Encoding.UTF8.GetString(buffer, 0, result.Count);
            HandleMessage(json);
        }
    }

    void HandleMessage(string json)
    {
        // Parse JSON, check "type" field
        // "game_event" → route data.type ($message, $entity, $media, etc.)
        // Use your preferred JSON library (Newtonsoft, etc.)
    }

    public async void SendInput(string text)
    {
        var msg = JsonUtility.ToJson(new {
            type = "manual_input_final",
            text = text
        });
        await Send(msg);
    }

    async System.Threading.Tasks.Task Send(string json)
    {
        var bytes = Encoding.UTF8.GetBytes(json);
        await ws.SendAsync(bytes, WebSocketMessageType.Text, true, CancellationToken.None);
    }
}
```

### Example: Godot (GDScript)

Godot has `WebSocketPeer` built in:

```gdscript
extends Node

var ws = WebSocketPeer.new()

func _ready():
    ws.connect_to_url("ws://localhost:8787")

func _process(_delta):
    ws.poll()
    while ws.get_available_packet_count() > 0:
        var json = JSON.parse_string(ws.get_packet().get_string_from_utf8())
        handle_message(json)

func boot(story_source: String):
    var msg = JSON.stringify({
        "type": "boot",
        "cartridge": { "main.dram": story_source }
    })
    ws.send_text(msg)

func send_input(text: String):
    var msg = JSON.stringify({
        "type": "manual_input_final",
        "text": text
    })
    ws.send_text(msg)

func handle_message(msg: Dictionary):
    match msg.get("type"):
        "game_event":
            var event = msg["data"]
            match event.get("type"):
                "$message":
                    print("%s: %s" % [event["from"], event["value"]])
                "$entity":
                    # Update character state in your scene
                    pass
                "$media":
                    # Play audio
                    pass
        "game_error":
            push_error(msg["message"])
```

### Embedded JS runtimes

If you'd rather run the engine in-process (no server), some platforms can embed a JavaScript runtime directly:

- **Unity**: [Jint](https://github.com/sebastienros/jint) (pure .NET JS interpreter, no native deps) or [PuerTS](https://github.com/nicholasxuu/PuerTS) (V8-based, faster but platform-specific)
- **Unreal**: V8 can be embedded via plugins
- **Any platform with C FFI**: QuickJS is a lightweight embeddable JS engine

The WebSocket approach is simpler to set up and keeps the engine in its native environment. The embedded approach removes the network hop but requires more integration work.

## Full Example: Three.js Integration

Putting it all together for a Facade-style 3D scene:

```typescript
import { compileCartridge } from "aramatoric/eng/Compiler";
import { createContext, step } from "aramatoric/eng/Engine";
import { reifyCartridge, reifySession } from "aramatoric/eng/Helpers";

// 1. Compile story
const cartridge = reifyCartridge(storySource);
const sources = compileCartridge(cartridge);

// 2. Wire up event handling
const ctx = createContext(createBrowserIO(), reifySession(), sources, {
  onEvent: (event) => {
    switch (event.type) {
      case "$message":
        if (event.channel === "output") {
          // Animate character speaking
          const char = scene.getCharacter(event.from);
          char.speak(event.value);
          ui.showSubtitle(event.from, event.value);
        }
        break;

      case "$entity":
        // Update character position, expression, etc.
        const char = scene.getCharacter(event.from);
        char.applyState(event.result);
        break;

      case "$media":
        scene.playAudio(event.value, {
          loop: event.loop > 0,
          volume: event.volume,
        });
        break;
    }
  },
  onError: console.error,
});

// 3. Boot
await step(ctx);

// 4. Handle player interactions
textInput.onSubmit = (text) => {
  ctx.send({ from: "PLAYER", raw: text });
};

scene.onClickCharacter = (name) => {
  ctx.send({
    from: "PLAYER",
    raw: "click",
    type: "click",
    act: "command",
    to: [name],
    value: `clicked ${name}`,
  });
};
```
