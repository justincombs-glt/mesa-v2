interface Props {
  values: number[];
  width?: number;
  height?: number;
  /** When true, lower values are 'better' — affects the trend color. */
  lowerIsBetter?: boolean;
  /** Highlights the last point with a filled circle. */
  highlightLast?: boolean;
}

/**
 * Tiny inline sparkline rendered as SVG. Server-renderable (pure JSX, no client state).
 * Uses CSS variables / theme colors via inline tailwind hex equivalents to keep things
 * predictable in printable pages.
 */
export function Sparkline({ values, width = 80, height = 24, lowerIsBetter, highlightLast = true }: Props) {
  if (values.length === 0) {
    return <span className="text-ink-faint text-xs">—</span>;
  }
  if (values.length === 1) {
    // Single point: a flat dash + dot
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="single data point">
        <circle cx={width / 2} cy={height / 2} r="2" fill="#0b1a2f" />
      </svg>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const padding = 2;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;

  const points = values.map((v, i) => {
    const x = padding + (i / (values.length - 1)) * innerW;
    // Higher value → lower y (inverted). Doesn't matter for "trend" — sparkline always reflects raw shape.
    const y = padding + innerH - ((v - min) / range) * innerH;
    return [x, y] as const;
  });

  const path = points.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

  // Determine if trend is "improving"
  const first = values[0];
  const last = values[values.length - 1];
  const improving = lowerIsBetter ? last < first : last > first;
  const flat = first === last;
  const strokeColor = flat ? '#6b7689' : improving ? '#7a9b7e' : '#d4342f';

  const [lx, ly] = points[points.length - 1];

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`trend: ${values.length} data points`}>
      <path d={path} fill="none" stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {highlightLast && (
        <circle cx={lx} cy={ly} r="2" fill={strokeColor} />
      )}
    </svg>
  );
}
