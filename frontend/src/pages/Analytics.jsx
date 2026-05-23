import { useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale,
  LineElement, PointElement, Title, Tooltip,
} from "chart.js";
import { useExpenses } from "../data.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

export default function Analytics() {
  const { rows, loading, error } = useExpenses();

  const chart = useMemo(() => {
    if (!rows) return { labels: [], debit: [], credit: [], net: [] };
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 6);
    const buckets = new Map();
    for (const e of rows) {
      const d = new Date(e.date);
      if (isNaN(d) || d < cutoff) continue;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const b = buckets.get(key) || { debit: 0, credit: 0 };
      const amount = parseFloat(e.expense_amount) || 0;
      b[e.transaction_type] += amount;
      buckets.set(key, b);
    }
    const keys = [...buckets.keys()].sort();
    return {
      labels: keys.map((k) => {
        const [y, m] = k.split("-");
        return `${MONTH_NAMES[Number(m) - 1]} ${y}`;
      }),
      debit: keys.map((k) => buckets.get(k).debit),
      credit: keys.map((k) => buckets.get(k).credit),
      net: keys.map((k) => buckets.get(k).credit - buckets.get(k).debit),
    };
  }, [rows]);

  if (error) return <div className="alert alert-danger mt-4">Failed to load: {error.message}</div>;
  if (loading) return <p className="mt-4">Loading database…</p>;
  if (chart.labels.length === 0) {
    return <p className="mt-4">No data to chart yet — add a few expenses first.</p>;
  }

  const data = {
    labels: chart.labels,
    datasets: [
      { label: "Debits (-)", data: chart.debit, borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.3)", fill: true, borderWidth: 2 },
      { label: "Credits (+)", data: chart.credit, borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.3)", fill: true, borderWidth: 2 },
      { label: "Net", data: chart.net, borderColor: "rgba(54,162,235,1)",
        backgroundColor: "rgba(54,162,235,0.3)", fill: false, borderWidth: 2 },
    ],
  };
  const options = {
    responsive: true,
    scales: {
      y: { beginAtZero: true, title: { display: true, text: "Amount (₹)" } },
      x: { title: { display: true, text: "Month" } },
    },
  };

  return (
    <div className="mt-4">
      <h2 className="mb-3">Monthly Debit, Credit &amp; Net</h2>
      <Line data={data} options={options} />
    </div>
  );
}
