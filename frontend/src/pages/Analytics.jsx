import { useEffect, useState } from "react";
import { Line } from "react-chartjs-2";
import {
  CategoryScale, Chart as ChartJS, LinearScale, LineElement, PointElement,
  Title, Tooltip, Legend, Filler,
} from "chart.js";
import { api } from "../api.js";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default function Analytics() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api("/analytics/")
      .then(setData)
      .catch((e) => setErr(e.message || "Failed to load analytics."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="mt-4">Loading…</p>;
  if (err) return <div className="alert alert-danger mt-4">{err}</div>;
  if (!data || data.labels.length === 0) {
    return <p className="mt-4">No data to chart yet — add a few expenses first.</p>;
  }

  const chartData = {
    labels: data.labels,
    datasets: [
      { label: "Debits (-)", data: data.debit, borderColor: "rgba(255,99,132,1)",
        backgroundColor: "rgba(255,99,132,0.3)", fill: true, borderWidth: 2 },
      { label: "Credits (+)", data: data.credit, borderColor: "rgba(75,192,192,1)",
        backgroundColor: "rgba(75,192,192,0.3)", fill: true, borderWidth: 2 },
      { label: "Net (Credit - Debit)", data: data.net, borderColor: "rgba(54,162,235,1)",
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
      <h2 className="mb-3">Monthly Debit, Credit & Net</h2>
      <Line data={chartData} options={options} />
    </div>
  );
}
