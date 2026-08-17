# The standardized 3D model document (`dsh-3d-model/v1`)

Every supported source format — OBJ, STL, STEP — is translated into **one** JSON
shape. The goal is a description that a *language model* (or any downstream
consumer) can read directly, without a CAD kernel, a viewer, or knowledge of the
source file's private syntax.

Three design rules:

1. **Semantic keys.** The JSON says *what a value is* (`bounds.center`,
   `summary.triangleCount`), not how some file happened to store it.
2. **Compact geometry.** Geometry is flat number arrays, never per-vertex
   objects. A 1M-triangle part is one `vertices` array and one `indices` array.
3. **Indexed.** Triangles share vertices through an index buffer, so shared
   topology is expressed once and the document stays small.

## Top-level shape

```jsonc
{
  "schema": "dsh-3d-model/v1",
  "meta": {
    "sourceFormat": "obj | stl | step | unknown",
    "name": "optional display name",
    "units": "mm | m | unknown | …",
    "generator": "dsh-3d-model-viewer",
    "generatedAt": "2026-01-01T00:00:00.000Z"
  },
  "bounds": {
    "min": [x, y, z],
    "max": [x, y, z],
    "size": [dx, dy, dz],
    "center": [x, y, z],
    "radius": 123.4
  },
  "summary": {
    "partCount": 2,
    "vertexCount": 12345,
    "triangleCount": 6789,
    "materialCount": 3
  },
  "materials": [
    { "id": "mat-0", "name": "Steel", "color": "#8a8a8a", "metalness": 0.9, "roughness": 0.3 }
  ],
  "parts": [
    {
      "id": "part-0",
      "name": "Body",
      "material": "mat-0",
      "vertices": [x0, y0, z0, x1, y1, z1, /* … */],
      "normals": [nx0, ny0, nz0, /* … */],
      "indices": [0, 1, 2, /* … */]
    }
  ],
  "analysis": {
    "partCount": 2,
    "totalSurfaceArea": 12345.67,
    "totalVolume": 8000.0,
    "watertight": true,
    "parts": [
      {
        "surfaceArea": 9000.0,
        "volume": 8000.0,
        "watertight": true,
        "boundaryEdgeCount": 0,
        "dimensions": [40, 20, 10],
        "primitive": "box",
        "primitiveConfidence": 0.99
      }
    ],
    "naturalDescription": "bracket.step: 2 parts (1/2 parts classified), bounding box 40×20×10 mm, surface area 12345.67 mm², closed solid, volume 8000 mm³"
  }
}
```

## Field reference

### `meta`

| Field          | Type    | Meaning                                                                 |
| -------------- | ------- | ----------------------------------------------------------------------- |
| `sourceFormat` | string  | The originating format (`obj`, `stl`, `step`, `unknown`).               |
| `name`         | string? | Display name (usually the file name).                                   |
| `units`        | string  | Best-effort unit name. STEP often carries a real unit; OBJ/STL do not, so they default to `unknown`. |
| `generator`    | string  | Tool/version that produced the document.                                |
| `generatedAt`  | string  | ISO-8601 timestamp of translation.                                      |

### `bounds`

Axis-aligned bounding box and bounding sphere over **all** parts:

| Field    | Type       | Meaning                                        |
| -------- | ---------- | ---------------------------------------------- |
| `min`    | `[f,f,f]`  | Minimum corner.                                |
| `max`    | `[f,f,f]`  | Maximum corner.                                |
| `size`   | `[f,f,f]`  | `max − min`.                                   |
| `center` | `[f,f,f]`  | Midpoint of `min`/`max`.                       |
| `radius` | number     | Radius of a sphere centered at `center` enclosing the whole model. |

### `summary`

Fast, model-visible size facts (no need to walk the arrays):

| Field           | Type   | Meaning                                   |
| --------------- | ------ | ----------------------------------------- |
| `partCount`     | number | Number of `parts`.                        |
| `vertexCount`   | number | Total unique vertices across parts.       |
| `triangleCount` | number | Total triangles across parts.             |
| `materialCount` | number | Number of entries in `materials`.         |

### `materials[]`

