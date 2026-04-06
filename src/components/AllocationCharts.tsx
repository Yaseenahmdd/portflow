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
    <div className="grid gap-4 md:grid-cols-3">
      <PieCard title="By Platform" items={byPlatform} />
      <PieCard title="By Asset Class" items={byAssetClass} />
      <PieCard title="By Geography" items={byGeography} />
    </div>
  );
}

function PieCard({
  title,
  items,
}: {
  title: string;
  items: { label: string; value: number; weight: number }[];
}) {
  const hasData = items.length > 0 && items.some((i) => i.value > 0);

  if (!hasData) {
    return (
      <div className="glass-card p-5">
        <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
        <div className="mt-4 flex h-44 items-center justify-center text-sm text-text-muted">
          No data yet — refresh prices
        </div>
        {items.length > 0 && (
          <div className="mt-2 space-y-1.5">
            {items.map((item, i) => (
              <div key={item.label} className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="truncate text-text-secondary">{item.label}</span>
                </div>
                <span className="shrink-0 font-mono text-text-muted">{item.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-5">
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
      <div className="mt-3 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={items}
              dataKey="value"
              nameKey="label"
              innerRadius={36}
              outerRadius={60}
              paddingAngle={2}
              stroke="none"
            >
              {items.map((item, i) => (
                <Cell key={item.label} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "#1A1F35",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: "0.75rem",
                fontSize: "0.75rem",
                color: "#F1F5F9",
              }}
              formatter={(value) => formatMoney(Number(value), "AED")}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2 space-y-1.5">
        {items.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors hover:bg-bg-card-hover"
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="truncate text-text-secondary">{item.label}</span>
            </div>
            <span className="shrink-0 font-mono text-text-muted">
              {item.weight.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
