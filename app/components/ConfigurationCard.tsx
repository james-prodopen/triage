'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldSet, FieldLabel, FieldDescription } from '@/components/ui/field';
import { parseRepositories, parseAuthors } from '@/lib/utils/repository-parser';
import type { Repository } from '@/lib/types/github';

interface ConfigurationCardProps {
  // Input values
  repoInput: string;
  authorInput: string;
  bugfixPRsQuery: string;
  totalPRsQuery: string;

  // Change handlers
  onRepoInputChange: (value: string) => void;
  onAuthorInputChange: (value: string) => void;
  onBugfixQueryChange: (value: string) => void;
  onTotalQueryChange: (value: string) => void;

  // Parsed state setters
  onRepositoriesChange: (repos: Repository[]) => void;
  onAuthorsChange: (authors: string[]) => void;

  // Action callbacks
  onRefresh: () => void;

  // Loading state
  isLoading: boolean;
}

export function ConfigurationCard({
  repoInput,
  authorInput,
  bugfixPRsQuery,
  totalPRsQuery,
  onRepoInputChange,
  onAuthorInputChange,
  onBugfixQueryChange,
  onTotalQueryChange,
  onRepositoriesChange,
  onAuthorsChange,
  onRefresh,
  isLoading,
}: ConfigurationCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
            <FieldSet>
              <FieldGroup>
                <Field>
                  <FieldLabel>Repositories your team contributes to</FieldLabel>
                  <textarea
                    value={repoInput}
                    onChange={(e) => onRepoInputChange(e.target.value)}
                    onBlur={() => {
                      const parsed = parseRepositories(repoInput);
                      onRepositoriesChange(parsed);
                    }}
                    placeholder="One per line or comma-separated&#10;e.g., owner1/repo1, owner2/repo2"
                    className="w-full px-3 py-2 border rounded-md min-h-[80px] font-mono text-sm"
                    required
                  />
                </Field>

                <Field>
                  <FieldLabel>GitHub usernames of your devs</FieldLabel>
                  <FieldDescription>Filter PRs down to only those authored by your team</FieldDescription>
                  <textarea
                    value={authorInput}
                    onChange={(e) => onAuthorInputChange(e.target.value)}
                    onBlur={() => {
                      const parsed = parseAuthors(authorInput);
                      onAuthorsChange(parsed);
                    }}
                    placeholder="One per line or comma-separated&#10;e.g., username1, username2; keep blank for all"
                    className="w-full px-3 py-2 border rounded-md min-h-[80px] font-mono text-sm"
                  />
                </Field>

                <Field>
                  <div className="flex items-center gap-2">
                    <FieldLabel>Filter query for bugfix PRs</FieldLabel>
                    <Badge variant="secondary">1</Badge>
                  </div>
                  <FieldDescription>
                    Customize for improved accuracy, use date to manage API limit of 1000 results
                  </FieldDescription>
                  <input
                    type="text"
                    value={bugfixPRsQuery}
                    onChange={(e) => onBugfixQueryChange(e.target.value)}
                    placeholder="e.g., is:pr fix in:title created:>2025-01-01 sort:created-desc"
                    className="w-full px-3 py-2 border rounded-md"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRefresh();
                      }
                    }}
                    required
                  />
                </Field>

                <Field>
                  <div className="flex items-center gap-2">
                    <FieldLabel>Filter query for all PRs authored by your team</FieldLabel>
                    <Badge variant="secondary">2</Badge>
                  </div>
                  <FieldDescription>
                    Make sure date lines up with above, also 1000 result API limit
                  </FieldDescription>
                  <input
                    type="text"
                    value={totalPRsQuery}
                    onChange={(e) => onTotalQueryChange(e.target.value)}
                    placeholder="e.g., is:pr created:>2025-01-01 sort:created-desc"
                    className="w-full px-3 py-2 border rounded-md"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRefresh();
                      }
                    }}
                    required
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
      </CardContent>
    </Card>
  );
}
