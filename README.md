# Dramatoric

Games where you talk and the characters talk back. Dramatoric is an engine
and anthology of "First-Person Talker" games — talking simulators in the
lineage of *Façade* and parser interactive fiction, where you stand in a
room, type what you say, and characters hear, react, and improvise from the
same shared world state. Dialogue is not the story delivery; it is the game.

Play at [dramatoric.com](https://dramatoric.com). This repository is the
public side of the project; pieces of the engine land here as they open up.

## What is here

- [`format/`](format/) — the `.drama` story format: the normative language
  specification, the generated vocabulary registry, worked example plays,
  and a one-file bundle that lets an LLM author a playable game.

## Write a game with an LLM, right now

Hand your model the raw bundle as context and ask it for a game:

    https://raw.githubusercontent.com/tsortwehttam/dramatoric/main/format/agent-bundle.md

Paste the resulting `.drama` play into the editor at
[dramatoric.com/stories/new](https://dramatoric.com/stories/new) — the
in-browser compiler's errors are the lint loop — then publish and share it.

## Generated, not edited

Everything here is assembled from the private Dramatoric monorepo by a
script and re-synced on releases. Please report problems as issues rather
than pull requests against file content.

## License

Apache-2.0, copyright 2026 Aisatsu LLC — see [`LICENSE`](LICENSE) and
[`NOTICE`](NOTICE). You may implement the `.drama` specification;
independent compilers, editors, linters, and runtimes are welcome and
require no permission.
