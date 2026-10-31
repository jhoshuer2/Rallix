"use client";
import { useState } from "react";
import { RevenueCard } from "@rallix/ui";

export function Revenue({ data }: { data: Record<string, { amount: string; bars: number[] }> }) {
  const [period, setPeriod] = useState("Today");
  const d = data[period]!;
  return <RevenueCard period={period} onPeriod={setPeriod} amount={d.amount} delta="" bars={d.bars} />;
}
