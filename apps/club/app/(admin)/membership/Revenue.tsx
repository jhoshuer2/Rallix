"use client";
import { useState } from "react";
import { RevenueCard } from "@rallix/ui";

const data: Record<string, { amount: string; delta: string; bars: number[] }> = {
  Today: { amount: "₦0", delta: "↗ 0.00", bars: [0, 0, 0, 0] },
  Week: { amount: "₦40,000", delta: "↗ 12.5%", bars: [40, 12, 22, 8] },
  Month: { amount: "₦180,000", delta: "↗ 8.1%", bars: [60, 90, 70, 30] },
  Year: { amount: "₦1,240,000", delta: "↗ 21%", bars: [30, 50, 80, 100] },
};
export function Revenue() {
  const [period, setPeriod] = useState("Today");
  const d = data[period]!;
  return <RevenueCard period={period} onPeriod={setPeriod} amount={d.amount} delta={d.delta} bars={d.bars} />;
}
