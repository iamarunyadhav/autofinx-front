import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

// Generate mock portfolio data
function generatePortfolioData() {
  const data = [];
  let value = 50000;
  const now = new Date();

  for (let i = 30; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    // Random walk with slight upward bias
    value = value * (1 + (Math.random() - 0.45) * 0.03);

    data.push({
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      value: Math.round(value),
    });
  }

  return data;
}

export function PortfolioChart() {
  const data = useMemo(() => generatePortfolioData(), []);
  const startValue = data[0].value;
  const currentValue = data[data.length - 1].value;
  const change = currentValue - startValue;
  const changePercent = ((change / startValue) * 100).toFixed(2);
  const isPositive = change >= 0;

  return (
    <Card variant="glass" className="col-span-2">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-base">Portfolio Value</CardTitle>
            <div className="flex items-baseline gap-3 mt-2">
              <span className="text-3xl font-bold font-mono">
                ${currentValue.toLocaleString()}
              </span>
              <Badge variant={isPositive ? "profit" : "loss"}>
                {isPositive ? "+" : ""}
                {changePercent}%
              </Badge>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge variant="secondary">1M</Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pb-4">
        <div className="h-[240px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="portfolioGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={isPositive ? "hsl(142, 76%, 42%)" : "hsl(0, 72%, 51%)"}
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor={isPositive ? "hsl(142, 76%, 42%)" : "hsl(0, 72%, 51%)"}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(222, 30%, 18%)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fill: "hsl(215, 20%, 55%)", fontSize: 11 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                dx={-10}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(222, 47%, 8%)",
                  border: "1px solid hsl(222, 30%, 18%)",
                  borderRadius: "8px",
                  boxShadow: "0 4px 24px hsl(222, 47%, 4% / 0.5)",
                }}
                labelStyle={{ color: "hsl(210, 40%, 96%)", fontWeight: 600 }}
                itemStyle={{ color: "hsl(185, 84%, 50%)" }}
                formatter={(value: number) => [
                  `$${value.toLocaleString()}`,
                  "Value",
                ]}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={isPositive ? "hsl(142, 76%, 42%)" : "hsl(0, 72%, 51%)"}
                strokeWidth={2}
                fill="url(#portfolioGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
