# dsh-3d-model-viewer

> A [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) plugin
> that reads **3D models in the web UI** and translates them into a **standardized,
> LLM-readable JSON** — so a pure language model can understand a part without a CAD
> kernel.

`#dsh-plugin`

![license: MIT](https://img.shields.io/badge/license-MIT-blue)
![format: OBJ](https://img.shields.io/badge/format-OBJ%20%7C%20STL%20%7C%20STEP-9cf)

---

## What it does

| # | Feature |
| - | ------- |
| 1 | **View OBJ / STL / STEP in the DSH web UI**, in a floating panel docked to the right, styled with the DSH theme tokens. |
| 2 | **Interact**: rotate / pan / zoom, plus material (color, metalness, roughness, wireframe), lighting (ambient + key), and **section (clipping-plane) view**. |
| 3 | **Translate** any supported model into one standardized JSON format (`dsh-3d-model/v1`) that a language model can read directly. |
| 4 | **Send to AI**: one click injects the JSON + a prompt into the DSH composer, so it uploads together with your own message — or sends it immediately as a queued turn. |

## How it works

One package, two halves (the standard DSH plugin shape):

- **Host half** (`src/index.ts`) — registers the `read_3d_model` tool so the agent
  itself can translate an OBJ/STL file on disk into the standardized JSON. It also
  exports the translator library (`translateFromBytes`, `translateObj`, `translateStl`,
  and the schema) for reuse.
- **Client half** (`src/client/*`) — a browser bundle built to the DSH client-module
  contract. It registers a `shell.overlay` panel (an additive, frame-wide surface that
  never replaces shipped UI), renders with [three.js](https://threejs.org), and reaches
  the conversation through the sessions scope to append/send the model block.

```
        ┌─────────────────────────── DSH web UI ───────────────────────────┐
  drop / pick ──▶  load.ts  ──▶  parser (obj|stl|step)  ──▶  ModelDocument
                                                                    │
                              ┌─────────────────────────────────────┤
                              ▼                                     ▼
                    three.js viewer (scene.ts)          buildPromptBlock (send.ts)
                    orbit / material / light / section   └──▶ conversation.input.setDraft
```

## Install & deploy

This plugin is a DSH **bundle**: its `package.json` declares `dsh.bundle`
(pointing at `cordis.patch.yml`) and `dsh.client` (the browser bundle). You add it to a
**profile**; `dsh plugin` composes it as a layer over `@deepseek-ai/dsh-base`.

> The DSH web UI runs as the `web` profile (`dsh web` ≡ `dsh --profile web`, composed of
> `@deepseek-ai/dsh-base` + `@deepseek-ai/dsh-web-app`). If you boot a different profile,
> replace `web` below with its name.

### Option A — from GitHub (recommended)

```sh
dsh plugin --profile web add github:lishLRF/3DModelReadAndExplain
```

pnpm ≥ 10 refuses to run a git dependency's `prepare` build script until you allow it.
The first `add` fails and prints the exact package key to copy into the profile's
`pnpm-workspace.yaml`. Copy it, then re-run the `add`:

```yaml
allowBuilds:
  dsh-3d-model-viewer: true
```

Pin a commit for supply-chain safety (that `prepare` script runs on your machine):

```sh
dsh plugin --profile web add github:lishLRF/3DModelReadAndExplain#<sha>
```

### Option B — from a local checkout or tarball

```sh
# local checkout (links the folder; `prepare` still builds lib/)
dsh plugin --profile web add ./3DModelReadAndExplain

# or a prebuilt tarball (no build script needed)
pnpm pack
dsh plugin --profile web add ./dsh-3d-model-viewer-0.1.0.tgz
```

### Boot & verify

```sh
dsh web        # or: dsh --profile web
```

Then confirm it is live:

1. The **3D Model Viewer** panel appears at the top-right of the web UI.
2. Ask the agent to call `read_3d_model` with a `.obj`/`.stl` path — it should return
   the standardized JSON (this confirms the host tool registered).
3. Without booting, you can check the composed layer:
   ```sh
   dsh --profile web --dump-config
   ```
   and look for the `# == dsh-3d-model-viewer` section.

### Requirements

- Node ≥ 20, pnpm ≥ 10.
- A **web** surface (the `web` profile) for the panel. A headless/TUI profile still gets
  the `read_3d_model` tool, just not the viewer.

## Usage

1. Open a session (conversation).
2. In the **3D Model Viewer** panel, click **Load model** (or drop a file) —
   `.obj`, `.stl`, `.step`, `.stp`.
3. Use the controls to rotate/pan/zoom, adjust material and lighting, and toggle a
   section plane.
4. Click **Send to AI** to append the standardized JSON + prompt to the composer, or
   **Send now** to submit it immediately. **Download JSON** / **Copy JSON** export the
   document.

## STEP (.stp/.step) support

STEP is a BREP solid format; tessellating it needs a CAD kernel. This plugin uses
[`occt-import-js`](https://github.com/kovacsv/occt-import-js) — a WebAssembly port of
OpenCascade — **in the browser only**. The Host `read_3d_model` tool therefore reports
STEP as "open it in the web viewer".

- The `.wasm` binary cannot be co-located with the bundled `client.js`, so the plugin
  loads it from a pinned CDN by default. For air-gapped deployments, edit
  `STEP_WASM_URL` in `src/client/load.ts` (or serve the `.wasm` beside the bundle) and
  rebuild.
- **License note**: this project is MIT, but `occt-import-js` wraps OpenCascade
  Technology (LGPL-2.1 + exception). The OCCT WASM is a separate, dynamically-loaded
  binary; see `LICENSE` and the occt-import-js repository for exact terms.

## The standardized JSON

See [`docs/SCHEMA.md`](./docs/SCHEMA.md) (English) / [`docs/SCHEMA.zh.md`](./docs/SCHEMA.zh.md)
(中文) and the machine-readable [`docs/dsh-3d-model.schema.json`](./docs/dsh-3d-model.schema.json).

```json
{
  "schema": "dsh-3d-model/v1",
  "meta": { "sourceFormat": "stl", "name": "bracket.stl", "units": "unknown" },
  "bounds": { "min": [0,0,0], "max": [40,20,10], "size": [40,20,10], "center": [20,10,5], "radius": 22.9 },
  "summary": { "partCount": 1, "vertexCount": 512, "triangleCount": 1024, "materialCount": 0 },
  "parts": [ { "id": "part-0", "vertices": [ … ], "indices": [ … ] } ]
}
```

## Develop

```sh
pnpm install
pnpm build        # emits lib/index.js (host) and lib/client.js (browser bundle)
pnpm typecheck    # tsc --noEmit
pnpm watch        # tsdown --watch (for iterating on the browser bundle)
```

The build is self-contained (`tsdown.config.ts`): the client bundle resolves DSH
platform modules (`react`, `react/jsx-runtime`, …) as externals from the shell's frozen
module table and inlines everything else (`three`, `occt-import-js`). The host half is a
plain ESM plugin with no runtime dependency on the DSH monorepo.

### Project layout

```
src/
├── index.ts            host plugin: read_3d_model tool + library re-exports
├── schema.ts           the standardized document: types + builder + quantization
├── parse/
│   ├── obj.ts          Wavefront OBJ parser (text, fan-triangulated)
│   ├── stl.ts          STL parser (ASCII + binary)
│   ├── step.ts         occt-import-js adapter (import-free)
│   └── index.ts        format detection + Host dispatch
└── client/
    ├── index.ts        client plugin apply (shell.overlay registration + send face)
    ├── panel.tsx       floating viewer panel
    ├── scene.ts        three.js scene controller (orbit/material/light/section)
    ├── geometry.ts     document → BufferGeometry
    ├── load.ts         browser File → document (STEP via WASM)
    ├── send.ts         prompt-block builder
    ├── dsh.ts          minimal client-service type shims
    └── styles.module.css
```

## License

MIT — see [`LICENSE`](./LICENSE). Third-party notices are included there.

## Known limitations & roadmap

- **STEP runs in the browser only** (WASM); the Host `read_3d_model` tool covers OBJ/STL.
- **Material files** (`mtllib`) are parsed for names/colors best-effort; full MTL
  texture/BRDF loading is out of scope for v1.
- **Units** default to `unknown` for OBJ/STL (the formats carry no unit); STEP units
  are read when present.
- **No re-centering** — models keep their source coordinates (see `bounds`).
- Planned: read models from the DSH workspace (not just a local file picker), MTL
  texture support, and an STL/OBJ→STEP-upstream export.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md). Issues and PRs welcome — please open a
discussion before large changes.
