export type Traits = Record<string, unknown>;

export interface Lifespan {
  birth: bigint;
  death: bigint;
}

export type BlendFn = (mother: unknown, father: unknown, id: bigint) => unknown;
export type BlendStrategy = "average" | "mother" | "father";
export type BlendRule = BlendStrategy | BlendFn;

export interface Settings<T extends Traits> {
  adam: T;
  eve: T;
  traits(id: bigint): Partial<T>;
  bioFather(id: bigint): bigint | null;
  blendRule?(key: keyof T): BlendRule;
  blend?(id: bigint, mother: T, father: T): T;
  lifespan(id: bigint, generation: bigint): Lifespan;
  exists(id: bigint, npc: NPC<T>): boolean;
}

function genStart(gen: bigint): bigint {
  return (1n << (gen + 1n)) - 2n;
}

function generation(n: bigint): bigint {
  if (n < 0n) throw new Error(`Invalid person index: ${n}`);
  let v = n + 2n;
  let k = -1n;
  while (v > 0n) {
    v >>= 1n;
    k++;
  }
  return k - 1n;
}

const MASK64 = 0xffffffffffffffffn;

function mixBits(n: bigint): bigint {
  let h = ((n < 0n ? -n : n) ^ ((n < 0n ? -n : n) >> 33n)) & MASK64;
  h = (h * 0xff51afd7ed558ccdn) & MASK64;
  h = (h ^ (h >> 33n)) & MASK64;
  h = (h * 0xc4ceb9fe1a85ec53n) & MASK64;
  h = (h ^ (h >> 33n)) & MASK64;
  return h;
}

const SHUFFLE_ROUNDS = 3n;

function modInverse(a: bigint, m: bigint): bigint {
  let [old_r, r] = [((a % m) + m) % m, m];
  let [old_s, s] = [1n, 0n];
  while (r !== 0n) {
    const q = old_r / r;
    [old_r, r] = [r, old_r - q * r];
    [old_s, s] = [s, old_s - q * s];
  }
  return ((old_s % m) + m) % m;
}

function lcgParams(gen: bigint, round: bigint): { a: bigint; c: bigint; mask: bigint } {
  const numPairs = 1n << gen;
  const mask = numPairs - 1n;
  const a = (mixBits(gen * 0x9e3779b97f4a7c15n + round * 0x517cc1b727220a95n) & mask) | 1n;
  const c = mixBits(gen * 0x6c62272e07bb0142n + round * 0xff51afd7ed558ccdn) & mask;
  return { a, c, mask };
}

function shuffleMate(femaleIdx: bigint, gen: bigint): bigint {
  if (gen <= 0n) return 0n;
  let x = femaleIdx;
  for (let r = 0n; r < SHUFFLE_ROUNDS; r++) {
    const { a, c, mask } = lcgParams(gen, r);
    x = (a * x + c) & mask;
  }
  return x;
}

function inverseShuffleMate(maleIdx: bigint, gen: bigint): bigint {
  if (gen <= 0n) return 0n;
  const numPairs = 1n << gen;
  let x = maleIdx;
  for (let r = SHUFFLE_ROUNDS - 1n; r >= 0n; r--) {
    const { a, c, mask } = lcgParams(gen, r);
    const aInv = modInverse(a, numPairs);
    x = (aInv * ((x - c) & mask)) & mask;
  }
  return x;
}

function structuralMother(n: bigint): bigint | null {
  if (n <= 1n) return null;
  const gen = generation(n);
  const offset = n - genStart(gen);
  const pairIndex = offset >> 1n;
  const parentPairIndex = pairIndex >> 1n;
  const parentGenStart = genStart(gen - 1n);
  return parentGenStart + parentPairIndex * 2n;
}

function structuralFather(n: bigint): bigint | null {
  if (n <= 1n) return null;
  const gen = generation(n);
  const offset = n - genStart(gen);
  const pairIndex = offset >> 1n;
  const motherPairIndex = pairIndex >> 1n;
  const parentGen = gen - 1n;
  const parentGenStart = genStart(parentGen);
  const fatherPairIndex = shuffleMate(motherPairIndex, parentGen);
  return parentGenStart + fatherPairIndex * 2n + 1n;
}

function structuralChildren(n: bigint): [bigint, bigint, bigint, bigint] {
  const gen = generation(n);
  const gs = genStart(gen);
  const pairIndex = (n - gs) >> 1n;
  const femalePairIndex = n % 2n === 0n ? pairIndex : inverseShuffleMate(pairIndex, gen);
  const childGenStart = genStart(gen + 1n);
  const base = childGenStart + femalePairIndex * 4n;
  return [base, base + 1n, base + 2n, base + 3n];
}

function driftedFather(n: bigint): bigint | null {
  if (n <= 1n) return null;
  const gen = generation(n);
  const parentGen = gen - 1n;
  const parentGenStart = genStart(parentGen);
  const numMales = 1n << parentGen;
  if (numMales <= 1n) return null;
  if (mixBits(n) % 20n !== 0n) return null;
  const structural = structuralFather(n)!;
  const structuralMaleIdx = (structural - parentGenStart - 1n) / 2n;
  const h = mixBits(n * 0x9e3779b97f4a7c15n);
  const offset = 1n + (h % (numMales - 1n));
  const newMaleIdx = (structuralMaleIdx + offset) % numMales;
  return parentGenStart + newMaleIdx * 2n + 1n;
}

