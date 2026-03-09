# Developing & Contributing

## Project Structure

```
dev/   - Developer scripts and tools
docs/  - API docs for the Language
eng/   - Main engine code
fic/   - Example stories
lib/   - Generic/shared utilities
play/  - Vite + React web harness
test/  - Unit and integration tests
web/   - Web player adapters (WebSocket server, client)
```

## Setup

```bash
yarn install
```

Copy `.env.example` to `.env` and fill in your API keys.

## Scripts

| Command     | Description                                  |
| ----------- | -------------------------------------------- |
| `yarn test` | Run all unit/integration tests               |
| `yarn tc`   | TypeScript type-check (`tsc --noEmit`)       |
| `yarn ver`  | Full verification: typecheck + docs + tests  |
| `yarn docs` | Regenerate README and API reference docs     |
| `yarn play` | Start the web player (WSS + Vite dev server) |
| `yarn wss`  | Start the WebSocket server only              |
| `yarn repl` | Start the CLI REPL player                    |

## Web Player

The web player is a React app served by Vite that connects to a WebSocket server.

```bash
# Play a specific story
yarn play --cartridge fic/example/main.dram

# Resume a saved session
yarn play --cartridge fic/example/main.dram --session path/to/session.json
```

This starts both the WSS (port 8787) and Vite dev server (port 5199). Open `http://localhost:5199` in your browser.

## CLI REPL

```bash
yarn repl
```

Connects to the WSS and lets you play a story interactively in the terminal.

## Tests

Tests use a lightweight custom runner (no Jest/Vitest). Test files live in `test/` and are named `NNN-description.test.ts`, sorted numerically before execution.

```bash
yarn test
```

Write tests for all functional units that don't require I/O or significant setup/teardown.

## Generating Docs

The README is generated from `fic/readme/main.dram` — do not edit `README.md` directly. API reference docs are also generated:

```bash
yarn docs
```

## VSCode Extension

A syntax highlighting extension for `.dram` files lives at `.vscode/extensions/dramatoric`. Install it locally:

```bash
ln -s "$(pwd)/.vscode/extensions/dramatoric" ~/.vscode/extensions/dramatoric
```

Then reload VSCode.

## Coding Conventions

- **TypeScript only**, strict mode, no `any`
- **yarn** (not npm)
- No classes, no default exports, no `try/catch`, no `optional?:` types
- Prefer pure functions, early return, short variable names
- Functions: camelCase verbs (`calcFoo`). Constants: `UPPER_CASE`. Zod schemas: `PascalCase`
- Shared code files: `FooUtils.ts` (I/O), `BarHelpers.ts` (pure logic)
- No comments unless explaining _why_; code should be self-descriptive
- DRY but YAGNI — extract only when reused, consolidate shared contracts
- Run `yarn tc` and `yarn test` after logical changes or refactors

See `CLAUDE.md` for the full style guide.
