'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Toggle } from '@/components/ui/toggle';
import { Eye, EyeOff, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { ReviewCommentStats } from '@/lib/types/github';

interface ReviewCommentsCardProps {
  data: ReviewCommentStats[];
  isLoading: boolean;
}

type SortField = keyof ReviewCommentStats;
type SortDirection = 'asc' | 'desc';

export function ReviewCommentsCard({ data, isLoading }: ReviewCommentsCardProps) {
  const [sortField, setSortField] = useState<SortField>('author');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isAnonymized, setIsAnonymized] = useState<boolean>(false);

  // Create placeholder mapping for dev names
  const devPlaceholders = useMemo(() => {
    const mapping = new Map<string, string>();
    data.forEach((stat, index) => {
      mapping.set(stat.author, `dev${index + 1}`);
    });
    return mapping;
  }, [data]);

  // Sort data
  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return sorted;
  }, [data, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="ml-1 h-3 w-3 inline opacity-50" />;
    }
    return sortDirection === 'asc' ? (
      <ArrowUp className="ml-1 h-3 w-3 inline" />
    ) : (
      <ArrowDown className="ml-1 h-3 w-3 inline" />
    );
  };

  const getDisplayName = (author: string) => {
    return isAnonymized ? devPlaceholders.get(author) || author : author;
  };

  if (data.length === 0 && !isLoading) {
    return null;
  }

  const totals = data.reduce(
    (acc, stat) => ({
      reviewsReceived: acc.reviewsReceived + stat.reviewsReceived,
      commentsReceived: acc.commentsReceived + stat.commentsReceived,
      prsAuthored: acc.prsAuthored + stat.prsAuthored,
      totalChanges: acc.totalChanges + (stat.averagePRSize * stat.prsAuthored),
      prSizeScoreSum: acc.prSizeScoreSum + stat.prSizeScore,
    }),
    { reviewsReceived: 0, commentsReceived: 0, prsAuthored: 0, totalChanges: 0, prSizeScoreSum: 0 }
  );

  const averagePRSize = totals.prsAuthored > 0 ? Math.round(totals.totalChanges / totals.prsAuthored) : 0;
  const averagePRSizeScore = data.length > 0 ? totals.prSizeScoreSum / data.length : 0;

  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Review comments by developer</CardTitle>
            <CardDescription>
              Review comments received on PRs authored by each developer
            </CardDescription>
          </div>
          <Toggle
            pressed={isAnonymized}
            onPressedChange={setIsAnonymized}
            aria-label="Toggle anonymization"
            size="sm"
          >
            {isAnonymized ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            <span className="ml-2 text-sm">{isAnonymized ? 'Anonymized' : 'Show Names'}</span>
          </Toggle>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">
            Loading review comment data...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('author')}
                >
                  Developer {getSortIcon('author')}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('reviewsReceived')}
                >
                  Reviews {getSortIcon('reviewsReceived')}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('commentsReceived')}
                >
                  Review Comments {getSortIcon('commentsReceived')}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('prsAuthored')}
                >
                  PRs Authored {getSortIcon('prsAuthored')}
                </TableHead>
                <TableHead className="text-right">
                  Reviews / PR
                </TableHead>
                <TableHead className="text-right">
                  Comments / PR
                </TableHead>
                <TableHead className="text-right">
                  Comments / Review
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('totalChanges')}
                >
                  Total Changes {getSortIcon('totalChanges')}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('averagePRSize')}
                >
                  Avg PR Size {getSortIcon('averagePRSize')}
                </TableHead>
                <TableHead
                  className="text-right cursor-pointer hover:bg-muted/50"
                  onClick={() => handleSort('prSizeScore')}
                >
                  PR Size Score {getSortIcon('prSizeScore')}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map((stat) => {
                const reviewsPerPR = stat.prsAuthored > 0
                  ? (stat.reviewsReceived / stat.prsAuthored).toFixed(1)
                  : '0.0';
                const commentsPerPR = stat.prsAuthored > 0
                  ? (stat.commentsReceived / stat.prsAuthored).toFixed(1)
                  : '0.0';
                const commentsPerReview = stat.reviewsReceived > 0
                  ? (stat.commentsReceived / stat.reviewsReceived).toFixed(1)
                  : '0.0';
                return (
                  <TableRow key={stat.author}>
                    <TableCell className="font-medium">{getDisplayName(stat.author)}</TableCell>
                    <TableCell className="text-right">{stat.reviewsReceived}</TableCell>
                    <TableCell className="text-right">{stat.commentsReceived}</TableCell>
                    <TableCell className="text-right">{stat.prsAuthored}</TableCell>
                    <TableCell className="text-right">{reviewsPerPR}</TableCell>
                    <TableCell className="text-right">{commentsPerPR}</TableCell>
                    <TableCell className="text-right">{commentsPerReview}</TableCell>
                    <TableCell className="text-right">{stat.totalChanges.toLocaleString()}</TableCell>
                    <TableCell className="text-right">{stat.averagePRSize}</TableCell>
                    <TableCell className="text-right">{stat.prSizeScore.toFixed(2)}</TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-medium bg-muted/50">
                <TableCell>Total</TableCell>
                <TableCell className="text-right">{totals.reviewsReceived}</TableCell>
                <TableCell className="text-right">{totals.commentsReceived}</TableCell>
                <TableCell className="text-right">{totals.prsAuthored}</TableCell>
                <TableCell className="text-right">
                  {totals.prsAuthored > 0 ? (totals.reviewsReceived / totals.prsAuthored).toFixed(1) : '0.0'}
                </TableCell>
                <TableCell className="text-right">
                  {totals.prsAuthored > 0 ? (totals.commentsReceived / totals.prsAuthored).toFixed(1) : '0.0'}
                </TableCell>
                <TableCell className="text-right">
                  {totals.reviewsReceived > 0 ? (totals.commentsReceived / totals.reviewsReceived).toFixed(1) : '0.0'}
                </TableCell>
                <TableCell className="text-right">{totals.totalChanges.toLocaleString()}</TableCell>
                <TableCell className="text-right">{averagePRSize}</TableCell>
                <TableCell className="text-right">{averagePRSizeScore.toFixed(2)}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