| Field       | Type    | Meaning                                          |
| ----------- | ------- | ------------------------------------------------ |
| `id`        | string  | Referenced by `parts[].material`.                |
| `name`      | string? | Human-readable material name (from OBJ `mtllib`/`usemtl`, or STEP). |
| `color`     | string  | `#rrggbb` base color.                            |
| `metalness` | number? | 0–1 PBR metalness hint.                          |
| `roughness` | number? | 0–1 PBR roughness hint.                          |
| `opacity`   | number? | 0–1 opacity.                                     |

### `parts[]`

One part = one tessellated solid/surface group.

| Field       | Type      | Meaning                                                      |
| ----------- | --------- | ------------------------------------------------------------ |
| `id`        | string    | Stable id (`part-0`, `part-1`, …).                           |
| `name`      | string?   | Object/group name (OBJ `o`/`g`) or STEP solid name.          |
| `material`  | string?   | Index into `materials`.                                      |
| `vertices`  | number[]  | Flat `[x,y,z, …]`; length is `3 × vertexCount`.              |
| `normals`   | number[]? | Flat per-vertex normals; same length as `vertices`.          |
| `indices`   | number[]  | Triangle indices; length is `3 × triangleCount`, three per triangle. |

### `analysis` — the "LLM can *understand* it" layer

Raw triangles are readable but not *comprehensible*; `analysis` distills them into
features a language model reasons about directly.

| Field               | Type     | Meaning                                                             |
| ------------------- | -------- | ------------------------------------------------------------------- |
| `partCount`         | number   | Number of parts (== `summary.partCount`).                           |
| `totalSurfaceArea`  | number   | Total surface area (sum of triangle areas).                         |
| `totalVolume`       | number   | Signed volume; only meaningful when `watertight` is true.           |
| `watertight`        | boolean  | Whole model is a closed solid (no boundary edges).                  |
| `parts[]`           | object[] | Per-part analysis (below).                                          |
| `naturalDescription`| string   | One sentence summarizing the model for an LLM.                      |

Each `analysis.parts[i]`:

| Field                 | Type    | Meaning                                                        |
| --------------------- | ------- | -------------------------------------------------------------- |
| `surfaceArea`         | number  | Part surface area.                                             |
| `volume`              | number  | Signed volume (meaningful when `watertight`).                  |
| `watertight`          | boolean | Part is closed (no boundary edges).                            |
| `boundaryEdgeCount`   | number  | Edges shared by only one triangle (0 ⇒ watertight).            |
| `dimensions`          | `[f,f,f]` | Part bounding-box size.                                     |
| `primitive`           | string  | `box` \| `cylinder` \| `sphere` \| `planar` \| `freeform` (heuristic). |
| `primitiveConfidence` | number  | 0–1 rough confidence in the primitive label.                   |

The primitive label is a **best-effort shape hint**, derived from the
`|volume| / bounding-box-volume` ratio (box ≈ 1.0, cylinder ≈ π/4 ≈ 0.785,
sphere ≈ π/6 ≈ 0.524); treat it as a hint, not a CAD truth.

## Coordinate convention

- Right-handed, same as three.js/OpenGL: **+X right, +Y up, +Z toward the
  viewer**.
- The document stores the model in its **source coordinates** (no implicit
  re-centering, no unit scaling). `bounds` tells you where it sits.
- Floats are quantized (rounded) to 4 decimals by default to keep the JSON
  small; the tool and viewer accept a different precision.

## Token-size guidance

The document is intentionally dense. Approximate cost for a model with
`V` vertices and `T` triangles (4-decimal floats, ~10 chars per number):

- `vertices`: `3V` numbers
- `normals`: `3V` numbers (when present)
- `indices`: `3T` integers

A 10k-triangle part lands in the low hundreds of kilobytes of JSON — readable,
but you should prefer the `summary`/`bounds` for high-level reasoning and only
spill into `parts` when you need per-face geometry. The viewer's "Send to AI"
button truncates extremely large payloads and still includes the summary.

## JSON Schema

A machine-readable schema (draft 2020-12) is maintained alongside this page;
see [`docs/dsh-3d-model.schema.json`](./dsh-3d-model.schema.json).

## Versioning

The `schema` field is the contract. `v1` is stable; any breaking change bumps
the major version and ships a migration note. Additive fields (new optional
keys) are non-breaking.
