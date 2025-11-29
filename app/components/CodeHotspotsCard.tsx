'use client';

import { Fragment } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CartesianGrid, XAxis, YAxis, Bar, BarChart } from 'recharts';
import { ChartContainer, ChartTooltip } from '@/components/ui/chart';
import type { GitHubPR, Repository } from '@/lib/types/github';

interface CodeHotspotsCardProps {
  currentLevelData: Array<{name: string; count: number; type: 'file' | 'directory'}>;
  maxChangesAtRoot: number;
  selectedRepoForFiles: string;
  currentPath: string[];
  selectedFile: string | null;
  prsForSelectedFile: GitHubPR[];
  repositoriesWithData: Repository[];
  onRepoChange: (repo: string) => void;
  onNavigate: (path: string[]) => void;
  onFileSelect: (file: string | null) => void;
}

export function CodeHotspotsCard({
  currentLevelData,
  maxChangesAtRoot,
  selectedRepoForFiles,
  currentPath,
  selectedFile,
  prsForSelectedFile,
  repositoriesWithData,
  onRepoChange,
  onNavigate,
  onFileSelect,
}: CodeHotspotsCardProps) {
  if (currentLevelData.length === 0) return null;

  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">Code hotspots</CardTitle>
        <CardDescription>
          Locations that show up the most in bugfix PRs (generated using <Badge variant="secondary" className="ml-1">1</Badge>)
        </CardDescription>

        <div className="pt-4">
          <Label htmlFor="file-repo-select" className="text-sm font-medium mb-2 block">
            Select Repository
          </Label>
          <Select
            value={selectedRepoForFiles}
            onValueChange={(value) => {
              onRepoChange(value);
              onNavigate([]);
              onFileSelect(null);
            }}
          >
            <SelectTrigger id="file-repo-select" className="w-full max-w-md">
              <SelectValue placeholder="Select a repository" />
            </SelectTrigger>
            <SelectContent>
              {repositoriesWithData.map((repo) => (
                <SelectItem key={repo.id} value={repo.id}>
                  {repo.id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {currentPath.length > 0 && (
          <div className="pt-4">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate([]);
                    }}
                  >
                    Root
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {currentPath.map((segment, index) => (
                  <Fragment key={index}>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                      {index === currentPath.length - 1 ? (
                        <BreadcrumbPage>{segment}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            onNavigate(currentPath.slice(0, index + 1));
                          }}
                        >
                          {segment}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={{
            count: {
              label: "Changes",
              color: "hsl(var(--chart-1))",
            },
          }}
          className="h-[500px] w-full"
        >
          <BarChart
            data={currentLevelData}
            layout="vertical"
            margin={{
              left: 12,
              right: 20,
              top: 5,
              bottom: 5
            }}
          >
            <CartesianGrid horizontal={false} />
            <XAxis type="number" domain={[0, maxChangesAtRoot]} />
            <YAxis
              dataKey="name"
              type="category"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={Math.max(...currentLevelData.map(d => d.name.length)) * 7 + 20}
            />
            <ChartTooltip
              cursor={false}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;

                  return (
                    <div className="rounded-lg border bg-background p-2 shadow-sm">
                      <div className="grid gap-2">
                        <code className="text-sm">{data.name}</code>
                        <div className="text-sm text-muted-foreground">
                          {data.count} changes
                        </div>
                        {data.type === 'directory' && (
                          <div className="text-xs text-muted-foreground">
                            Click to drill down
                          </div>
                        )}
                        {data.type === 'file' && (
                          <div className="text-xs text-muted-foreground">
                            Click to see PRs
                          </div>
                        )}
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Bar
              dataKey="count"
              fill="var(--color-count)"
              radius={[0, 4, 4, 0]}
              onClick={(data: any) => {
                if (data.type === 'directory') {
                  onNavigate([...currentPath, data.name]);
                  onFileSelect(null);
                } else {
                  onFileSelect(data.name);
                }
              }}
              className="cursor-pointer"
            />
          </BarChart>
        </ChartContainer>

        {selectedFile && prsForSelectedFile.length > 0 && (
          <div className="mt-6">
            <div className="mb-3">
              <h3 className="text-sm font-semibold">
                Bugfix PRs that modify: {[...currentPath, selectedFile].join('/')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {prsForSelectedFile.length} {prsForSelectedFile.length === 1 ? 'PR' : 'PRs'} modified this file
              </p>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>PR #</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead className="text-right">Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {prsForSelectedFile.map((pr) => (
                  <TableRow key={pr.number}>
                    <TableCell>
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline font-mono"
                      >
                        #{pr.number}
                      </a>
                    </TableCell>
                    <TableCell className="max-w-md truncate">
                      <a
                        href={pr.html_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {pr.title}
                      </a>
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {new Date(pr.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
