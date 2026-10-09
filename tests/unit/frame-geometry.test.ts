import { describe, expect, it } from 'vitest'
import { frameLayout, frameSvgString, lensOutline, pathFromPoints, type FrameSpec, type Pt, type Shape } from '@/lib/frame-geometry'

/** Decode our compact "M x y l dx dy …" paths back to absolute points. */
function decode(d: string): Pt[] {
  const nums = d.replace(/^M/, '').replace(/[lz]/g, ' ').match(/-?\d*\.?\d+/g)!.map(Number)
  const out: Pt[] = [[nums[0]!, nums[1]!]]
  for (let i = 2; i < nums.length; i += 2) {
    const [x, y] = out.at(-1)!
    out.push([Math.round((x + nums[i]!) * 10) / 10, Math.round((y + nums[i + 1]!) * 10) / 10])
  }
  return out
}

const SHAPES: Shape[] = ['rectangular', 'square', 'round', 'oval', 'cat-eye', 'pilot', 'browline', 'geometric']

describe('lens outline', () => {
  it.each(SHAPES)('%s spans the catalogue A × B measurements', (shape) => {
    const pts = lensOutline({ shape, lensWidth: 52, lensHeight: 40, geometry: { rim: 4, bridgeStyle: 'keyhole' } })
    const xs = pts.map((p) => p[0])
    const ys = pts.map((p) => p[1])
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(52, 0)
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(40.5)
    expect(Math.max(...ys) - Math.min(...ys)).toBeGreaterThan(34)
  })
})

describe('compact SVG paths', () => {
  it('round-trips within 0.05 mm with no drift', () => {
    const pts = lensOutline({ shape: 'cat-eye', lensWidth: 53, lensHeight: 40, geometry: { rim: 4, bridgeStyle: 'keyhole', lift: 0.6 } })
    const back = decode(pathFromPoints(pts))
    expect(back).toHaveLength(pts.length)
    const err = Math.max(...pts.map((p, i) => Math.max(Math.abs(p[0] - back[i]![0]), Math.abs(p[1] - back[i]![1]))))
    expect(err).toBeLessThanOrEqual(0.05 + 1e-9)
  })
  it('handles degenerate input', () => {
    expect(pathFromPoints([])).toBe('')
    expect(pathFromPoints([[1, 2], [1, 2]])).toBe('M1 2z')
  })
})

describe('frame layout', () => {
  const spec: FrameSpec = { shape: 'rectangular', lensWidth: 52, lensHeight: 38, bridgeWidth: 18, rim: 'full', material: 'acetat', geometry: { rim: 4.8, bridgeStyle: 'keyhole' } }
  it('places the lenses one bridge apart', () => {
    const L = frameLayout(spec)
    expect(2 * L.cx - 52).toBeCloseTo(18, 0)
  })
  it('renders a self-contained SVG with a title', () => {
    const svg = frameSvgString(spec, { kind: 'havana', primary: '#6E4421', secondary: '#D69A4C' }, { title: 'Mira 52' })
    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg).toContain('<title>Mira 52</title>')
    expect(svg).not.toContain('NaN')
  })
})
