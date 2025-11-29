'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldSet, FieldLabel, FieldDescription } from '@/components/ui/field';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronsUpDown } from 'lucide-react';
import { parseRepositories, parseAuthors } from '@/lib/utils/repository-parser';
import type { Repository } from '@/lib/types/github';

interface ConfigurationCardProps {
  // Collapsible state
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;

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
  onSaveConfig: () => void;
  onRefresh: () => void;

  // Loading state
  isLoading: boolean;
}

export function ConfigurationCard({
  isOpen,
  onOpenChange,
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
  onSaveConfig,
  onRefresh,
  isLoading,
}: ConfigurationCardProps) {
  return (
    <Collapsible open={isOpen} onOpenChange={onOpenChange} className="mb-6">
      <Card>
        <CardHeader>
          <CollapsibleTrigger className="flex items-center gap-2 w-full [&[data-state=open]>svg]:rotate-180">
            <CardTitle>Configuration</CardTitle>
            <ChevronsUpDown className="h-4 w-4 transition-transform" />
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent>
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

                <Button onClick={onSaveConfig} variant="outline" className="w-full">
                  Save Configuration
                </Button>
              </FieldGroup>
            </FieldSet>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
