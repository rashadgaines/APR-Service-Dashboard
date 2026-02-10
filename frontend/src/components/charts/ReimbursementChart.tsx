import { useEffect, useRef } from "react";
import { Chart, ChartData, ChartOptions, registerables } from "chart.js";
import "chartjs-adapter-date-fns";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { formatCurrency } from '@/lib/utils';

/**
 * Interface for a single reimbursement data point.
 */
export interface ReimbursementData {
  date: string | Date; // ISO string (YYYY-MM-DD) or Date object
  amount: number;
  category?: string; // Optional category (e.g., 'Travel', 'Supplies')
}

interface ReimbursementChartProps {
  data: ReimbursementData[];
  canvasId?: string;
}

// Use the dashboard's primary blue (Tailwind text-primary, #1e293b or #2563eb)
function getColor(index: number): string {
  // #1e293b is Tailwind's slate-800, often used for text-primary
  return '#1e293b';
}

export function ReimbursementChart({ data, canvasId = "reimbursementChart" }: ReimbursementChartProps) {
  const chartRef = useRef<Chart | null>(null);

  useEffect(() => {
    Chart.register(...registerables);
    // Get last 7 days, fill missing days with 0
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: { date: Date; amount: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      days.push({ date: d, amount: 0 });
    }
    // Map data to days
    data.forEach((item) => {
      const itemDate = new Date(typeof item.date === "string" ? item.date : item.date);
      itemDate.setHours(0, 0, 0, 0);
      const found = days.find((d) => d.date.getTime() === itemDate.getTime());
      if (found) found.amount = item.amount;
    });

    if (chartRef.current) {
      chartRef.current.destroy();
      chartRef.current = null;
    }
    const ctx = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!ctx) return;
    // Chart.js bar chart config
    const chartData: ChartData<'bar'> = {
      labels: days.map((d) => d.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })),
      datasets: [
        {
          label: "Reimbursements (USD)",
          data: days.map((d) => d.amount),
          backgroundColor: getColor(0),
          borderRadius: 8,
          maxBarThickness: 36,
          hoverBackgroundColor: getColor(0),
        },
      ],
    };
    const options: ChartOptions<'bar'> = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: false,
        },
        legend: { display: false },
        tooltip: {
          backgroundColor: '#18181b',
          titleColor: '#fff',
          bodyColor: '#fff',
          borderColor: getColor(0),
          borderWidth: 1,
          callbacks: {
            label: (item) => {
              const y = item.parsed.y ?? 0;
              return `Amount: ${formatCurrency(y)}`;
            },
          },
        },
      },
      scales: {
        x: {
          title: { display: false },
          grid: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: 'Inter, sans-serif', size: 12 },
          },
        },
        y: {
          title: { display: false },
          beginAtZero: true,
          ticks: {
            color: '#64748b',
            font: { family: 'Inter, sans-serif', size: 12 },
            callback: (value) => formatCurrency(Number(value)),
          },
          grid: { display: true, color: '#e5e7eb' },
        },
      },
      layout: {
        padding: 0,
      },
      backgroundColor: 'transparent',
    };
    chartRef.current = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options,
    });
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, [data, canvasId]);

  return (
    <Card className="border border-border/50">
      <CardHeader className="pt-6 px-6 pb-2">
        <CardTitle className="font-serif text-xl">Daily Reimbursements</CardTitle>
        <p className="text-[10px] font-sans font-bold uppercase tracking-widest text-muted-foreground/60 mt-1">
          Last 7 days
        </p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="h-72">
          <canvas id={canvasId} className="w-full h-full" aria-label="Daily Reimbursements Bar Chart" role="img" />
        </div>
      </CardContent>
    </Card>
  );
}
