"use client";
import type { ChartPoint } from "@/lib/reports";
import type { Entry, Project } from "@/lib/schema";
import { hours } from "@/lib/time";
import { BarChart3, Download, FolderKanban, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Empty } from "./shared";
import { colors } from "./types";
export function ReportsView({
  filtered,
  total,
  chart,
  distribution,
  clientDistribution,
  busy,
  canExport,
  exportCSV,
}: {
  filtered: Entry[];
  total: number;
  chart: ChartPoint[];
  distribution: (Project & { seconds: number })[];
  clientDistribution: { id: string; name: string; seconds: number }[];
  busy: boolean;
  canExport: boolean;
  exportCSV: () => Promise<void>;
}) {
  return (
    <>
      <div className="report-summary">
        <div>
          <span>TEMPS TOTAL</span>
          <strong>{hours(total)}</strong>
          <small>
            {filtered.length} entrée{filtered.length > 1 ? "s" : ""} sur la
            période · chronomètre en cours exclu
          </small>
        </div>
        <button
          className="button secondary"
          onClick={exportCSV}
          disabled={busy || !canExport}
        >
          <Download size={16} />
          Exporter le rapport
        </button>
      </div>
      <section className="panel chart-panel">
        <div className="panel-heading">
          <h2>Votre rythme de travail</h2>
          <span>Heures enregistrées</span>
        </div>
        {total ? (
          <div className="chart">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={chart}
                margin={{
                  top: 14,
                  right: 12,
                  bottom: 5,
                  left: -24,
                }}
              >
                <CartesianGrid
                  strokeDasharray="4 4"
                  vertical={false}
                  stroke="#eae9ee"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8a8795" }}
                  minTickGap={24}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 11, fill: "#8a8795" }}
                />
                <Tooltip
                  formatter={(value) => [
                    `${Number(value).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} h`,
                    "Temps travaillé",
                  ]}
                  labelFormatter={(_, payload) =>
                    payload?.[0]?.payload?.période || ""
                  }
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid #e9e7ef",
                  }}
                  cursor={{ fill: "#f4f1fc" }}
                />
                <Bar
                  dataKey="heures"
                  fill="#8069d8"
                  radius={[5, 5, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty
            icon={<BarChart3 size={28} />}
            title="Des repères, au fil du temps"
            text="Vos graphiques apparaîtront dès que du temps sera enregistré sur cette période."
          />
        )}
      </section>
      <div className="report-grid">
        <section className="panel">
          <div className="panel-heading">
            <h2>Répartition par projet</h2>
            <FolderKanban size={18} />
          </div>
          {!distribution.length && (
            <p className="muted padded">Aucun temps enregistré.</p>
          )}
          {distribution.map((p) => (
            <div className="distribution" key={p.id}>
              <div>
                <span>
                  <span className="color-dot" style={{ background: p.color }} />
                  {p.name}
                </span>
                <strong>
                  {hours(p.seconds)}
                  <small>{Math.round((p.seconds / total) * 100)} %</small>
                </strong>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${(p.seconds / total) * 100}%`,
                    background: p.color,
                  }}
                />
              </div>
            </div>
          ))}
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>Répartition par client</h2>
            <Users size={18} />
          </div>
          {!clientDistribution.length && (
            <p className="muted padded">Aucun temps enregistré.</p>
          )}
          {clientDistribution.map((c, i) => (
            <div className="distribution" key={c.id}>
              <div>
                <span>
                  <span
                    className="color-dot"
                    style={{
                      background: colors[i % colors.length],
                    }}
                  />
                  {c.name}
                </span>
                <strong>
                  {hours(c.seconds)}
                  <small>{Math.round((c.seconds / total) * 100)} %</small>
                </strong>
              </div>
              <div className="progress">
                <i
                  style={{
                    width: `${(c.seconds / total) * 100}%`,
                    background: colors[i % colors.length],
                  }}
                />
              </div>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
