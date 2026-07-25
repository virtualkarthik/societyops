import {
  ResponsiveContainer,
  LineChart, Line,
  BarChart, Bar,
  XAxis, YAxis,
  CartesianGrid, Tooltip,
  Legend,
  ReferenceLine,
} from "recharts";

const BRAND = "#1e40af";
const COLORS = ["#1e40af", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444"];

interface Series {
  key: string;
  label: string;
  color?: string;
  type?: "line" | "bar";
}

interface TrendChartProps {
  data: Record<string, unknown>[];
  series: Series[];
  xKey?: string;
  height?: number;
  referenceLines?: { y: number; label: string; color?: string }[];
  yUnit?: string;
  title?: string;
}

const CustomTooltip = ({ active, payload, label, yUnit }: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
  yUnit?: string;
}) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <p className="font-semibold text-gray-700 mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-semibold">{p.value != null ? `${p.value}${yUnit ?? ""}` : "—"}</span>
        </p>
      ))}
    </div>
  );
};

export function TrendChart({ data, series, xKey = "date", height = 200, referenceLines, yUnit, title }: TrendChartProps) {
  const hasBar = series.some((s) => s.type === "bar");
  const hasLine = series.some((s) => s.type !== "bar");
  const ChartComponent = hasBar && !hasLine ? BarChart : LineChart;

  return (
    <div>
      {title && <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{title}</p>}
      <ResponsiveContainer width="100%" height={height}>
        <ChartComponent data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey={xKey} tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={<CustomTooltip yUnit={yUnit} />} />
          {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 4 }} />}
          {referenceLines?.map((rl) => (
            <ReferenceLine key={rl.label} y={rl.y} stroke={rl.color ?? "#ef4444"} strokeDasharray="4 2"
              label={{ value: rl.label, fontSize: 10, fill: rl.color ?? "#ef4444", position: "right" }} />
          ))}
          {series.map((s, i) => {
            const color = s.color ?? COLORS[i % COLORS.length];
            if (s.type === "bar") {
              return <Bar key={s.key} dataKey={s.key} name={s.label} fill={color} radius={[3, 3, 0, 0]} maxBarSize={32} />;
            }
            return (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label}
                stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }}
                connectNulls={false} />
            );
          })}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
}

export { BRAND, COLORS };
