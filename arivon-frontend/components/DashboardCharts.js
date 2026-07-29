"use client";

import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";

const GENDER_COLORS = { male: "#4F46E5", female: "#DB2777", other: "#94A3B8" };
const FEE_COLORS = { paid: "#0D9488", remaining: "#FDE68A" };

export default function DashboardCharts({ summary }) {
  if (!summary) return null;

  const gender = summary.gender_distribution;
  const genderData = [
    { name: "Boys", value: gender.male, color: GENDER_COLORS.male },
    { name: "Girls", value: gender.female, color: GENDER_COLORS.female },
    ...(gender.other > 0 ? [{ name: "Other", value: gender.other, color: GENDER_COLORS.other }] : []),
  ].filter((d) => d.value > 0);
  const totalGenderCount = genderData.reduce((sum, d) => sum + d.value, 0);

  const feeRemaining = Math.max(summary.fees_total_due - summary.fees_total_paid, 0);
  const feeData = summary.fees_total_due > 0
    ? [
        { name: "Collected", value: summary.fees_total_paid, color: FEE_COLORS.paid },
        { name: "Remaining", value: feeRemaining, color: FEE_COLORS.remaining },
      ]
    : [];
  const feePct = summary.fees_total_due > 0 ? Math.round((summary.fees_total_paid / summary.fees_total_due) * 100) : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
      {/* Gender Distribution */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Student Demographics</h3>
        <p className="text-xs text-slate-500 mb-3">{totalGenderCount} students</p>
        {totalGenderCount === 0 ? (
          <EmptyChartState label="No students enrolled yet" />
        ) : (
          <div className="flex items-center gap-4">
            <div className="w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={genderData} dataKey="value" innerRadius={35} outerRadius={54} paddingAngle={2}>
                    {genderData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {genderData.map((d) => (
                <div key={d.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                  <span className="text-slate-600">{d.name}</span>
                  <span className="font-semibold text-slate-900">{d.value}</span>
                  <span className="text-slate-400">({Math.round((d.value / totalGenderCount) * 100)}%)</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Class-wise Strength */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Class-wise Strength</h3>
        <p className="text-xs text-slate-500 mb-3">
          {summary.class_wise_strength.length} classes · {summary.total_students} students
        </p>
        {summary.class_wise_strength.length === 0 ? (
          <EmptyChartState label="No classes provisioned yet" />
        ) : (
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.class_wise_strength} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <XAxis dataKey="class_name" tick={{ fontSize: 9, fill: "#94A3B8" }} interval={0} angle={-35} textAnchor="end" height={40} />
                <YAxis tick={{ fontSize: 9, fill: "#94A3B8" }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }}
                  formatter={(value) => [value, "Students"]}
                />
                <Bar dataKey="student_count" fill="#6D5BFF" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Fee Collection */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Fee Collection</h3>
        <p className="text-xs text-slate-500 mb-3">This academic session</p>
        {feeData.length === 0 ? (
          <EmptyChartState label="No fee invoices raised yet" />
        ) : (
          <div className="flex items-center gap-4">
            <div className="relative w-28 h-28 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={feeData} dataKey="value" innerRadius={35} outerRadius={54} paddingAngle={2} startAngle={90} endAngle={-270}>
                    {feeData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-display font-bold text-slate-900">{feePct}%</span>
              </div>
            </div>
            <div className="space-y-1.5 text-xs">
              <p className="text-slate-600">Collected <span className="font-semibold text-slate-900">₹{summary.fees_total_paid.toLocaleString("en-IN")}</span></p>
              <p className="text-slate-600">Remaining <span className="font-semibold text-slate-900">₹{feeRemaining.toLocaleString("en-IN")}</span></p>
              <p className="text-slate-600">Total Due <span className="font-semibold text-slate-900">₹{summary.fees_total_due.toLocaleString("en-IN")}</span></p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyChartState({ label }) {
  return (
    <div className="h-28 flex items-center justify-center">
      <p className="text-xs text-slate-400">{label}</p>
    </div>
  );
}
