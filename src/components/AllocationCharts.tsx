"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { type ComputedHolding, PIE_COLORS } from "@/lib/constants";
import { formatMoney, getAllocation } from "@/lib/utils";

interface Props {
  holdings: ComputedHolding[];
  totalValue: number;
}

export default function AllocationCharts({ holdings, totalValue }: Props) {
  const byPlatform = getAllocation(holdings, "platform", totalValue);
  const byAssetClass = getAllocation(holdings, "assetClass", totalValue);
  const byGeography = getAllocation(holdings, "geography", totalValue);

  return (
    <section className="grid gap-4 xl:grid-cols-3">
      <PieAllocationCard title="By platform" items={byPlatform} />
      <PieAllocationCard title="By asset class" items={byAssetClass} />
      <PieAllocationCard title="By geography" items={byGeography} />
    </section>
  );
}

function PieAllocationCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; weight: number }[];
}) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {items.length ? (
        <>
          <div className="mt-3 h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={items} dataKey="value" nameKey="label" innerRadius={34} outerRadius={56} paddingAngle={2}>
                  {items.map((item, index) => (
                    <Cell key={item.label} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "0.75rem",
                    color: "#0f172a",
                    fontSize: "12px",
                    boxShadow: "0 8px 24px rgba(15,23,42,0.08)",
                  }}
                  formatter={(value) => formatMoney(Number(value), "AED")}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {items.map((item, index) => (
              <div key={item.label} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-2.5 py-2 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }} />
                  <span className="truncate text-slate-700">{item.label}</span>
                </div>
                <span className="shrink-0 text-slate-500">{item.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-4 rounded-xl bg-slate-100 p-4 text-center text-sm text-slate-500">No data yet</div>
      )}
    </div>
  );
}
