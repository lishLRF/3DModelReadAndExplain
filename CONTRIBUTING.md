# Contributing

Thanks for helping improve `dsh-3d-model-viewer`. This plugin follows the DSH
plugin conventions; a little upfront reading saves review cycles.

## Ground rules

- **One package, two halves.** The Host half (`src/index.ts`) registers a tool and
  exports the translator library; the Client half (`src/client/*`) is the browser
  bundle. Keep host-only and browser-only code out of each other's import graph.
- **The standardized JSON is the contract.** Any change to
  `docs/dsh-3d-model.schema.json` or `src/schema.ts` is a schema decision — discuss it
  in an issue first and keep it backward-compatible unless you bump `schema`'s major
  version.
- **No cross-plugin value imports in the client.** The browser bundle may import
  `react`/`react/jsx-runtime` and the parser libraries, and inline `three` /
  `occt-import-js`; reach DSH services through the context (`ctx.sessions`, `ctx.slots`),
  never by importing another `@deepseek-ai/*` package's values.

## Setup

```sh
pnpm install
pnpm build
pnpm typecheck
```

## Conventions

- TypeScript, strict mode, ESM. Client UI is `.tsx` (JSX is compiled by the bundler);
  the *dynamic* Cordis plugin rules ("use `React.createElement`") do **not** apply here.
- CSS Modules (`.module.css`) with the DSH theme alias tokens
  (`--dsw-alias-*`) for colors — never hard-coded product selectors or `document.body`
  writes.
- Every parser must be pure and isomorphic (OBJ/STL run on both Host and browser);
  STEP is the one browser-only path.

## Before submitting

1. `pnpm typecheck` passes.
2. `pnpm build` emits both `lib/index.js` and `lib/client.js`.
3. If you changed parsing, add a fixture under `examples/` and a unit test.
4. Update `README.md` / `README.zh.md` and the schema docs when behavior changes.

## Commit messages

Keep them short and imperative ("Add section view", "Fix STL binary detection").
Reference issues with `#123` where relevant.

## License

By contributing you agree your work is licensed under the project's MIT license
(see `LICENSE`). Note the STEP backend wraps OpenCascade (LGPL-2.1) — that binary is
loaded dynamically and is not part of this repository.
