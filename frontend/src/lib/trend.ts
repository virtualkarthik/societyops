// Trend charts need "the last N days that actually have data" rather than
// "the last N calendar days from today" — a fixed calendar window renders
// empty whenever nothing was logged today (or the last day someone looked).
export function recentDateLabels(isoDates: string[], count: number): string[] {
  const withTime = isoDates
    .map((iso) => ({ iso, time: new Date(iso).getTime() }))
    .filter((d) => !Number.isNaN(d.time))
    .sort((a, b) => a.time - b.time);

  const labels: string[] = [];
  for (const { iso } of withTime) {
    const label = new Date(iso).toLocaleDateString("en-IN", { month: "short", day: "numeric" });
    if (labels[labels.length - 1] !== label) labels.push(label);
  }
  return labels.slice(-count);
}
