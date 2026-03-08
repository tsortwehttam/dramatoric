import { parseDSL, parseWellFormedDSL } from "../eng/Compiler";
import { dumpNode } from "../eng/Helpers";
import { expect } from "./TestUtils";

const example = `
CASE: mood DO
  WHEN: calm DO
    HOST: DO
    You breathe slowly.
    END
  END

  WHEN: tense DO
    HOST: DO
    Your pulse quickens.
    END
  END

  ELSE: DO
    HOST: DO
    You steady yourself.
    END
  END
END

SET: foo 2

NARRATOR: DO
Welcome to the story.
This is a multi-line narration.
END

BOB SMITH: DO
Hey, you!
END

MR. JONES: DO
What do you want?
I'm busy.
END

JANE'S FRIEND: DO
I'm here with Jim.
END

ÉLODIE: DO
Enchantée.
END

WAIT: duration 2s

MUSIC: duration 5s DO
Mysterious, suspenseful piano music
END

IF: anger > 10 DO
  BOB SMITH: DO
  I'm tired of you!
  END

  SET: relief 100

  WHILE: relief < 1000; moo === "cow"; foo ? bar : baz; trip(over(yourself("already"))) DO
    NARRATOR: DO
    Still not relieved.
    END

    IF: relief == 500 DO
      NARRATOR:
      Almost there.

      BREAK:
    END
  END
END

name = CAPTURE:

SET: chunks array()

chunk = LLM: DO
  Generate some content about {{topic}}.
  Make it interesting.

  IF: arrayLength(chunks) > 0 DO
    Base it off of the previous content of the program:
    ---
    {{ arrayJoin(chunks, "\\n\\n") }}
    ---
  END

  Use a kind tone of voice.
END

response1, response2 = RESPOND: args here

items[] = FETCH: url

a, b, rest[] = DESTRUCTURE: something

GOTO: The Chatsubo

SCENE: The Chatsubo DO
  SET: ChatEnv DO
    A dim, grimy bar.
  END

  NARRATOR:
  The bar smells of ozone and cheap gin.
  You enter.
  The cacaphony of noises and smells grabs you.

  ENTITY: RATZ DO
    You are Ratz, a bartender.
  END

  LOOP: DO
    input = CAPTURE: $resolve

    reply[] = REPLY: input

    EACH: reply DO |item, idx|
      SAY: $element
    END
  END
END

EACH: items DO |el|
  LOG: $el
END

result = MAP: collection DO |value, key|
  RETURN: $value * 2
END

SOUND: duration 5s
A mysterious sound.

EVENT: $exit DO
  HOST: DO
  Goodbye!
  END
END

note = HOST: excited
I am so excited!
This is implicit.

JIM JONES:
I love you.
I really, really love you.

JANE:
I know.
Colon\: should stay.
`;

const result = `
ROOT
  CASE: mood
    WHEN: calm
      HOST
        "You breathe slowly."
    WHEN: tense
      HOST
        "Your pulse quickens."
    ELSE
      HOST
        "You steady yourself."
  SET: foo 2
  NARRATOR
    "Welcome to the story."
    "This is a multi-line narration."
  BOB SMITH
    "Hey, you!"
  MR. JONES
    "What do you want?"
    "I'm busy."
  JANE'S FRIEND
    "I'm here with Jim."
  ÉLODIE
    "Enchantée."
  WAIT: duration 2s
  MUSIC: duration 5s
    "Mysterious, suspenseful piano music"
  IF: anger > 10
    BOB SMITH
      "I'm tired of you!"
    SET: relief 100
    WHILE: relief < 1000; moo === "cow"; foo ? bar : baz; trip(over(yourself("already")))
      NARRATOR
        "Still not relieved."
      IF: relief == 500
        NARRATOR
          "Almost there."
        BREAK
  CAPTURE [name]
  SET: chunks array()
  LLM [chunk]
    "Generate some content about {{topic}}."
    "Make it interesting."
    IF: arrayLength(chunks) > 0
      "Base it off of the previous content of the program:"
      "---"
      "{{ arrayJoin(chunks, "\\n\\n") }}"
      "---"
    "Use a kind tone of voice."
  RESPOND [response1, response2]: args here
  FETCH [items[]]: url
  DESTRUCTURE [a, b, rest[]]: something
  GOTO: The Chatsubo
  SCENE: The Chatsubo
    SET: ChatEnv
      "A dim, grimy bar."
    NARRATOR
      "The bar smells of ozone and cheap gin."
      "You enter."
      "The cacaphony of noises and smells grabs you."
    ENTITY: RATZ
      "You are Ratz, a bartender."
    LOOP
      CAPTURE [input]: $resolve
      REPLY [reply[]]: input
      EACH |item, idx|: reply
        SAY: $element
  EACH |el|: items
    LOG: $el
  MAP [result] |value, key|: collection
    RETURN: $value * 2
  SOUND: duration 5s
    "A mysterious sound."
  EVENT: $exit
    HOST
      "Goodbye!"
  HOST [note]: excited
    "I am so excited!"
    "This is implicit."
  JIM JONES
    "I love you."
    "I really, really love you."
  JANE
    "I know."
    "Colon: should stay."
`.trim();

