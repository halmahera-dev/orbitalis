const WIDTH = 240;
const HEIGHT = 48;
const TOP_MARGIN = 4;

export function Sparkline({
  values,
  color,
  isStep = false,
  className = "h-12",
}: {
  values: number[];
  color: string;
  isStep?: boolean;
  className?: string;
}) {
  if (values.length === 0) {
    return <div className={className} aria-hidden="true" />;
  }

  const drawn = isStep ? [...values, values[values.length - 1]] : values;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const padding = (max - min) * 0.2 || 1;
  const low = min - padding;
  const high = max + padding / 2;

  function xAt(index: number) {
    return drawn.length > 1 ? (index / (drawn.length - 1)) * WIDTH : 0;
  }

  function yAt(value: number) {
    return TOP_MARGIN + (1 - (value - low) / (high - low)) * (HEIGHT - TOP_MARGIN);
  }

  const line = drawn
    .map((value, index) => {
      const x = xAt(index).toFixed(1);
      const y = yAt(value).toFixed(1);
      if (index === 0) {
        return `M${x} ${y}`;
      }
      return isStep ? `H${x} V${y}` : `L${x} ${y}`;
    })
    .join(" ");
  const baseline = yAt(min).toFixed(1);
  const area = `${line} L${xAt(drawn.length - 1).toFixed(1)} ${baseline} L0 ${baseline} Z`;

  return (
    <div className={className} aria-hidden="true">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="size-full overflow-visible"
      >
        <path d={area} fill={color} fillOpacity={0.12} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
