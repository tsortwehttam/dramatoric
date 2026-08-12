# The `.drama` Story Format

`.drama` is a plain-text playscript language for interactive dramas: one
production rule (`Subject verb args...`), and a whole game in a directory of
text files — cast, stage, dialogue, camera, logic, and story structure. A
compiler turns the plays into a deterministic cartridge; LLM-backed
characters improvise inside the authored structure.

The format comes from [Dramatoric](https://dramatoric.com), an engine and
anthology of "First-Person Talker" games — talking simulators in the lineage
of *Façade* and parser interactive fiction, where you stand in a room, type
what you say, and characters hear, react, and improvise from the same shared
world state. Dialogue is not the story delivery; it is the game —
persuasion, manipulation, hiding and revealing information, befriending,
betraying. `.drama` is how those games are written, by hand or by an LLM.

## Layout

- `spec/drama-v2-spec.md` — the normative language specification.
- `spec/registry.md` — the normative vocabulary (functions, verbs, gestures,
  geometry), generated from the engine's own tables.
- `examples/playscript.drama` — a minimal two-hander showing the production
  rule.
- `examples/receptionist.drama` — a small complete game: one NPC, one goal.
- `examples/golden.drama` — the primary worked cartridge; exercises most of
  the language.
- `agent-bundle.md` — the spec, registry, and starter plays as one file.

## Writing games with an LLM

Hand `agent-bundle.md` to a capable model as context and ask it for a game.
It contains everything needed to author a valid play: the grammar, the
complete vocabulary, and two worked examples. Paste the result into the
editor at [dramatoric.com](https://dramatoric.com); its recompile errors are
the lint loop.

## Generated, not edited

This repository is assembled from the Dramatoric monorepo by a script; the
monorepo is the single source of truth. The registry is regenerated from the
engine's own tables on every release, and a stale registry fails the
monorepo's build, so the vocabulary here cannot drift from the runtime.
Please do not send pull requests against file content; report problems as
issues instead.

## License

Apache-2.0, copyright 2026 Aisatsu LLC — see `LICENSE` and `NOTICE`. You may
implement this specification. Independent implementations of `.drama` —
compilers, editors, linters, runtimes — are welcome and require no
permission.
