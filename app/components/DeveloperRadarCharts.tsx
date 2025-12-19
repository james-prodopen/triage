'use client';

import { useMemo, useState } from 'react';
import { PolarAngleAxis, PolarGrid, Radar, RadarChart } from 'recharts';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';
import { Toggle } from '@/components/ui/toggle';
import { EyeOff } from 'lucide-react';
import { ReviewCommentStats } from '@/lib/types/github';

interface DeveloperRadarChartsProps {
  data: ReviewCommentStats[];
  isLoading: boolean;
}

interface MetricRanges {
  commentsPerReview: { min: number; max: number };
  reviewsPerPR: { min: number; max: number };
  avgPRSize: { min: number; max: number };
}

interface DeveloperMetrics {
  commentsPerReview: number;
  reviewsPerPR: number;
  avgPRSize: number;
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

    metrics.set(stat.author, {
      commentsPerReview,
      reviewsPerPR,
      avgPRSize,
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
  };

  return { metrics, ranges };
}

export function DeveloperRadarCharts({
  data,
  isLoading,
}: DeveloperRadarChartsProps) {
  const [anonymize, setAnonymize] = useState(false);

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
          <h2 className="text-xl font-semibold">Developer Metrics</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
    return anonymize ? `dev${index + 1}` : author;
  };

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Developer Metrics</h2>
        <Toggle
          pressed={anonymize}
          onPressedChange={setAnonymize}
          aria-label="Toggle anonymization"
          size="sm"
        >
          <EyeOff className="h-4 w-4 mr-2" />
          Anonymize
        </Toggle>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {data.map((stat, index) => {
          const devMetrics = metrics.get(stat.author);
          if (!devMetrics) return null;

          // Normalize metrics for display
          const chartData = [
            {
              metric: 'Comments per Review',
              value: normalize(
                devMetrics.commentsPerReview,
                ranges.commentsPerReview.min,
                ranges.commentsPerReview.max
              ),
              actualValue: devMetrics.commentsPerReview.toFixed(1),
            },
            {
              metric: 'Reviews per PR',
              value: normalize(
                devMetrics.reviewsPerPR,
                ranges.reviewsPerPR.min,
                ranges.reviewsPerPR.max
              ),
              actualValue: devMetrics.reviewsPerPR.toFixed(1),
            },
            {
              metric: 'Average PR Size',
              value: normalize(
                devMetrics.avgPRSize,
                ranges.avgPRSize.min,
                ranges.avgPRSize.max
              ),
              actualValue: devMetrics.avgPRSize.toString(),
            },
          ];

          const chartConfig = {
            value: {
              label: 'Value',
              color: 'var(--chart-1)',
            },
          } satisfies ChartConfig;

          return (
            <Card key={stat.author}>
              <CardHeader className="items-center pb-4">
                <CardTitle>{getDisplayName(stat.author, index)}</CardTitle>
              </CardHeader>
              <CardContent className="pb-0">
                <ChartContainer
                  config={chartConfig}
                  className="mx-auto aspect-square max-h-[350px]"
                >
                  <RadarChart data={chartData} margin={{ top: 30, right: 40, bottom: 20, left: 40 }}>
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
                                  {props.payload.actualValue}
                                </div>
                              </>
                            );
                          }}
                        />
                      }
                    />
                    <PolarGrid gridType="circle" radialLines={true} />
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
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
