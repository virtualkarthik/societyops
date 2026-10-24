import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { getDashboard } from "../../api/dashboard";
import { useTranslation } from "react-i18next";

function StatCard({ title, children, accent = false }: { title: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`bg-white rounded-2xl shadow p-5 ${accent ? "border-l-4 border-red-500" : ""}`}>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function DaysTag({ days }: { days: number | null }) {
  if (days === null) return null;
  const color = days < 0 ? "bg-red-100 text-red-700" : days <= 30 ? "bg-orange-100 text-orange-700" : days <= 60 ? "bg-yellow-100 text-yellow-700" : "bg-green-100 text-green-700";
  return <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>{days < 0 ? `${Math.abs(days)}d expired` : `${days}d left`}</span>;
}

export function DashboardPage() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery({ queryKey: ["dashboard"], queryFn: getDashboard, refetchInterval: 60_000 });

  if (isLoading) return <div className="text-center text-gray-400 py-20">{t("common.loading")}</div>;
  if (error || !data) return <div className="text-center text-red-500 py-20">Failed to load dashboard</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">{t("nav.dashboard")}</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {/* Overdue PPM */}
        <StatCard title="Overdue PPM Tasks" accent={data.overdue_ppm.count > 0}>
          <div className="text-4xl font-bold text-red-600 mb-2">{data.overdue_ppm.count}</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.overdue_ppm.tasks.map((task) => (
              <div key={task.id} className="text-sm text-gray-700 flex justify-between">
                <span className="truncate mr-2">{task.title}</span>
                <span className="text-red-500 text-xs whitespace-nowrap">
                  {task.days_overdue !== null ? `${task.days_overdue}d overdue` : ""}
                </span>
              </div>
            ))}
          </div>
        </StatCard>

        {/* STP Breaches */}
        <StatCard title="STP Breach Alerts (30d)" accent={data.stp_breaches.count > 0}>
          <div className="text-4xl font-bold text-orange-600 mb-2">{data.stp_breaches.count}</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.stp_breaches.tests.map((test) => (
              <div key={test.id} className="text-xs text-gray-600">
                <span className="font-medium">{test.test_date}</span>
                <span className="ml-2 text-red-600">{test.breach_details}</span>
              </div>
            ))}
            {data.stp_breaches.count === 0 && <p className="text-sm text-green-600">All readings within limits ✓</p>}
          </div>
        </StatCard>

        {/* Expiring Docs */}
        <StatCard title="Expiring Documents (90d)" accent={data.expiring_docs.count > 0}>
          <div className="text-4xl font-bold text-yellow-600 mb-2">{data.expiring_docs.count}</div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {data.expiring_docs.docs.map((doc) => (
              <div key={doc.id} className="flex justify-between items-center text-sm">
                <span className="truncate mr-2">{doc.title}</span>
                <DaysTag days={doc.days_until_expiry} />
              </div>
            ))}
          </div>
        </StatCard>

        {/* DG Fuel */}
        <StatCard title="DG Fuel Stock">
          <div className="text-4xl font-bold text-brand mb-1">
            {data.dg_fuel.estimated_stock_litres.toFixed(0)} L
          </div>
          <div className="text-xs text-gray-500 space-y-0.5">
            <div>Purchased: {data.dg_fuel.total_purchased.toFixed(0)} L</div>
            <div>Consumed: {data.dg_fuel.total_consumed.toFixed(0)} L</div>
          </div>
        </StatCard>

        {/* Water This Month */}
        <StatCard title="Water — This Month">
          <div className="space-y-3">
            <div>
              <div className="text-xs text-gray-500">Borewell Run Hours</div>
              <div className="text-2xl font-bold text-blue-500">{data.water_this_month.borewell_run_hours} hrs</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Tanker Deliveries</div>
              <div className="text-2xl font-bold text-cyan-600">{data.water_this_month.tanker_litres.toLocaleString()} L</div>
            </div>
          </div>
        </StatCard>

        {/* Pending Complaints */}
        <StatCard title="Pending Complaints" accent={data.pending_complaints > 5}>
          <div className="text-4xl font-bold text-gray-700 mb-1">{data.pending_complaints}</div>
          <p className="text-xs text-gray-400">Open or in-progress</p>
        </StatCard>

        {/* Asset Anomalies */}
        <StatCard title="Asset Anomalies" accent={data.asset_anomalies.count > 0}>
          <div className="text-4xl font-bold text-red-600 mb-2">{data.asset_anomalies.count}</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {data.asset_anomalies.items.map((a) => (
              <Link key={a.asset_id} to={`/assets/${a.asset_id}`} className="text-sm text-gray-700 flex justify-between hover:text-brand">
                <span className="truncate mr-2">{a.asset_name}</span>
                <span className="text-red-500 text-xs whitespace-nowrap">{a.event_count} in {a.window_days}d</span>
              </Link>
            ))}
            {data.asset_anomalies.count === 0 && <p className="text-sm text-green-600">No abnormal repair patterns ✓</p>}
          </div>
        </StatCard>
      </div>
    </div>
  );
}
