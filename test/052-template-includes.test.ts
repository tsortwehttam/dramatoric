import dedent from "dedent";
import { execStoryTest } from "./TestEngineUtils";
import { expect, expectHas } from "./TestUtils";

const MOCK = true;

async function test() {
  let result = await execStoryTest(
    dedent`
      SET: hits 0

      TEMPLATE: Counter DO
        tick {{set("hits", get("hits") + 1)}}
      END

      NARRATOR:
      No template used.
    `,
    {},
    MOCK
  );
  expect(result.state.hits, 0);

  result = await execStoryTest(
    dedent`
      SET: hits 0

      TEMPLATE: Counter DO
        tick {{set("hits", get("hits") + 1)}}
      END

      NARRATOR: DO
        INCLUDE: Counter
        INCLUDE: Counter
      END
    `,
    {},
    MOCK
  );
  expect(result.state.hits, 2);
  expectHas(result.history[1], {
    from: "NARRATOR",
    value: "tick 1\ntick 2",
  });

  result = await execStoryTest(
    dedent`
      TEMPLATE: Greeting; salutation "Hello"; punct "!" DO
        {{salutation}} {{name}}{{punct}}
      END

      NARRATOR: DO
        INCLUDE: Greeting; name "Iris"
      END
    `,
    {},
    MOCK
  );
  expectHas(result.history[1], {
    value: "Hello Iris!",
  });

  result = await execStoryTest(
    dedent`
      TEMPLATE: Greeting; salutation "Hello"; punct "!" DO
        {{salutation}} {{name}}{{punct}}
      END

      NARRATOR: DO
        INCLUDE: Greeting; salutation "Welcome"; name "Iris"
      END
    `,
    {},
    MOCK
  );
  expectHas(result.history[1], {
    value: "Welcome Iris!",
  });

  result = await execStoryTest(
    dedent`
      TEMPLATE: Greeting; salutation "Hello"; punct "!" DO
        {{salutation}} {{name}}{{punct}}
      END

      NARRATOR: DO
        INCLUDE: Greeting
      END
    `,
    {},
    MOCK
  );
  expectHas(result.history[1], {
    value: "Hello !",
  });

  result = await execStoryTest(
    dedent`
      SET: name "Rosa"

      TEMPLATE: Greeting; salutation "Hello"; punct "!" DO
        {{salutation}} {{name}}{{punct}}
      END

      NARRATOR:
      {{include("Greeting")}}
    `,
    {},
    MOCK
  );
  expectHas(result.history[1], {
    value: "Hello Rosa!",
  });

  result = await execStoryTest(
    dedent`
      TEMPLATE: Signoff; punct "!" DO
        {{punct}}
      END

      TEMPLATE: Greeting; salutation "Hello"; punct "!" DO
        {{salutation}} {{name}}
        INCLUDE: Signoff; punct punct
      END

      NARRATOR: DO
        INCLUDE: Greeting; name "Iris"; punct "?"
      END
    `,
    {},
    MOCK
  );
  expectHas(result.history[1], {
    value: "Hello Iris\n?",
  });

  result = await execStoryTest(
    dedent`
      TEMPLATE: Persona Bits; mood "stern" DO
        You are a guard. Mood: {{mood}}.
      END

      ENTITY: GUARD DO
        persona: "{{include('Persona Bits', { mood: 'grim' })}}"
      END
    `,
    {},
    MOCK
  );
  expect(result.entities.GUARD.persona, "You are a guard. Mood: grim.");
}

test();
