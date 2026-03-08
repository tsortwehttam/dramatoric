import { createOnigurumaEngine, loadWasm } from "@shikijs/engine-oniguruma";
// @ts-ignore
import onigWasm from "@shikijs/engine-oniguruma/wasm-inlined";
import { INITIAL, Registry, type IOnigLib, type IRawGrammar, type StateStack } from "@shikijs/vscode-textmate";
import languageConfiguration from "../.vscode/extensions/dramatoric/language-configuration.json";
import extensionPkg from "../.vscode/extensions/dramatoric/package.json";
import grammar from "../.vscode/extensions/dramatoric/syntaxes/dramatoric.tmLanguage.json";

const ext = extensionPkg.contributes;
const lang = ext.languages[0];
const grammarMeta = ext.grammars.find((g) => g.language === lang.id) ?? ext.grammars[0];

export const WELL_LANGUAGE_ID = lang.id;
export const WELL_SCOPE_NAME = grammarMeta.scopeName;

export const WELL_GRAMMAR = grammar;
export const WELL_LANGUAGE_CONFIGURATION = languageConfiguration;

export const WELL_DIRECTIVES = [
  "SCENE",
  "BLOCK",
  "EVENT",
  "SET",
  "INPUT",
  "LLM",
  "GOTO",
  "RUN",
  "EXIT",
  "SAY",
  "LOG",
  "MUSIC",
  "SOUND",
  "EMIT",
  "MODULE",
  "INCLUDE",
  "PARALLEL",
  "CODE",
  "VARY",
  "DATA",
  "SAVE",
  "LOAD",
  "BOOT",
  "ENTITY",
  "REPLY",
  "FETCH",
  "REDO",
  "PUSH",
  "WAIT",
  "IF",
  "ELSE",
  "WHEN",
  "CASE",
  "WHILE",
  "LOOP",
  "EACH",
  "BREAK",
  "DO",
  "END",
];

export const WELL_FUNCTIONS = [
  "stats",
  "rand",
  "randInt",
  "randChoice",
  "randShuffle",
  "min",
  "max",
  "abs",
  "round",
  "floor",
  "ceil",
  "length",
  "contains",
  "startsWith",
  "endsWith",
  "upper",
  "lower",
  "trim",
  "split",
  "join",
];

export const WELL_KEYWORDS = [
  "entities",
  "player",
  "session",
  "event",
  "meta",
  "$scene",
  "$array",
  "$element",
  "$index",
  "$iteration",
  "true",
  "false",
  "null",
  "undefined",
];

export const WELL_PREPROCESS_TOKENS = {
  templateOpen: "{{",
  templateClose: "}}",
  variationOpen: "[[",
  variationClose: "]]",
  frontMatter: "---",
  comment: "//",
};

export class TextMateState {
  constructor(readonly ruleStack: StateStack) {}

  clone() {
    return new TextMateState(this.ruleStack);
  }

  equals(other: TextMateState) {
    return !!other && other.ruleStack === this.ruleStack;
  }
}

export type TextMateTokensProvider = {
  getInitialState: () => TextMateState;
  tokenize: (
    line: string,
    state: TextMateState,
  ) => {
    tokens: { startIndex: number; scopes: string }[];
    endState: TextMateState;
  };
};

type OnigLibInstance = Awaited<ReturnType<typeof createOnigurumaEngine>>;

let onigLibPromise: Promise<OnigLibInstance> | null = null;
let providerPromise: Promise<TextMateTokensProvider> | null = null;

async function ensureOnigLib() {
  if (!onigLibPromise) {
    onigLibPromise = (async () => {
      await loadWasm(onigWasm);
      return await createOnigurumaEngine();
    })();
  }
  return onigLibPromise;
}

export async function getWellTokensProvider() {
  if (!providerPromise) {
    providerPromise = (async () => {
      const onigLib = await ensureOnigLib();
      const adapter: IOnigLib = {
        createOnigScanner(patterns: Parameters<IOnigLib["createOnigScanner"]>[0]) {
          return onigLib.createScanner(patterns);
        },
        createOnigString(str: Parameters<IOnigLib["createOnigString"]>[0]) {
          return onigLib.createString(str);
        },
      };
      const registry = new Registry({
        onigLib: adapter,
        loadGrammar: (scopeName) => {
          if (scopeName === WELL_SCOPE_NAME) {
            return WELL_GRAMMAR as IRawGrammar;
          }
          return null;
        },
      });
      const grammar = registry.loadGrammar(WELL_SCOPE_NAME) ?? registry.addGrammar(WELL_GRAMMAR as IRawGrammar);
      return {
        getInitialState: () => new TextMateState(INITIAL),
        tokenize: (line: string, state: TextMateState) => {
          const result = grammar.tokenizeLine(line, state?.ruleStack ?? INITIAL);
          const tokens = result.tokens.map((token) => ({
            startIndex: token.startIndex,
            scopes: token.scopes[token.scopes.length - 1] ?? WELL_SCOPE_NAME,
          }));
          return {
            tokens,
            endState: new TextMateState(result.ruleStack),
          };
        },
      } satisfies TextMateTokensProvider;
    })();
  }
  return providerPromise;
}
