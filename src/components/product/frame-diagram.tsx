import { frameLayout, pathFromPoints, type FrameSpec } from '@/lib/frame-geometry'

/**
 * Technical drawing (front view) with dimension lines — the "fișă tehnică".
 * 1 SVG unit = 1 mm, labels in the mono face. Pure → server or client.
 */
export function FrameDiagram({ spec, temple, frameWidth, className, overlay }: { spec: FrameSpec; temple: number; frameWidth: number; className?: string; overlay?: FrameSpec | null }) {
  const L = frameLayout(spec)
  const lens = pathFromPoints(L.outline)
  const a = L.a
  const b = L.b
  const cx = L.cx
  const halfTotal = frameWidth / 2
  const topY = -b - 14
  const bottomY = b + 12
  const pad = 22
  const vbX = -halfTotal - pad
  const vbW = (halfTotal + pad) * 2
  const vbY = topY - 12
  const vbH = bottomY + 26 - vbY
  const O = overlay ? frameLayout(overlay) : null
  const dim = '#2638C9'
  const label = (x: number, y: number, text: string, anchor: 'middle' | 'start' | 'end' = 'middle') => (
    <text x={x} y={y} textAnchor={anchor} fontFamily="var(--font-code), monospace" fontSize="4.6" fill="#0D1216" letterSpacing="0.2">
      {text}
    </text>
  )
  const arrowH = (x1: number, x2: number, y: number) => (
    <g stroke={dim} strokeWidth="0.35" fill="none">
      <line x1={x1} x2={x2} y1={y} y2={y} />
      <path d={`M${x1 + 2} ${y - 1.2}L${x1} ${y}L${x1 + 2} ${y + 1.2}`} />
      <path d={`M${x2 - 2} ${y - 1.2}L${x2} ${y}L${x2 - 2} ${y + 1.2}`} />
    </g>
  )
  return (
    <svg viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`} className={className} role="img" aria-label={`Desen tehnic: lentilă ${spec.lensWidth} mm, punte ${spec.bridgeWidth} mm, înălțime ${spec.lensHeight} mm, lățime totală ${frameWidth} mm`}>
      <defs>
        <pattern id="fd-grid" width="5" height="5" patternUnits="userSpaceOnUse">
          <path d="M5 0H0V5" fill="none" stroke="#0D1216" strokeOpacity="0.05" strokeWidth="0.2" />
        </pattern>
      </defs>
      <rect x={vbX} y={vbY} width={vbW} height={vbH} fill="url(#fd-grid)" />
      {/* centre line */}
      <line x1={0} x2={0} y1={topY - 4} y2={bottomY + 8} stroke="#0D1216" strokeOpacity="0.25" strokeWidth="0.25" strokeDasharray="3 1.5 0.6 1.5" />
      <line x1={-halfTotal - 6} x2={halfTotal + 6} y1={0} y2={0} stroke="#0D1216" strokeOpacity="0.18" strokeWidth="0.25" strokeDasharray="3 1.5 0.6 1.5" />
      {/* lenses */}
      <g fill="none" stroke="#0D1216" strokeWidth="0.55">
        <path d={lens} transform={`translate(${cx} 0)`} />
        <path d={lens} transform={`translate(${-cx} 0) scale(-1 1)`} />
        <path d={`M${-L.bridgeX} ${L.bridgeY}C${-L.bridgeX * 0.45} ${L.bridgeY - 4} ${L.bridgeX * 0.45} ${L.bridgeY - 4} ${L.bridgeX} ${L.bridgeY}`} />
        <line x1={L.hingeX} x2={halfTotal} y1={L.hingeY} y2={L.hingeY} />
        <line x1={-L.hingeX} x2={-halfTotal} y1={L.hingeY} y2={L.hingeY} />
      </g>
      {/* overlay: the customer's current frame */}
      {O ? (
        <g fill="none" stroke="#C2311F" strokeWidth="0.5" strokeDasharray="1.6 1.2">
          <path d={pathFromPoints(O.outline)} transform={`translate(${O.cx} 0)`} />
          <path d={pathFromPoints(O.outline)} transform={`translate(${-O.cx} 0) scale(-1 1)`} />
        </g>
      ) : null}
      {/* boxing rectangle of the right lens */}
      <rect x={cx - a} y={-b} width={a * 2} height={b * 2} fill="none" stroke={dim} strokeOpacity="0.35" strokeWidth="0.25" strokeDasharray="1 1" />
      {/* A */}
      {arrowH(cx - a, cx + a, bottomY)}
      <line x1={cx - a} x2={cx - a} y1={b} y2={bottomY + 2} stroke={dim} strokeWidth="0.25" />
      <line x1={cx + a} x2={cx + a} y1={b} y2={bottomY + 2} stroke={dim} strokeWidth="0.25" />
      {label(cx, bottomY + 7, `A ${spec.lensWidth}`)}
      {/* DBL */}
      {arrowH(-spec.bridgeWidth / 2, spec.bridgeWidth / 2, topY + 6)}
      <line x1={-spec.bridgeWidth / 2} x2={-spec.bridgeWidth / 2} y1={topY + 4} y2={L.bridgeY} stroke={dim} strokeWidth="0.25" />
      <line x1={spec.bridgeWidth / 2} x2={spec.bridgeWidth / 2} y1={topY + 4} y2={L.bridgeY} stroke={dim} strokeWidth="0.25" />
      {label(0, topY + 2.6, `DBL ${spec.bridgeWidth}`)}
      {/* total width */}
      {arrowH(-halfTotal, halfTotal, topY - 4)}
      {label(-halfTotal + 2, topY - 6, `${frameWidth} mm`, 'start')}
      {/* B */}
      <g stroke={dim} strokeWidth="0.35" fill="none">
        <line x1={cx + a + 9} x2={cx + a + 9} y1={-b} y2={b} />
        <path d={`M${cx + a + 7.8} ${-b + 2}L${cx + a + 9} ${-b}L${cx + a + 10.2} ${-b + 2}`} />
        <path d={`M${cx + a + 7.8} ${b - 2}L${cx + a + 9} ${b}L${cx + a + 10.2} ${b - 2}`} />
      </g>
      <line x1={cx + a} x2={cx + a + 11} y1={-b} y2={-b} stroke={dim} strokeWidth="0.25" />
      <line x1={cx + a} x2={cx + a + 11} y1={b} y2={b} stroke={dim} strokeWidth="0.25" />
      <g transform={`translate(${cx + a + 14} 0) rotate(90)`}>{label(0, 0, `B ${spec.lensHeight}`)}</g>
      {/* temple callout */}
      {label(-halfTotal, bottomY + 18, `BRAȚ ${temple} MM  ·  SCARĂ 1:1 (MM)`, 'start')}
    </svg>
  )
}
