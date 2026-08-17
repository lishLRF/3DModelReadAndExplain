import { describe, expect, it } from 'vitest'
import {
  StepRequiresBrowserError,
  detectFormat,
  translateFromBytes,
  translateObj,
  translateStl,
} from '../src/parse/index'

describe('detectFormat', () => {
  it('maps known extensions case-insensitively', () => {
    expect(detectFormat('part.obj')).toBe('obj')
    expect(detectFormat('PART.STL')).toBe('stl')
    expect(detectFormat('a.stp')).toBe('step')
    expect(detectFormat('a.step')).toBe('step')
  })

  it('returns unknown for unrecognized or missing extensions', () => {
    expect(detectFormat('part.xyz')).toBe('unknown')
    expect(detectFormat('noext')).toBe('unknown')
    expect(detectFormat(undefined)).toBe('unknown')
  })
})

describe('translateObj / translateStl', () => {
  it('produces an obj document from text', () => {
    const doc = translateObj(['v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'f 1 2 3'].join('\n'), {
      name: 't.obj',
    })
    expect(doc.meta.sourceFormat).toBe('obj')
    expect(doc.summary.triangleCount).toBe(1)
  })

  it('produces an stl document from bytes', () => {
    const tri = new Uint8Array(84 + 50)
    const view = new DataView(tri.buffer)
    view.setUint32(80, 1, true)
    for (let i = 0; i < 9; i++) view.setFloat32(84 + 12 + i * 4, i, true)
    const doc = translateStl(tri, { name: 't.stl' })
    expect(doc.meta.sourceFormat).toBe('stl')
    expect(doc.summary.triangleCount).toBe(1)
  })
})

describe('translateFromBytes', () => {
  it('dispatches by filename extension', () => {
    const obj = new TextEncoder().encode('v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n')
    const doc = translateFromBytes(obj, 'model.obj')
    expect(doc.meta.sourceFormat).toBe('obj')
    expect(doc.summary.triangleCount).toBe(1)
  })

  it('throws StepRequiresBrowserError for STEP on the Host path', () => {
    expect(() => translateFromBytes(new TextEncoder().encode('ISO-10303-21;'), 'part.stp'))
      .toThrow(StepRequiresBrowserError)
  })

  it('throws for unsupported formats', () => {
    expect(() => translateFromBytes(new Uint8Array([1]), 'part.xyz')).toThrow(/unsupported/)
  })
})
