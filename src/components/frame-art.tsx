import { cloneElement, createElement, type CSSProperties, type ReactElement } from 'react'
import type { Swatch } from '@/lib/db/schema'
import { buildFrameSvg, type FrameRenderOptions, type FrameSpec, type SvgNode } from '@/lib/frame-geometry'

const camel = (k: string) => (k.startsWith('aria-') || k.startsWith('data-') ? k : k === 'class' ? 'className' : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()))

function toReact(node: SvgNode, key?: number | string): ReactElement {
  const props: Record<string, unknown> = { key }
  for (const [k, v] of Object.entries(node.a ?? {})) if (v !== undefined) props[camel(k)] = v
  const children = node.text ? node.text : (node.c ?? []).map((c, i) => toReact(c, i))
  return createElement(node.t, props, children as never)
}

export type FrameArtProduct = Pick<FrameSpec, 'shape' | 'lensWidth' | 'lensHeight' | 'bridgeWidth' | 'rim' | 'material' | 'geometry' | 'category'>

/** True-to-scale procedural render of a frame. Works in Server and Client Components. */
export function FrameArt({
  product,
  swatch,
  className,
  style,
  ...opts
}: { product: FrameArtProduct; swatch: Swatch; className?: string; style?: CSSProperties } & FrameRenderOptions) {
  const tree = buildFrameSvg(product as FrameSpec, swatch, opts)
  tree.a = { ...tree.a, class: className }
  const el = toReact(tree)
  return style ? cloneElement(el as ReactElement<{ style?: CSSProperties }>, { style }) : el
}
