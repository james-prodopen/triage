'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { CartesianGrid, XAxis, YAxis, Line, LineChart } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltip, ChartLegend, ChartLegendContent } from '@/components/ui/chart';
import type { Repository } from '@/lib/types/github';

interface ThroughputCardProps {
  throughputPercentageData: any[];
  throughputChartConfig: ChartConfig;
  throughputSafeKeys: Record<string, string>;
  selectedReposForThroughput: string[];
  repositoriesWithData: Repository[];
  onRepoToggle: (repoId: string) => void;
}

export function ThroughputCard({
  throughputPercentageData,
  throughputChartConfig,
  throughputSafeKeys,
  selectedReposForThroughput,
  repositoriesWithData,
  onRepoToggle,
}: ThroughputCardProps) {
  if (throughputPercentageData.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle>Bugfixes as share of team PR throughput</CardTitle>
        <CardDescription className="flex items-center gap-2">
          <div className="inline-flex flex-col items-center">
            <div>Bugfix PRs per repo<Badge variant="secondary" className="ml-1">1</Badge></div>
            <div className="w-full border-t border-muted-foreground my-0.5"></div>
            <div>Total PRs across all repos<Badge variant="secondary" className="ml-1">2</Badge></div>
          </div>
          <span>, aggregated monthly</span>
        </CardDescription>

        <Collapsible className="pt-4">
          <CollapsibleTrigger className="flex items-center gap-2 [&[data-state=open]>svg]:rotate-180">
            <h4 className="text-sm font-semibold">
              {selectedReposForThroughput.length} {selectedReposForThroughput.length === 1 ? 'repository' : 'repositories'} selected
            </h4>
            <ChevronsUpDown className="h-4 w-4 transition-transform" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2">
            <div className="flex flex-wrap gap-2">
              {repositoriesWithData.map((repo) => (
                <div key={repo.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`throughput-${repo.id}`}
                    checked={selectedReposForThroughput.includes(repo.id)}
                    onCheckedChange={() => onRepoToggle(repo.id)}
                  />
                  <Label htmlFor={`throughput-${repo.id}`} className="text-sm font-medium cursor-pointer">
                    {repo.id}
                  </Label>
                </div>
              ))}
            </div>
            {repositoriesWithData.length > 1 && (
              <p className="text-xs text-muted-foreground mt-3">
                First repository from your Configuration is selected by default. Change the order in Configuration to adjust.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
      </CardHeader>

      <CardContent>
        {selectedReposForThroughput.length > 0 ? (
          <ChartContainer config={throughputChartConfig}>
            <LineChart data={throughputPercentageData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
              <YAxis tickLine={false} axisLine={false} tickMargin={8}
                     tickFormatter={(value) => `${value.toFixed(1)}%`} />
              <ChartTooltip cursor={false} content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const monthTotal = payload[0].payload._monthTotal;
                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <div className="font-medium">{payload[0].payload.month}</div>
                        {payload.map((entry: any) => {
                          const count = payload[0].payload[`_${entry.dataKey}_count`];
                          return (
                            <div key={entry.dataKey} className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                              <span className="text-muted-foreground">{entry.name}:</span>
                              <span className="font-medium">{count}/{monthTotal} ({entry.value.toFixed(1)}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                return null;
              }} />
              <ChartLegend content={<ChartLegendContent />} />
              {selectedReposForThroughput.map((repoId) => {
                const safeKey = throughputSafeKeys[repoId];
                return (
                  <Line key={repoId} type="monotone" dataKey={safeKey}
                        stroke={`var(--color-${safeKey})`} strokeWidth={2} dot={false}
                        connectNulls={false} />
                );
              })}
            </LineChart>
          </ChartContainer>
        ) : (
          <p className="text-center text-muted-foreground py-8">
            Select at least one repository to view throughput data
          </p>
        )}
      </CardContent>
    </Card>
  );
}