function applyBlendRule(rule: BlendRule, m: unknown, f: unknown, id: bigint): unknown {
  if (typeof rule === "function") return rule(m, f, id);
  if (rule === "mother") return m;
  if (rule === "father") return f;
  if (typeof m === "number" && typeof f === "number") return (m + f) / 2;
  return m;
}

interface Cache {
  exists: Map<bigint, boolean>;
  traits: Map<bigint, Traits>;
}

const proxyHandler: ProxyHandler<_NPC<Traits>> = {
  get(target, prop, receiver) {
    if (typeof prop === "symbol" || prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    return target.traits[prop as string];
  },
  has(target, prop) {
    if (typeof prop === "symbol" || prop in target) return true;
    return prop in target.traits;
  },
};

class _NPC<T extends Traits> {
  readonly id: bigint;
  private settings: Settings<T>;
  private _cache: Cache;

  constructor(settings: Settings<T>, id: bigint, cache?: Cache) {
    this.settings = settings;
    this.id = id;
    this._cache = cache ?? { exists: new Map(), traits: new Map() };
    return new Proxy(this, proxyHandler as ProxyHandler<_NPC<T>>);
  }

  private npc(id: bigint): NPC<T> {
    return new _NPC(this.settings, id, this._cache) as unknown as NPC<T>;
  }

  get generation(): bigint {
    return generation(this.id);
  }

  get isFemale(): boolean {
    return this.id % 2n === 0n;
  }

  get bioMother(): NPC<T> | null {
    const id = structuralMother(this.id);
    return id !== null ? this.npc(id) : null;
  }

  get famFather(): NPC<T> | null {
    const id = structuralFather(this.id);
    return id !== null ? this.npc(id) : null;
  }

  get bioFather(): NPC<T> | null {
    if (this.id <= 1n) return null;
    const id = this.settings.bioFather(this.id) ?? driftedFather(this.id) ?? structuralFather(this.id)!;
    return this.npc(id);
  }

  get children(): [NPC<T>, NPC<T>, NPC<T>, NPC<T>] {
    const ids = structuralChildren(this.id);
    return ids.map((id) => this.npc(id)) as [NPC<T>, NPC<T>, NPC<T>, NPC<T>];
  }

  get livingChildren(): NPC<T>[] {
    return this.children.filter((c) => c.exists);
  }

  private blendTraits(id: bigint, mother: T, father: T): T {
    if (this.settings.blend) {
      return this.settings.blend(id, mother, father);
    }
    const result = {} as Record<string, unknown>;
    const keys = new Set([...Object.keys(mother), ...Object.keys(father)]);
    for (const key of keys) {
      const rule: BlendRule = this.settings.blendRule ? this.settings.blendRule(key as keyof T) : "average";
      const m = mother[key];
      const f = father[key];
      if (m !== undefined && f !== undefined) {
        result[key] = applyBlendRule(rule, m, f, id);
      } else {
        result[key] = m ?? f;
      }
    }
    return result as T;
  }

  get traits(): T {
    const cached = this._cache.traits.get(this.id);
    if (cached) return cached as T;
    let base: T;
    if (this.id === 0n) {
      base = this.settings.adam;
    } else if (this.id === 1n) {
      base = this.settings.eve;
    } else {
      const mother = this.bioMother!;
      const father = this.bioFather!;
      base = this.blendTraits(this.id, mother.traits, father.traits);
    }
    const overrides = this.settings.traits(this.id);
    const result = { ...base, ...overrides } as T;
    this._cache.traits.set(this.id, result);
    return result;
  }

  get lifespan(): Lifespan {
    return this.settings.lifespan(this.id, this.generation);
  }

  get birth(): bigint {
    return this.lifespan.birth;
  }

  get death(): bigint {
    return this.lifespan.death;
  }

  get exists(): boolean {
    const cached = this._cache.exists.get(this.id);
    if (cached !== undefined) return cached;
    let result: boolean;
    if (this.id <= 1n) {
      result = true;
    } else {
      const mother = this.bioMother!;
      const father = this.bioFather!;
      result = mother.exists && father.exists && this.settings.exists(this.id, this as unknown as NPC<T>);
    }
    this._cache.exists.set(this.id, result);
    return result;
  }

  get lineage(): Array<[NPC<T>, NPC<T>]> {
    const result: Array<[NPC<T>, NPC<T>]> = [];
    let current = this as unknown as NPC<T>;
    while (current.id > 1n) {
      result.push([current.bioMother!, current.famFather!]);
      current = current.bioMother!;
    }
    return result;
  }

  static *generation<T extends Traits>(settings: Settings<T>, gen: bigint): Generator<NPC<T>> {
    const cache: Cache = { exists: new Map(), traits: new Map() };
    const start = genStart(gen);
    const size = 1n << (gen + 1n);
    for (let i = 0n; i < size; i++) {
      yield new _NPC(settings, start + i, cache) as unknown as NPC<T>;
    }
  }
}

export type NPC<T extends Traits> = _NPC<T> & Readonly<T>;

export const NPC: {
  new <T extends Traits>(settings: Settings<T>, id: bigint): NPC<T>;
  generation<T extends Traits>(settings: Settings<T>, gen: bigint): Generator<NPC<T>>;
} = _NPC as unknown as typeof NPC;
