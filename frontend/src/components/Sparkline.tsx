import React from 'react';

type Props = {
  values: Array<number | null | undefined>;
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  fill?: string | null;
  min?: number;
  max?: number;
  ariaLabel?: string;
};

export const Sparkline: React.FC<Props> = ({
  values,
  width = 220,
  height = 40,
  stroke = '#4a90e2',
  strokeWidth = 2,
  fill = null,
  min,
  max,
  ariaLabel = 'sparkline'
}) => {
  const nums = values.map(v => (v === null || v === undefined ? NaN : Number(v)));
  const valid = nums.filter(n => !Number.isNaN(n));
  const vmin = min !== undefined ? min : (valid.length ? Math.min(...valid) : 0);
  const vmax = max !== undefined ? max : (valid.length ? Math.max(...valid) : 1);
  const range = vmax - vmin || 1;
  const stepX = values.length > 1 ? (width - strokeWidth) / (values.length - 1) : 0;

  const points: Array<{ x: number; y: number; n: number } | null> = nums.map((n, i) => {
    if (Number.isNaN(n)) return null;
    const x = strokeWidth / 2 + i * stepX;
    // invert y (SVG origin top-left)
    const y = strokeWidth / 2 + (height - strokeWidth) * (1 - (n - vmin) / range);
    return { x, y, n };
  });

  // Build path, skipping gaps where value is NaN
  let d = '';
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (!p) continue;
    if (!d) {
      d = `M ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    } else {
      d += ` L ${p.x.toFixed(2)} ${p.y.toFixed(2)}`;
    }
  }

  // Optional area fill under the curve (simple baseline at bottom)
  let fillPath: string | null = null;
  if (fill && d) {
    const first = points.find(p => p);
    const last = [...points].reverse().find(p => p);
    if (first && last) {
      fillPath = `${d} L ${last.x.toFixed(2)} ${(height - strokeWidth / 2).toFixed(2)} L ${first.x.toFixed(2)} ${(height - strokeWidth / 2).toFixed(2)} Z`;
    }
  }

  return (
    <svg width={width} height={height} role="img" aria-label={ariaLabel}>
      {fill && fillPath && (
        <path d={fillPath} fill={fill} stroke="none" opacity={0.15} />
      )}
      {d ? (
        <g>
          <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round">
            <title>{ariaLabel}</title>
          </path>
          {points.map((p, i) => p ? (
            <circle key={i} cx={p.x} cy={p.y} r={2} fill={stroke} opacity={0.0}>
              <title>{`${ariaLabel}: ${p.n}`}</title>
            </circle>
          ) : null)}
        </g>
      ) : (
        <line x1={0} y1={height/2} x2={width} y2={height/2} stroke="#ddd" />
      )}
    </svg>
  );
};
