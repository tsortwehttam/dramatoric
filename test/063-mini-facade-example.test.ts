import path from "path";
import { fileURLToPath } from "url";
import { execMultiStepTestWithMockLlm, loadCartridge, MockLlmFixture } from "./TestEngineUtils";
import { expect } from "./TestUtils";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLE_DIR = path.resolve(DIR, "..", "fic", "mini-facade");

async function test() {
  const cartridge = loadCartridge(EXAMPLE_DIR);
  const fixtures: MockLlmFixture[] = [
    {
      name: "trip interpret hi",
      systemIncludes: ["Choose the best interpretation for TRIP's reaction."],
      userIncludes: ["Input:", "\"value\":\"Hi.\"", "\"from\":\"PLAYER\"", "The player is pressing on the marriage or exposing the strain between Trip and Grace.", "__NONE__"],
      schemaIncludes: [],
      reply: "__NONE__",
    },
    {
      name: "grace interpret hi",
      systemIncludes: ["Choose the best interpretation for GRACE's reaction."],
      userIncludes: ["Input:", "\"value\":\"Hi.\"", "\"to\":[\"TRIP\",\"GRACE\"]", "The player is asking about the conch-shell photograph.", "__NONE__"],
      schemaIncludes: [],
      reply: "__NONE__",
    },
    {
      name: "trip interpret tense",
      systemIncludes: ["Choose the best interpretation for TRIP's reaction."],
      userIncludes: ["Input:", "\"value\":\"You two seem tense.\"", "The player is pressing on the marriage or exposing the strain between Trip and Grace."],
      schemaIncludes: [],
      reply: "The player is pressing on the marriage or exposing the strain between Trip and Grace.",
    },
    {
      name: "grace interpret tense",
      systemIncludes: ["Choose the best interpretation for GRACE's reaction."],
      userIncludes: ["Input:", "\"value\":\"You two seem tense.\"", "The player is asking about the conch-shell photograph.", "__NONE__"],
      schemaIncludes: [],
      reply: "__NONE__",
    },
    {
      name: "trip interpret conch",
      systemIncludes: ["Choose the best interpretation for TRIP's reaction."],
      userIncludes: ["Input:", "\"value\":\"What's the story behind that conch shell photo?\"", "__NONE__"],
      schemaIncludes: [],
      reply: "__NONE__",
    },
    {
      name: "grace interpret conch",
      systemIncludes: ["Choose the best interpretation for GRACE's reaction."],
      userIncludes: ["Input:", "\"value\":\"What's the story behind that conch shell photo?\"", "The player is asking about the conch-shell photograph."],
      schemaIncludes: [],
      reply: "The player is asking about the conch-shell photograph.",
    },
    {
      name: "trip interpret photo means",
      systemIncludes: ["Choose the best interpretation for TRIP's reaction."],
      userIncludes: ["Input:", "\"value\":\"No, really, tell me what that photo means.\"", "__NONE__"],
      schemaIncludes: [],
      reply: "__NONE__",
    },
    {
      name: "grace interpret photo means",
      systemIncludes: ["Choose the best interpretation for GRACE's reaction."],
      userIncludes: ["Input:", "\"value\":\"No, really, tell me what that photo means.\"", "The player is asking about the conch-shell photograph."],
      schemaIncludes: [],
      reply: "The player is asking about the conch-shell photograph.",
    },
    {
      name: "trip welcome",
      systemIncludes: ["Respond in character as TRIP.", "Keep Trip charming, performative, controlling, and a little brittle."],
      userIncludes: ["The visitor has only just arrived. Start with hosting charm."],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["PLAYER"],
            body: "Hey, relax. Tonight is supposed to be easy.",
          },
        ],
      },
    },
    {
      name: "grace welcome",
      systemIncludes: ["Respond in character as GRACE.", "Keep Grace poised, intelligent, wounded, and attentive to status."],
      userIncludes: ["The visitor has only just arrived. Be hospitable, but a little watchful."],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["PLAYER"],
            body: "It's good to see you. Trip has been rehearsing hospitality all afternoon.",
          },
        ],
      },
    },
    {
      name: "trip reveal",
      systemIncludes: ["Respond in character as TRIP."],
      userIncludes: [
        "Grace has you angry, and the room feels less like a performance and more like a trap.",
        "If the pressure peaks, you may let slip that your desire has not been directed only at women.",
      ],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["PLAYER", "GRACE"],
            body: "You want the truth? I have wanted things Grace could never even bear to name, much less forgive.",
          },
        ],
      },
    },
    {
      name: "trip angry",
      systemIncludes: ["Respond in character as TRIP."],
      userIncludes: ["You have had enough gin to feel warmer and less careful."],
      schemaIncludes: [],
      reply: ({ instructions }: { instructions: { role: string; content: string }[] }) => {
        const user = instructions.filter((item) => item.role === "user").map((item) => item.content).join("\n");
        const match = user.match(/id:\s+([A-Z0-9]+)[\s\S]*?path:\s+public\.mood/);
        return {
          edits: match ? [{ id: match[1], op: "replace", value: "angry" }] : [],
          actions: [
            {
              type: "say",
              to: ["PLAYER", "GRACE"],
              body: "Maybe Grace would like to tell this story instead of curating it.",
            },
          ],
        };
      },
    },
    {
      name: "grace reveal",
      systemIncludes: ["Respond in character as GRACE."],
      userIncludes: [
        "The player has brought up the conch-shell photograph from early in the marriage.",
        "If the photograph becomes the center of the room, you may admit that you had an affair early in the marriage.",
      ],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["PLAYER", "TRIP"],
            body: "Fine. I had an affair, early on, before either of us knew how to stop performing our vows.",
          },
        ],
      },
    },
    {
      name: "grace tense",
      systemIncludes: ["Respond in character as GRACE."],
      userIncludes: ["The player has brought up the conch-shell photograph from early in the marriage."],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["PLAYER"],
            body: "It was taken on a trip that was meant to mean more than it did.",
          },
        ],
      },
    },
    {
      name: "grace generic",
      systemIncludes: ["Respond in character as GRACE."],
      userIncludes: [],
      schemaIncludes: [],
      reply: {
        edits: [],
        actions: [
          {
            type: "say",
            to: ["PLAYER", "TRIP"],
            body: "Trip always thinks tension is something he can charm into furniture.",
          },
        ],
      },
    },
  ];

  const result = await execMultiStepTestWithMockLlm(
    cartridge,
    [
      {},
      {
        inputs: [
          {
            from: "PLAYER",
            raw: "Hi.",
            type: "$message",
            act: "dialog",
            to: ["TRIP", "GRACE"],
            value: "Hi.",
          },
        ],
      },
      {
        inputs: [
          {
            from: "PLAYER",
            raw: "You two seem tense.",
            type: "$message",
            act: "dialog",
            to: ["TRIP", "GRACE"],
            value: "You two seem tense.",
          },
        ],
      },
      {
        inputs: [
          {
            from: "PLAYER",
            raw: "What's the story behind that conch shell photo?",
            type: "$message",
            act: "dialog",
            to: ["TRIP", "GRACE"],
            value: "What's the story behind that conch shell photo?",
          },
        ],
      },
      {
        inputs: [
          {
            from: "PLAYER",
            raw: "No, really, tell me what that photo means.",
            type: "$message",
            act: "dialog",
            to: ["TRIP", "GRACE"],
            value: "No, really, tell me what that photo means.",
          },
        ],
      },
    ],
    fixtures,
  );

  expect(!!result.history.find((event) => event.value === "Mini Facade"), true);
  expect(
    !!result.history.find(
      (event) =>
        event.value === "The apartment is all soft lamplight, expensive surfaces, and a tension neither of them can quite hide.\nTrip hovers near the bar.\nGrace stays close to the shelf with the framed conch-shell photograph.",
    ),
    true,
  );
  expect(
    !!result.history.find((event) => event.value === "Grace's eyes flick toward the framed conch-shell photograph on the shelf."),
    true,
  );
  expect(
    !!result.history.find((event) => event.from === "TRIP" && event.value.includes("I have wanted things Grace could never even bear to name")),
    true,
  );
  expect(
    !!result.history.find((event) => event.from === "GRACE" && event.value.includes("I had an affair, early on")),
    true,
  );
  expect(result.state.round, 4);
  expect(result.state.talkedConch, true);
  expect(result.entities.TRIP.stats.private, { drunk: 2 });
  expect(result.entities.GRACE.stats.private, { drunk: 2 });
  expect(result.entities.TRIP.stats.public, { mood: "angry" });
}

test();
