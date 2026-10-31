import type { ReactNode } from "react";

export const Badge = ({ tone, children }: { tone?: "ok" | "warn" | "bad" | "info"; children: ReactNode }) => <span className={`cs-badge${tone ? ` cs-badge--${tone}` : ""}`}>{children}</span>;

export const Kpi = ({ label, value, note }: { label: string; value: ReactNode; note?: string }) => (
  <div className="cs-kpi"><dl style={{ margin: 0 }}><dt>{label}</dt><dd>{value}</dd></dl>{note ? <small>{note}</small> : null}</div>
);

export const PageHead = ({ title, sub, actions }: { title: string; sub?: string; actions?: ReactNode }) => (
  <div className="cs-head"><div><h1 className="cs-h1">{title}</h1>{sub ? <p className="cs-muted" style={{ margin: 0 }}>{sub}</p> : null}</div>{actions ? <div className="cs-actions">{actions}</div> : null}</div>
);

export const Empty = ({ children }: { children: ReactNode }) => <div className="cs-tablewrap"><p className="cs-empty">{children}</p></div>;

/** Simple accessible bar chart. Values are drawn as bars and also exposed as a hidden table. */
export function Bars({ data, label, color = "var(--rx-rust)" }: { data: Array<{ label: string; value: number }>; label: string; color?: string }) {
  const W = 640, H = 160, pad = 22, max = Math.max(1, ...data.map((d) => d.value));
  const bw = (W - pad * 2) / Math.max(1, data.length);
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="cs-chart" role="img" aria-label={`${label}. Total ${data.reduce((a, d) => a + d.value, 0)}.`}>
        <line x1={pad} y1={H} x2={W - pad} y2={H} stroke="#bdb8a8" />
        {data.map((d, i) => {
          const h = (d.value / max) * (H - 14);
          return <rect key={i} x={pad + i * bw + 1} y={H - h} width={Math.max(1, bw - 2)} height={h} fill={color} rx="1"><title>{`${d.label}: ${d.value}`}</title></rect>;
        })}
        <text x={pad} y={H + 13}>{data[0]?.label}</text>
        <text x={W - pad} y={H + 13} textAnchor="end">{data[data.length - 1]?.label}</text>
        <text x={pad} y={10}>{max}</text>
      </svg>
      <table className="cs-sr"><caption>{label}</caption><thead><tr><th>Day</th><th>Count</th></tr></thead><tbody>{data.map((d, i) => <tr key={i}><td>{d.label}</td><td>{d.value}</td></tr>)}</tbody></table>
    </figure>
  );
}
