'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CartesianGrid, XAxis, YAxis, Line, LineChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import { Toggle } from '@/components/ui/toggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Info, Eye, EyeOff } from 'lucide-react';
import { createSafeChartKey, CHART_COLORS } from '@/lib/utils/chart-helpers';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface PRInvolvementCardProps {
  data: Array<{ date: string; [dev: string]: string | number }>;
  devs: string[];
  query: string;
}

export function PRInvolvementCard({ data, devs, query }: PRInvolvementCardProps) {
  const [selectedDev, setSelectedDev] = useState<string>(devs[0] || '');
  const [balanceScore, setBalanceScore] = useState<'gini' | 'entropy' | 'both'>('gini');
  const [isAnonymized, setIsAnonymized] = useState<boolean>(false);

  // Create placeholder mapping for dev names
  const devPlaceholders = useMemo(() => {
    const mapping = new Map<string, string>();
    devs.forEach((dev, index) => {
      mapping.set(dev, `dev${index + 1}`);
    });
    return mapping;
  }, [devs]);

  // Create chart config with real or placeholder names based on anonymization
  const chartConfig = useMemo((): ChartConfig => {
    const config: ChartConfig = {};
    devs.forEach((dev, index) => {
      const safeKey = createSafeChartKey(dev);
      config[safeKey] = {
        label: isAnonymized ? devPlaceholders.get(dev) : dev,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    // Team balance score configuration
    config.teamBalance = {
      label: 'Balance (Gini)',
      color: 'var(--chart-2)',
    };
    config.teamEntropy = {
      label: 'Balance (Entropy)',
      color: 'var(--chart-4)',
    };
    return config;
  }, [devs, devPlaceholders, isAnonymized]);

  if (data.length === 0) return null;

  // Handle no devs: show message to configure devs
  if (devs.length === 0) {
    return (
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>PR involvement per person</CardTitle>
          <CardDescription>
            PRs each person was involved in over time, stacked by person.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <Info />
            <AlertTitle>No devs configured</AlertTitle>
            <AlertDescription>
              Please add devs in the Configuration section to see PR involvement data.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  // Render stacked area chart for per-person involvement
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Active PR context, by dev</CardTitle>
        <CardDescription>
          How many PRs a dev is involved in. For example, if Sally is reviewing Bob's PR, Bob and Sally are both involved in that PR. Query used: <code className="text-xs">{query}</code>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info />
          <AlertTitle>Interpreting this chart</AlertTitle>
          <AlertDescription>
            <p>Which devs is the team most reliant on? Is the team becoming more/less balanced? Who might be at silent risk of burnout/attrition?</p>
            <p className="font-semibold mt-2">Notes</p>
            <ul className="list-disc list-inside">
              <li>The Balance score estimates how well distributed the load is among team members, and ranges from 0 to 1.0, with higher being better.</li>
              <li>If, on a given day, there are 0 open PRs that a dev is involved in, that dev is excluded from the Balance score for that day. This is designed to handle devs joining/leaving the team, but has limitations.</li>
              <li>If the query has a <code className="whitespace-nowrap">created&gt;date</code> filter, PRs open as of that date but created prior will be excluded, reducing counts at start of timeline.</li>
            </ul>
          </AlertDescription>
        </Alert>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Highlight dev:</label>
            <Select
              value={selectedDev}
              onValueChange={(value) => setSelectedDev(value)}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {devs.map((dev) => (
                  <SelectItem key={dev} value={dev}>
                    {isAnonymized ? devPlaceholders.get(dev) : dev}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Balance score:</label>
              <Select
                value={balanceScore}
                onValueChange={(value) => setBalanceScore(value as 'gini' | 'entropy' | 'both')}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gini">Gini</SelectItem>
                  <SelectItem value="entropy">Entropy</SelectItem>
                  <SelectItem value="both">Both</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Toggle
            pressed={isAnonymized}
            onPressedChange={setIsAnonymized}
            aria-label="Toggle anonymization"
          >
            {isAnonymized ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="ml-2 text-sm">{isAnonymized ? 'Anonymized' : 'Anonymize'}</span>
          </Toggle>
        </div>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{
              top: 20,
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => {
                const date = new Date(value + 'T12:00:00Z');
                return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
              }}
            />
            <YAxis
              yAxisId="left"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: 'PR count', angle: -90, position: 'insideLeft' }}
              tickFormatter={(value) => Math.round(value).toString()}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              label={{ value: 'Balance', angle: 90, position: 'insideRight' }}
              domain={[0, 1]}
              tickFormatter={(value) => value.toFixed(2)}
            />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent
                labelFormatter={(value) => {
                  const date = new Date(value + 'T12:00:00Z');
                  return date.toLocaleDateString('en-US', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    timeZone: 'UTC'
                  });
                }}
              />}
            />
            <ChartLegend content={<ChartLegendContent />} />
            {devs.map((dev) => {
              const safeKey = createSafeChartKey(dev);
              const isSelected = selectedDev === dev;

              // Selected dev gets chart-1 color, others are muted
              const strokeColor = isSelected ? 'var(--chart-1)' : 'var(--muted-foreground)';

              return (
                <Line
                  key={dev}
                  dataKey={safeKey}
                  name={isAnonymized ? devPlaceholders.get(dev) : dev}
                  type="monotone"
                  stroke={strokeColor}
                  strokeWidth={2}
                  dot={false}
                  yAxisId="left"
                />
              );
            })}
            {/* Team Balance Score Line (Gini) */}
            <Line
              dataKey="teamBalance"
              type="monotone"
              stroke="var(--color-teamBalance)"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={false}
              yAxisId="right"
              hide={balanceScore === 'entropy'}
              legendType={balanceScore === 'entropy' ? 'none' : 'line'}
            />
            {/* Team Balance Score Line (Entropy) */}
            <Line
              dataKey="teamEntropy"
              type="monotone"
              stroke="var(--color-teamEntropy)"
              strokeWidth={3}
              strokeDasharray="5 5"
              dot={false}
              yAxisId="right"
              hide={balanceScore === 'gini'}
              legendType={balanceScore === 'gini' ? 'none' : 'line'}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
