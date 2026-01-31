"use client"


import { TrendingUp } from "lucide-react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card"


export function DailyReimbursementsLineChart({ data }: { data: { date: string; daily: number }[] }) {
  // Only show last 7 days
  const last7 = data.slice(-7)

  // Custom tooltip for better UX
  function CustomTooltip({ active, payload, label }: any) {
    if (active && payload && payload.length) {
      return (
        <div className="rounded border bg-card px-3 py-2 shadow-sm text-xs">
          <div className="font-medium">{label}</div>
          <div className="text-primary font-bold">{payload[0].value}</div>
        </div>
      );
    }
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daily Reimbursements (Last 7 Days)</CardTitle>
        <div className="text-muted-foreground text-sm">Line chart of daily reimbursements</div>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={last7} margin={{ left: 12, right: 12, top: 10, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                style={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                style={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                width={40}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 0.2 }} />
              <Line
                type="monotone"
                dataKey="daily"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={{ r: 3, fill: 'hsl(var(--primary))' }}
                activeDot={{ r: 5, fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
      <div className="px-6 pb-4 pt-2 text-sm text-muted-foreground flex items-center gap-2">
        7-day trend <TrendingUp className="h-4 w-4" />
        <span className="ml-2">Showing daily reimbursements for the last 7 days</span>
      </div>
    </Card>
  )
}
