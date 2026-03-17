import { SerialValue } from "./CoreTypings";
import { BlendStrategy, NPC, Settings, Traits } from "./NPC";

export type LineageSpec = {
  adam: Record<string, SerialValue>;
  eve: Record<string, SerialValue>;
  blend: Record<string, BlendStrategy>;
  depth: number;
  traits: Record<string, Record<string, SerialValue>>;
};

const DEFAULT_DEPTH = 2;

function buildSettings(spec: LineageSpec): Settings<Traits> {
  return {
    adam: spec.adam as Traits,
    eve: spec.eve as Traits,
    traits(id: bigint): Partial<Traits> {
      return (spec.traits[id.toString()] ?? {}) as Partial<Traits>;
    },
    bioFather(): bigint | null {
      return null;
    },
    blendRule(key: string): BlendStrategy {
      return spec.blend[key] ?? "average";
    },
    lifespan(_id: bigint, gen: bigint) {
      return { birth: gen * 30n, death: gen * 30n + 70n };
    },
    exists() {
      return true;
    },
  };
}

function serializeTraits(traits: Traits): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(traits)) {
    if (v === undefined) continue;
    const val = typeof v === "number" ? Math.round(v * 1000) / 1000 : v;
    parts.push(`${k}: ${val}`);
  }
  return parts.join(", ");
}

function describeNpc(npc: NPC<Traits>, nameKey: string): string {
  const name = npc.traits[nameKey];
  const label = name ? String(name) : `NPC ${npc.id}`;
  const gender = npc.isFemale ? "female" : "male";
  const traits = serializeTraits(npc.traits);
  return `${label} (id ${npc.id}, ${gender}, gen ${npc.generation}) — ${traits}`;
}

function collectSiblings(npc: NPC<Traits>, nameKey: string): string[] {
  const mother = npc.bioMother;
  if (!mother) return [];
  return mother.children
    .filter((c) => c.id !== npc.id)
    .map((c) => describeNpc(c, nameKey));
}

export function formatAncestry(spec: LineageSpec, npcId: number, depth?: number): string {
  const settings = buildSettings(spec);
  const npc = new NPC(settings, BigInt(npcId));
  const d = depth ?? spec.depth ?? DEFAULT_DEPTH;
  const nameKey = findNameKey(spec.adam);
  const lines: string[] = [];

  lines.push("[ANCESTRY — canonical facts about your family; never contradict these]");
  lines.push(`You: ${describeNpc(npc, nameKey)}`);

  const siblings = collectSiblings(npc, nameKey);
  if (siblings.length > 0) {
    lines.push(`Siblings: ${siblings.join("; ")}`);
  }

  let current: NPC<Traits> = npc;
  for (let gen = 0; gen < d; gen++) {
    const mother = current.bioMother;
    const father = current.bioFather;
    if (!mother || !father) break;
    const prefix = gen === 0 ? "" : "Great-".repeat(gen - 1) + "Grand";
    lines.push(`${prefix}Mother: ${describeNpc(mother, nameKey)}`);
    lines.push(`${prefix}Father: ${describeNpc(father, nameKey)}`);
    current = mother;
  }

  return lines.join("\n");
}

export function formatAncestryAsData(spec: LineageSpec, npcId: number, depth?: number): SerialValue {
  const settings = buildSettings(spec);
  const npc = new NPC(settings, BigInt(npcId));
  const d = depth ?? spec.depth ?? DEFAULT_DEPTH;
  const nameKey = findNameKey(spec.adam);

  const result: Record<string, SerialValue> = {
    id: npcId,
    generation: Number(npc.generation),
    isFemale: npc.isFemale,
    traits: traitsToSerial(npc.traits),
  };

  const ancestors: SerialValue[] = [];
  let current: NPC<Traits> = npc;
  for (let gen = 0; gen < d; gen++) {
    const mother = current.bioMother;
    const father = current.bioFather;
    if (!mother || !father) break;
    ancestors.push({
      depth: gen + 1,
      mother: {
        id: Number(mother.id),
        name: mother.traits[nameKey] ? String(mother.traits[nameKey]) : `NPC ${mother.id}`,
        traits: traitsToSerial(mother.traits),
      },
      father: {
        id: Number(father.id),
        name: father.traits[nameKey] ? String(father.traits[nameKey]) : `NPC ${father.id}`,
        traits: traitsToSerial(father.traits),
      },
    });
    current = mother;
  }
  result.ancestors = ancestors;

  const sibs: SerialValue[] = [];
  const mother = npc.bioMother;
  if (mother) {
    for (const c of mother.children) {
      if (c.id !== npc.id) {
        sibs.push({
          id: Number(c.id),
          name: c.traits[nameKey] ? String(c.traits[nameKey]) : `NPC ${c.id}`,
          traits: traitsToSerial(c.traits),
        });
      }
    }
  }
  result.siblings = sibs;

  return result;
}

function findNameKey(adam: Record<string, SerialValue>): string {
  for (const key of ["name", "fullName", "firstName", "label", "surname"]) {
    if (key in adam) return key;
  }
  return "name";
}

function traitsToSerial(traits: Traits): SerialValue {
  const out: Record<string, SerialValue> = {};
  for (const [k, v] of Object.entries(traits)) {
    if (v === undefined) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else {
      out[k] = String(v);
    }
  }
  return out;
}
