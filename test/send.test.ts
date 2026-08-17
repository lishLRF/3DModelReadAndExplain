import { describe, expect, it } from 'vitest'
import { buildPromptBlock } from '../src/client/send'
import { buildDocument } from '../src/schema'

describe('buildPromptBlock', () => {
  const doc = () => buildDocument('stl', [{ triangles: [0, 0, 0, 1, 0, 0, 0, 1, 0] }], {
    name: 'bracket.stl',
    units: 'mm',
  })

  it('includes the human description when present', () => {
    const model = doc()
    model.meta.description = '一个 L 形支架，带两个 M6 通孔。'
    const block = buildPromptBlock(model)
    expect(block).toContain('Human description: 一个 L 形支架，带两个 M6 通孔。')
  })

  it('omits the human description line when absent', () => {
    const block = buildPromptBlock(doc())
    expect(block).not.toContain('Human description:')
  })
})
