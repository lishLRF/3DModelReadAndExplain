/**
 * STL parser (ASCII and binary). Pure, isomorphic — runs on Host (Node) and in
 * the browser. STL carries only a triangle soup plus a per-face normal; the
 * parser emits non-indexed triangles and lets the document builder deduplicate
 * them into shared vertices.
 */

import type { RawMesh } from '../schema'

export function looksBinary(data: Uint8Array): boolean {
  // Binary STL length is exactly 84 + 50 * triangleCount.
  if (data.length < 84) return false
  const triangleCount = new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(80, true)
  return data.length === 84 + triangleCount * 50
}

function parseAsciiStl(text: string): RawMesh {
  const triangles: number[] = []
  const vertexRe = /vertex\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)\s+([-+0-9.eE]+)/g

  // Split into facet blocks; each block carries exactly three `vertex` lines.
  const blocks = text.split(/facet\s+normal/i).slice(1)
  for (const block of blocks) {
    const found = [...block.matchAll(vertexRe)]
    if (found.length !== 3) continue
    for (const match of found) {
      triangles.push(Number(match[1]), Number(match[2]), Number(match[3]))
    }
  }
  return { triangles }
}

function parseBinaryStl(data: Uint8Array): RawMesh {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const triangleCount = view.getUint32(80, true)
  const triangles = new Float64Array(triangleCount * 9)
  let offset = 84
  for (let t = 0; t < triangleCount; t++) {
    // 12 floats: normal (3) + 3 vertices (9); then a 2-byte attribute.
    offset += 12 // skip the normal
    for (let v = 0; v < 9; v++) {
      triangles[t * 9 + v] = view.getFloat32(offset, true)
      offset += 4
    }
    offset += 2 // attribute byte count
  }
  return { triangles }
}

/** Parse an STL file from its bytes (auto-detects ASCII vs binary). */
export function parseStl(data: Uint8Array): RawMesh {
  if (looksBinary(data)) return parseBinaryStl(data)
  const text = new TextDecoder().decode(data)
  return parseAsciiStl(text)
}

/** Parse an STL file already available as text (ASCII). */
export function parseStlText(text: string): RawMesh {
  return parseAsciiStl(text)
}
