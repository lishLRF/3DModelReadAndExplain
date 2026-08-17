import { describe, expect, it } from 'vitest'
import { looksBinary, parseStl, parseStlText } from '../src/parse/stl'

function binaryStl(triangles: number[][]): Uint8Array {
  const bytes = new Uint8Array(84 + triangles.length * 50)
  const view = new DataView(bytes.buffer)
  for (let t = 0; t < triangles.length; t++) {
    const base = 84 + t * 50
    const tri = triangles[t]
    // normal (3 floats), 3 vertices (9 floats), then a 2-byte attribute
    view.setFloat32(base, 0, true)
    view.setFloat32(base + 4, 0, true)
    view.setFloat32(base + 8, 1, true)
    for (let v = 0; v < 9; v++) view.setFloat32(base + 12 + v * 4, tri[v], true)
  }
  view.setUint32(80, triangles.length, true)
  return bytes
}

describe('parseStl (binary)', () => {
  it('parses a single triangle', () => {
    const mesh = parseStl(binaryStl([[0, 0, 0, 1, 0, 0, 0, 1, 0]]))
    expect(mesh.triangles).toBeDefined()
    const tri = Array.from(mesh.triangles as ArrayLike<number>)
    expect(tri).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
  })

  it('detects binary STL by exact length', () => {
    expect(looksBinary(binaryStl([[0, 0, 0, 1, 0, 0, 0, 1, 0]]))).toBe(true)
    expect(looksBinary(new Uint8Array([0, 1, 2, 3]))).toBe(false)
  })
})

describe('parseStl (ascii)', () => {
  const ascii = [
    'solid tri',
    '  facet normal 0 0 1',
    '    outer loop',
    '      vertex 0 0 0',
    '      vertex 1 0 0',
    '      vertex 0 1 0',
    '    endloop',
    '  endfacet',
    'endsolid tri',
  ].join('\n')

  it('parses the three vertex positions', () => {
    const mesh = parseStlText(ascii)
    const tri = Array.from(mesh.triangles as ArrayLike<number>)
    expect(tri).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
  })

  it('parses ASCII STL from bytes (auto-detection)', () => {
    const mesh = parseStl(new TextEncoder().encode(ascii))
    expect(mesh.triangles).toBeDefined()
  })

  it('handles multiple facets and skips malformed blocks', () => {
    const multi = [
      'solid two',
      'facet normal 0 0 1',
      'outer loop',
      'vertex 0 0 0', 'vertex 1 0 0', 'vertex 0 1 0',
      'endloop',
      'endfacet',
      'facet normal 0 0 1',
      'outer loop',
      'vertex 0 0 0', 'vertex 0 1 0', 'vertex 1 1 0',
      'endloop',
      'endfacet',
      'endsolid two',
    ].join('\n')
    const mesh = parseStlText(multi)
    expect(Array.from(mesh.triangles as ArrayLike<number>)).toHaveLength(18)
  })
})
