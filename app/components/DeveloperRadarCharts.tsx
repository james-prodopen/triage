'use client';

import { useMemo } from 'react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert';
import { Info } from 'lucide-react';
import { ReviewCommentStats } from '@/lib/types/github';

interface DeveloperRadarChartsProps {
  data: ReviewCommentStats[];
  isLoading: boolean;
  isAnonymized: boolean;
}

interface MetricRanges {
  commentsPerReview: { min: number; max: number };
  reviewsPerPR: { min: number; max: number };
  avgPRSize: { min: number; max: number };
  avgFilesChanged: { min: number; max: number };
}

interface DeveloperMetrics {
  commentsPerReview: number;
  reviewsPerPR: number;
  avgPRSize: number;
  avgFilesChanged: number;
}

function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  if (max === 0 && min === 0) return 0;
  return (value - min) / (max - min);
}

function calculateMetricRanges(data: ReviewCommentStats[]): {
  metrics: Map<string, DeveloperMetrics>;
  ranges: MetricRanges;
} {
  const metrics = new Map<string, DeveloperMetrics>();

  // Calculate raw metrics for each developer
  data.forEach((stat) => {
    const commentsPerReview =
      stat.reviewsReceived > 0
        ? stat.commentsReceived / stat.reviewsReceived
        : 0;
    const reviewsPerPR =
      stat.prsAuthored > 0 ? stat.reviewsReceived / stat.prsAuthored : 0;
    const avgPRSize = stat.averagePRSize;
    const avgFilesChanged = stat.averageFilesChanged;

    metrics.set(stat.author, {
      commentsPerReview,
      reviewsPerPR,
      avgPRSize,
      avgFilesChanged,
    });
  });

  // Find min/max for each metric across all developers
  // Always use 0 as minimum for radar chart axes
  const allMetrics = Array.from(metrics.values());

  const ranges: MetricRanges = {
    commentsPerReview: {
      min: 0,
      max: Math.max(...allMetrics.map((m) => m.commentsPerReview)),
    },
    reviewsPerPR: {
      min: 0,
      max: Math.max(...allMetrics.map((m) => m.reviewsPerPR)),
    },
    avgPRSize: {
      min: 0,
      max: Math.max(...allMetrics.map((m) => m.avgPRSize)),
    },
    avgFilesChanged: {
      min: 0,
      max: Math.max(...allMetrics.map((m) => m.avgFilesChanged)),
    },
  };

  return { metrics, ranges };
}

export function DeveloperRadarCharts({
  data,
  isLoading,
  isAnonymized,
}: DeveloperRadarChartsProps) {

  const { metrics, ranges } = useMemo(
    () => calculateMetricRanges(data),
    [data]
  );

  if (data.length === 0 && !isLoading) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Developer metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <CardTitle className="h-6 bg-muted animate-pulse rounded" />
              </CardHeader>
              <CardContent>
                <div className="h-[250px] bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const getDisplayName = (author: string, index: number): string => {
    return isAnonymized ? `dev${index + 1}` : author;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>PR summary, per developer</CardTitle>
        <CardDescription>
          Metrics are averages, normalized from 0 to the max value of that metric across these devs.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Alert>
          <Info />
          <AlertTitle>Interpreting this chart</AlertTitle>
          <AlertDescription>
            <ul className="list-disc list-inside mt-2">
              <li>Churn: Reviews per PR - higher suggests lower quality PRs requiring rework.</li>
              <li>Complexity: Comments per PR review - higher suggests greater complexity.</li>
              <li>Verbosity: LOC changed per PR - small PRs are easier to review, less likely to contain AI bloat.</li>
              <li>Sprawl: Files changed per PR - higher suggests riskier PRs; combine with verbosity.</li>
            </ul>
            <p className="font-semibold mt-2">Notes</p>
            <ul className="list-disc list-inside mt-2">
              <li>Includes the most recent 100 PRs authored by the dev in each repo.</li>
              <li>A maximum of 10 reviews are sampled for each PR.</li>
            </ul>
          </AlertDescription>
        </Alert>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 w-full">
          {data.map((stat, index) => {
            const devMetrics = metrics.get(stat.author);
            if (!devMetrics) return null;

            // Normalize metrics for display
            const chartData = [
              {
                metric: 'Complexity',
                value: normalize(
                  devMetrics.commentsPerReview,
                  ranges.commentsPerReview.min,
                  ranges.commentsPerReview.max
                ),
                actualValue: devMetrics.commentsPerReview.toFixed(1),
                description: 'comments per review',
              },
              {
                metric: 'Churn',
                value: normalize(
                  devMetrics.reviewsPerPR,
                  ranges.reviewsPerPR.min,
                  ranges.reviewsPerPR.max
                ),
                actualValue: devMetrics.reviewsPerPR.toFixed(1),
                description: 'reviews per PR',
              },
              {
                metric: 'Verbosity',
                value: normalize(
                  devMetrics.avgPRSize,
                  ranges.avgPRSize.min,
                  ranges.avgPRSize.max
                ),
                actualValue: devMetrics.avgPRSize.toString(),
                description: 'lines changed per PR',
              },
              {
                metric: 'Sprawl',
                value: normalize(
                  devMetrics.avgFilesChanged,
                  ranges.avgFilesChanged.min,
                  ranges.avgFilesChanged.max
                ),
                actualValue: devMetrics.avgFilesChanged.toString(),
                description: 'files changed per PR',
              },
            ];

            const chartConfig = {
              value: {
                label: 'Value',
                color: 'var(--chart-1)',
              },
            } satisfies ChartConfig;

            return (
              <div key={stat.author} className="min-w-0">
                <div className="text-center mb-2">
                  <h3 className="font-semibold">{getDisplayName(stat.author, index)}</h3>
                </div>
                <ChartContainer
                  config={chartConfig}
                  className="aspect-square"
                >
                  <RadarChart
                    data={chartData}
                    margin={{right: 25, left: 25}}
                  >
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideLabel
                          formatter={(_value, _name, props) => {
                            return (
                              <>
                                <div className="font-medium">
                                  {props.payload.metric}
                                </div>
                                <div className="text-muted-foreground">
                                  {props.payload.actualValue} {props.payload.description}
                                </div>
                              </>
                            );
                          }}
                        />
                      }
                    />
                    <PolarGrid
                      gridType="circle"
                      radialLines={true}
                      className="fill-(--color-value) opacity-20"
                    />
                    <PolarAngleAxis dataKey="metric" tick={{ fontSize: 12 }} />
                    <Radar
                      dataKey="value"
                      fill="var(--color-value)"
                      fillOpacity={0.6}
                      dot={{
                        r: 4,
                        fillOpacity: 1,
                      }}
                    />
                  </RadarChart>
                </ChartContainer>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
