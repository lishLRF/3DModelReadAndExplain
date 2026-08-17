import { describe, expect, it } from 'vitest'
import { parseObj } from '../src/parse/obj'

describe('parseObj', () => {
  it('parses a single triangle with per-face normals', () => {
    const obj = [
      'v 0 0 0',
      'v 1 0 0',
      'v 0 1 0',
      'vn 0 0 1',
      'f 1//1 2//1 3//1',
    ].join('\n')
    const meshes = parseObj(obj)
    expect(meshes).toHaveLength(1)
    expect(meshes[0].vertices).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0])
    expect(meshes[0].normals).toEqual([0, 0, 1, 0, 0, 1, 0, 0, 1])
    expect(meshes[0].indices).toEqual([0, 1, 2])
  })

  it('fan-triangulates a quad into two triangles', () => {
    const obj = [
      'v 0 0 0',
      'v 1 0 0',
      'v 1 1 0',
      'v 0 1 0',
      'f 1 2 3 4',
    ].join('\n')
    const meshes = parseObj(obj)
    expect(meshes[0].indices).toEqual([0, 1, 2, 0, 2, 3])
    expect(meshes[0].normals).toBeNull()
  })

  it('resolves negative (relative) indices', () => {
    const obj = [
      'v 0 0 0',
      'v 1 0 0',
      'v 0 1 0',
      'f -3 -2 -1',
    ].join('\n')
    const meshes = parseObj(obj)
    expect(meshes[0].indices).toEqual([0, 1, 2])
  })

  it('supports v/vt/vn and v//vn and bare v face forms', () => {
    const obj = [
      'v 0 0 0', 'v 1 0 0', 'v 0 1 0', 'v 1 1 0',
      'vt 0 0', 'vt 1 0', 'vt 0 1', 'vt 1 1',
      'vn 0 0 1',
      'f 1/1/1 2/2/1 3/3/1',
      'f 1//1 3//1 4//1',
      'f 2 3 4',
    ].join('\n')
    const meshes = parseObj(obj)
    // All three faces land in one mesh (no o/g/usemtl boundaries).
    expect(meshes).toHaveLength(1)
    expect(meshes[0].indices).toHaveLength(9)
    // The last bare-v face has no normals; the mesh must not advertise aligned normals.
    expect(meshes[0].normals).toBeNull()
  })

  it('splits faces into separate meshes across o/g groups', () => {
    const obj = [
      'v 0 0 0', 'v 1 0 0', 'v 0 1 0',
      'v 0 0 1', 'v 1 0 1', 'v 0 1 1',
      'o first',
      'f 1 2 3',
      'o second',
      'f 4 5 6',
    ].join('\n')
    const meshes = parseObj(obj)
    expect(meshes).toHaveLength(2)
    expect(meshes[0].name).toBe('first')
    expect(meshes[1].name).toBe('second')
  })

  it('ignores comments and blank lines', () => {
    const obj = [
      '# a comment',
      '',
      'v 0 0 0',
      '# another',
      'v 1 0 0',
      'v 0 1 0',
      'f 1 2 3',
    ].join('\n')
    const meshes = parseObj(obj)
    expect(meshes[0].indices).toEqual([0, 1, 2])
  })
})
