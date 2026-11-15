const personHeightCm = 170;
const figureHeight = 96;
const groundY = 62;
const pixelsPerCm = 50 / personHeightCm;

export function GroundDropFigure({ dropCm, label }: { dropCm: number; label: string }) {
  const drop = Math.min(dropCm, 60) * pixelsPerCm;
  const feetY = groundY + drop;
  const headY = feetY - personHeightCm * pixelsPerCm;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 200 ${figureHeight}`}
      className="h-24 w-full text-muted-foreground"
    >
      <path
        d={`M0 ${groundY} H60 C80 ${groundY} 80 ${feetY} 100 ${feetY} C120 ${feetY} 120 ${groundY} 140 ${groundY} H200 V${figureHeight} H0 Z`}
        className="fill-muted"
      />
      <line
        x1="0"
        x2="200"
        y1={groundY}
        y2={groundY}
        stroke="currentColor"
        strokeDasharray="3 3"
        strokeWidth="1"
      />
      <g className="fill-foreground">
        <circle cx="100" cy={headY + 4} r="4" />
        <rect x="96.5" y={headY + 9} width="7" height={feetY - headY - 9} rx="3.5" />
      </g>
      {drop > 1 ? (
        <g className="text-rate-fast" stroke="currentColor" strokeWidth="1.5">
          <line x1="128" x2="128" y1={groundY} y2={feetY} />
          <line x1="124" x2="132" y1={groundY} y2={groundY} />
          <line x1="124" x2="132" y1={feetY} y2={feetY} />
        </g>
      ) : null}
      <text x="136" y={groundY + drop / 2 + 12} className="fill-foreground text-xs tabular-nums">
        {dropCm} cm
      </text>
    </svg>
  );
}