async function test() {
  const r1 = parseWellFormedDSL(example);
  if ("node" in r1) {
    const d1 = dumpNode(r1.node);
    expect(d1, result);
  } else {
    throw "parseWellFormedDSL failed";
  }

  // Even though parseDSL does some extra work, check to ensure well-formed DSL works through it too
  const r2 = parseDSL(example);
  if ("root" in r2) {
    const d2 = dumpNode(r2.root);
    expect(d2, result);
  } else {
    throw "parseDSL failed";
  }
}

function testDynamicHeaders() {
  // Test template expression as header
  const tpl1 = `{{speaker.name}}:\nHello there!\n`;
  const r1 = parseWellFormedDSL(tpl1);
  if ("node" in r1) {
    expect(r1.node.kids[0].type, "{{speaker.name}}");
    expect(r1.node.kids[0].kids[0].args, "Hello there!");
    console.info("[test] ✅ Template expression header: {{speaker.name}}");
  } else {
    throw "Template header parse failed";
  }

  // Test template with surrounding text (uppercase preserved outside, lowercase inside)
  const tpl2 = `MR. {{guest.title}}:\nWelcome!\n`;
  const r2 = parseWellFormedDSL(tpl2);
  if ("node" in r2) {
    expect(r2.node.kids[0].type, "MR. {{guest.title}}");
    console.info("[test] ✅ Mixed template header: MR. {{guest.title}}");
  } else {
    throw "Mixed template header parse failed";
  }

  // Test Japanese characters
  const jp = `田中さん:\nこんにちは！\n`;
  const rjp = parseWellFormedDSL(jp);
  if ("node" in rjp) {
    expect(rjp.node.kids[0].type, "田中さん");
    expect(rjp.node.kids[0].kids[0].args, "こんにちは！");
    console.info("[test] ✅ Japanese header: 田中さん");
  } else {
    throw "Japanese header parse failed";
  }

  // Test Korean characters
  const kr = `김선생님:\n안녕하세요!\n`;
  const rkr = parseWellFormedDSL(kr);
  if ("node" in rkr) {
    expect(rkr.node.kids[0].type, "김선생님");
    console.info("[test] ✅ Korean header: 김선생님");
  } else {
    throw "Korean header parse failed";
  }

  // Test emoji header
  const emoji = `🎭 NARRATOR:\nThe play begins.\n`;
  const remoji = parseWellFormedDSL(emoji);
  if ("node" in remoji) {
    expect(remoji.node.kids[0].type, "🎭 NARRATOR");
    console.info("[test] ✅ Emoji header: 🎭 NARRATOR");
  } else {
    throw "Emoji header parse failed";
  }

  // Test nested template expressions
  const nested = `{{char.first}} {{char.last}}:\nGreetings.\n`;
  const rnested = parseWellFormedDSL(nested);
  if ("node" in rnested) {
    expect(rnested.node.kids[0].type, "{{char.first}} {{char.last}}");
    console.info("[test] ✅ Multiple template header: {{char.first}} {{char.last}}");
  } else {
    throw "Nested template header parse failed";
  }

  // Test block shorthand with template header and args
  const block = `{{speaker.name}}: {{foo.bar * 3}} {\nHello there!\n}\n`;
  const rblock = parseWellFormedDSL(block);
  if ("node" in rblock) {
    const node = rblock.node.kids[0];
    expect(node.type, "{{speaker.name}}");
    expect(node.args, "{{foo.bar * 3}}");
    expect(node.kids[0].args, "Hello there!");
    console.info("[test] ✅ Template header/args with { } block");
  } else {
    throw "Block shorthand parse failed";
  }

  // Ensure YAML-like lines are NOT parsed as headers (hyphen excluded)
  const yaml = `DATA: DO\n- name: value\n- other: thing\nEND\n`;
  const ryaml = parseWellFormedDSL(yaml);
  if ("node" in ryaml) {
    expect(ryaml.node.kids[0].type, "DATA");
    expect(ryaml.node.kids[0].kids[0].type, "TEXT");
    expect(ryaml.node.kids[0].kids[0].args, "- name: value");
    console.info("[test] ✅ YAML lines not parsed as headers");
  } else {
    throw "YAML content parse failed";
  }

  // Ensure lowercase starting lines are NOT parsed as headers
  const lower = `NARRATOR:\nlowercase line with a colon: here\n`;
  const rlower = parseWellFormedDSL(lower);
  if ("node" in rlower) {
    expect(rlower.node.kids[0].kids[0].type, "TEXT");
    expect(rlower.node.kids[0].kids[0].args, "lowercase line with a colon: here");
    console.info("[test] ✅ Lowercase lines not parsed as headers");
  } else {
    throw "Lowercase content parse failed";
  }
}

test();
testDynamicHeaders();

function testBlockComments() {
  const input = `NARRATOR:\nHello /* mid */ there.\n/* block\ncomment */\nSET: foo 1\nNARRATOR:\nAfter.\n`;
  const r = parseDSL(input);
  if ("root" in r) {
    const kids = r.root.kids;
    expect(kids[0].type, "NARRATOR");
    expect(kids[0].kids[0].args, "Hello           there.");
    expect(kids[1].type, "SET");
    expect(kids[2].type, "NARRATOR");
    expect(kids[2].kids[0].args, "After.");
  } else {
    throw "parseDSL failed";
  }
}

testBlockComments();
