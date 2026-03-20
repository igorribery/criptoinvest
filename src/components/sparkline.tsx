import { SparklineProps } from "@/app/types/sparkline-types";

export function Sparkline({
  data,
  width = 80,
  height = 28,
  className = "",
  positive = true,
  id = "spark",
}: SparklineProps) {
  if (data.length < 2) {
    return <span className="text-slate-500 text-xs">-</span>;
  }

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const chartWidth = width - padding * 2;
  const chartHeight = height - padding * 2;
  const step = chartWidth / (data.length - 1);

  const points = data.map((value, i) => {
    const x = padding + i * step;
    const y = padding + chartHeight - ((value - min) / range) * chartHeight;
    return `${x},${y}`;
  });

  const strokeColor = positive ? "#34d399" : "#f87171"; // emerald-400 / rose-400
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `M ${firstPoint} L ${points.slice(1).join(" L ")} L ${lastPoint.split(",")[0]},${height - padding} L ${firstPoint.split(",")[0]},${height - padding} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={`grad-spark-${id}`}
          x1="0"
          x2="0"
          y1="1"
          y2="0"
        >
          <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
          <stop offset="100%" stopColor={strokeColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#grad-spark-${id})`}
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
