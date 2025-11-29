'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface BugfixBreakdownCardProps {
  repoBreakdown: Array<{
    repoId: string;
    bugfixCount: number;
    totalCount: number;
    percentage: number;
  }>;
  githubTotalCount: number;
}

export function BugfixBreakdownCard({ repoBreakdown, githubTotalCount }: BugfixBreakdownCardProps) {
  if (githubTotalCount === 0 || repoBreakdown.length === 0) return null;

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>Bugfix PR breakdown</CardTitle>
        <CardDescription>
          Bugfix PRs <Badge variant="secondary" className="ml-1">1</Badge> vs total PRs <Badge variant="secondary" className="ml-1">2</Badge> per repo
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Repository</TableHead>
              <TableHead className="text-right">Bugfix PRs <Badge variant="secondary" className="ml-1">1</Badge></TableHead>
              <TableHead className="text-right">Total PRs <Badge variant="secondary" className="ml-1">2</Badge></TableHead>
              <TableHead className="text-right">Percentage</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {repoBreakdown.map((repo) => (
              <TableRow key={repo.repoId}>
                <TableCell className="font-medium">{repo.repoId}</TableCell>
                <TableCell className="text-right">{repo.bugfixCount}</TableCell>
                <TableCell className="text-right">{repo.totalCount}</TableCell>
                <TableCell className="text-right">{repo.percentage.toFixed(1)}%</TableCell>
              </TableRow>
            ))}
            <TableRow className="font-medium">
              <TableCell>Total</TableCell>
              <TableCell className="text-right">
                {repoBreakdown.reduce((sum, r) => sum + r.bugfixCount, 0)}
              </TableCell>
              <TableCell className="text-right">
                {repoBreakdown.reduce((sum, r) => sum + r.totalCount, 0)}
              </TableCell>
              <TableCell className="text-right">
                {((repoBreakdown.reduce((sum, r) => sum + r.bugfixCount, 0) /
                   repoBreakdown.reduce((sum, r) => sum + r.totalCount, 0)) * 100).toFixed(1)}%
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
