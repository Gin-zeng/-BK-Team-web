import { RATING_DIMS, RATING_MAX } from '../lib/player-analysis';

/** 六维能力六方图（雷达图），手绘 SVG，颜色走 CSS token，深色自动适配。 */
export function Radar({ values, size = 300 }: { values: Record<string, number | null>; size?: number }) {
  const n = RATING_DIMS.length;
  const cx = size / 2, cy = size / 2, R = size / 2 - 46;
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2;
  const pt = (i: number, r: number): [number, number] => [cx + r * Math.cos(angle(i)), cy + r * Math.sin(angle(i))];
  const ring = (lvl: number) => RATING_DIMS.map((_, i) => { const [x, y] = pt(i, (lvl / RATING_MAX) * R); return `${x},${y}`; }).join(' ');
  const dataPoly = RATING_DIMS.map((d, i) => { const v = values[d.key]; const r = v == null ? 0 : (v / RATING_MAX) * R; const [x, y] = pt(i, r); return `${x},${y}`; }).join(' ');
  const has = RATING_DIMS.some((d) => values[d.key] != null);
  return (
    <svg className="radar" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="球员六维能力图" width={size} height={size}>
      {[1, 2, 3, 4, 5].map((lvl) => <polygon key={lvl} points={ring(lvl)} className="radar-ring" />)}
      {RATING_DIMS.map((_, i) => { const [x, y] = pt(i, R); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} className="radar-axis" />; })}
      {has && <polygon points={dataPoly} className="radar-fill" />}
      {RATING_DIMS.map((d, i) => {
        const v = values[d.key];
        const [dx, dy] = pt(i, v == null ? 0 : (v / RATING_MAX) * R);
        const [lx, ly] = pt(i, R + 18);
        const cos = Math.cos(angle(i));
        const anchor = cos > 0.35 ? 'start' : cos < -0.35 ? 'end' : 'middle';
        return (
          <g key={d.key}>
            {v != null && <circle cx={dx} cy={dy} r={3.5} className="radar-dot" />}
            <text x={lx} y={ly} textAnchor={anchor} dominantBaseline="middle" className="radar-label">{d.label}{v != null ? ' ' + v.toFixed(1) : ' —'}</text>
          </g>
        );
      })}
    </svg>
  );
}
