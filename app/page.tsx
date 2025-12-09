'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChartConfig } from '@/components/ui/chart';
import { Spinner } from '@/components/ui/spinner';
import { parseRepositories, parseAuthors } from '@/lib/utils/repository-parser';
import { CHART_COLORS, createSafeChartKey } from '@/lib/utils/chart-helpers';
import { calculateTeamBalanceScore, calculateNormalizedEntropy } from '@/lib/utils/stats';
import { fetchPRsWithPagination } from '@/lib/api/github-fetcher';
import { fetchFilesForPRs } from '@/lib/api/pr-files-fetcher';
import type { Repository, GitHubPR, PRFilesMap, LoadingProgress } from '@/lib/types/github';
import { BugfixBreakdownCard } from './components/BugfixBreakdownCard';
import { ThroughputCard } from './components/ThroughputCard';
import { CodeHotspotsCard } from './components/CodeHotspotsCard';
import { ConfigurationCard } from './components/ConfigurationCard';
import { PRInvolvementCard } from './components/PRInvolvementCard';
import { AppSidebar } from './components/AppSidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from '@/components/ui/empty';

type Section = 'configuration' | 'code-health' | 'team-health';

export default function Home() {
  // Active section state
  const [activeSection, setActiveSection] = useState<Section>('configuration');

  // Track last saved timestamp
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // GitHub PR state
  const [bugfixPRs, setBugfixPRs] = useState<GitHubPR[]>([]);
  const [allPRs, setAllPRs] = useState<GitHubPR[]>([]); // All PRs for denominator
  const [bugfixPRsQuery, setBugfixPRsQuery] = useState<string>('');
  const [totalPRsQuery, setTotalPRsQuery] = useState<string>('');
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoInput, setRepoInput] = useState<string>('');
  const [authorInput, setAuthorInput] = useState<string>('');
  const [selectedAuthors, setSelectedAuthors] = useState<string[]>([]);
  const [githubLoading, setGithubLoading] = useState<boolean>(false);
  const [githubTotalCount, setGithubTotalCount] = useState<number>(0);
  const [prFiles, setPrFiles] = useState<PRFilesMap>({});
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [selectedRepoForFiles, setSelectedRepoForFiles] = useState<string>('');
  const [selectedReposForThroughput, setSelectedReposForThroughput] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    totalRepos: 0,
    loadedRepos: 0,
    totalPRs: 0
  });
  const [prInvolvement, setPrInvolvement] = useState<Map<string, Set<string>>>(new Map());

  // Save configuration to file
  const saveConfig = async () => {
    // Parse current input values to ensure we save the latest
    const parsedRepos = parseRepositories(repoInput);
    const parsedAuthors = parseAuthors(authorInput);

    // Update state with parsed values
    if (parsedRepos.length > 0) {
      setRepositories(parsedRepos);
    }
    if (parsedAuthors.length > 0) {
      setSelectedAuthors(parsedAuthors);
    }

    const savedAt = new Date().toISOString();
    const config = {
      repositories: parsedRepos.map(r => r.id),
      authors: parsedAuthors,
      bugfixPRsQuery,
      totalPRsQuery,
      savedAt: savedAt,
    };

    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      // Update last saved timestamp
      setLastSavedAt(savedAt);
      // Silent auto-save - no toast notification
    } catch (error) {
      console.error('Failed to auto-save configuration:', error);
      // Only show error on failure
      toast.error('Failed to save configuration');
    }
  };

  // Load configuration from file
  const loadConfigFromFile = async () => {
    try {
      const response = await fetch('/api/config');
      if (!response.ok) return;

      const config = await response.json();

      // Set repositories
      if (config.repositories) {
        const parsed = parseRepositories(config.repositories.join('\n'));
        setRepositories(parsed);
        setRepoInput(config.repositories.join('\n'));
      }

      // Set authors
      if (config.authors) {
        setSelectedAuthors(config.authors);
        setAuthorInput(config.authors.join('\n'));
      }

      // Set queries
      if (config.bugfixPRsQuery) setBugfixPRsQuery(config.bugfixPRsQuery);
      if (config.totalPRsQuery) setTotalPRsQuery(config.totalPRsQuery);

      // Set last saved timestamp
      if (config.savedAt) setLastSavedAt(config.savedAt);

      // Switch to configuration section if required fields are not set
      if (!config.repositories?.length || !config.bugfixPRsQuery || !config.totalPRsQuery) {
        setActiveSection('configuration');
      }
    } catch (err) {
      // Config file doesn't exist yet, use defaults
    }
  };

  // Load config on mount
  useEffect(() => {
    loadConfigFromFile();
  }, []);

  // Auto-save configuration after debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      saveConfig();
    }, 500); // 500ms debounce

    return () => clearTimeout(timer);
  }, [repoInput, authorInput, bugfixPRsQuery, totalPRsQuery]);

  // Parameterized query for involves:
  const buildInvolvesQuery = (author: string) => `${totalPRsQuery} involves:${author}`;

  const loadGithubPRs = async () => {
    if (!bugfixPRsQuery.trim() || !totalPRsQuery.trim() || repositories.length === 0) return;

    setGithubLoading(true);
    setBugfixPRs([]);
    setAllPRs([]);
    setPrFiles({});
    setCurrentPath([]);
    setLoadingProgress({ totalRepos: repositories.length, loadedRepos: 0, totalPRs: 0 });
    setPrInvolvement(new Map());

    try {
      // Build author filter query string
      const authorFilter = selectedAuthors.length > 0
        ? ' ' + selectedAuthors.map(author => `author:${author}`).join(' ')
        : '';

      // Fetch PRs matching query AND all closed PRs in parallel for each repo
      const repoPromises = repositories.map(async ({ owner, repo, id }) => {
        try {
          // Fetch bugfix PRs with query 1
          const queryWithAuthors = bugfixPRsQuery + authorFilter;
          const repoPRs = await fetchPRsWithPagination({
            owner,
            repo,
            repoId: id,
            query: queryWithAuthors,
            onWarning: (message, description) => {
              const isBugfixQuery = message.includes('bugfix');
              const queryBadge = isBugfixQuery ? '1' : '2';
              const toastType = message.includes('exceeds') ? 'warning' : 'info';

              if (toastType === 'warning') {
                toast.warning(
                  <div>{message} for query <Badge variant="secondary" className="ml-1">{queryBadge}</Badge></div>,
                  { description, duration: 10000 }
                );
              } else {
                toast.info(
                  <div>{message} for query <Badge variant="secondary" className="ml-1">{queryBadge}</Badge></div>,
                  { description, duration: 8000 }
                );
              }
            }
          });

          // Fetch total PRs with query 2 - PER AUTHOR with involves:
          const repoAllPRsMap = new Map<string, GitHubPR>();
          const repoInvolvementMap = new Map<string, Set<string>>();

          if (selectedAuthors.length === 0) {
            // No authors: fetch all PRs without filter
            const prs = await fetchPRsWithPagination({
              owner,
              repo,
              repoId: id,
              query: totalPRsQuery,
              onWarning: (message, description) => {
                const toastType = message.includes('exceeds') ? 'warning' : 'info';

                if (toastType === 'warning') {
                  toast.warning(
                    <div>{message} for query <Badge variant="secondary" className="ml-1">2</Badge></div>,
                    { description, duration: 10000 }
                  );
                } else {
                  toast.info(
                    <div>{message} for query <Badge variant="secondary" className="ml-1">2</Badge></div>,
                    { description, duration: 8000 }
                  );
                }
              }
            });

            prs.forEach(pr => {
              const key = `${pr.repoId}#${pr.number}`;
              repoAllPRsMap.set(key, pr);
            });
          } else {
            // With authors: fetch per author with involves:
            for (const author of selectedAuthors) {
              const authorPRs = await fetchPRsWithPagination({
                owner,
                repo,
                repoId: id,
                query: buildInvolvesQuery(author),
                onWarning: (message, description) => {
                  const toastType = message.includes('exceeds') ? 'warning' : 'info';

                  if (toastType === 'warning') {
                    toast.warning(
                      <div>{message} for query <Badge variant="secondary" className="ml-1">2</Badge></div>,
                      { description, duration: 10000 }
                    );
                  } else {
                    toast.info(
                      <div>{message} for query <Badge variant="secondary" className="ml-1">2</Badge></div>,
                      { description, duration: 8000 }
                    );
                  }
                }
              });

              authorPRs.forEach(pr => {
                const key = `${pr.repoId}#${pr.number}`;
                repoAllPRsMap.set(key, pr); // Dedupe

                if (!repoInvolvementMap.has(key)) {
                  repoInvolvementMap.set(key, new Set());
                }
                repoInvolvementMap.get(key)!.add(author);
              });
            }
          }

          const repoAllPRs = Array.from(repoAllPRsMap.values());

          // Update progress after each repo
          setLoadingProgress(prev => ({
            ...prev,
            loadedRepos: prev.loadedRepos + 1,
            totalPRs: prev.totalPRs + repoPRs.length
          }));

          return { filteredPRs: repoPRs, allPRs: repoAllPRs, involvement: repoInvolvementMap };
        } catch (err) {
          console.error(`Failed to load ${id}:`, err);
          return { filteredPRs: [], allPRs: [], involvement: new Map() };
        }
      });

      // Wait for all repos to complete
      const allRepoResults = await Promise.all(repoPromises);
      const bugfixPRsFromAllRepos = allRepoResults.flatMap(r => r.filteredPRs);
      const allPRsFromAllRepos = allRepoResults.flatMap(r => r.allPRs);

      // Merge involvement maps from all repos
      const globalInvolvementMap = new Map<string, Set<string>>();
      allRepoResults.forEach(result => {
        result.involvement.forEach((authors, key) => {
          if (!globalInvolvementMap.has(key)) {
            globalInvolvementMap.set(key, new Set());
          }
          authors.forEach((author: string) => globalInvolvementMap.get(key)!.add(author));
        });
      });

      setBugfixPRs(bugfixPRsFromAllRepos);
      setAllPRs(allPRsFromAllRepos);
      setPrInvolvement(globalInvolvementMap);
      setGithubTotalCount(bugfixPRsFromAllRepos.length);

      // Initialize selected repo for files if not set
      if (!selectedRepoForFiles && repositories.length > 0) {
        setSelectedRepoForFiles(repositories[0].id);
      }
      // Always reset throughput chart to first repo from configuration
      if (repositories.length > 0) {
        setSelectedReposForThroughput([repositories[0].id]);
      }

      // Load files for all PRs
      if (bugfixPRsFromAllRepos.length > 0) {
        const filesMap = await fetchFilesForPRs(bugfixPRsFromAllRepos);
        setPrFiles(filesMap);
      }
    } catch (err) {
      console.error('Failed to load GitHub PRs:', err);
      toast.error(`Failed to load GitHub PRs: ${err}`);
    } finally {
      setGithubLoading(false);
    }
  };

  // Analyze file frequency for SELECTED REPO ONLY at current path level
  const currentLevelData = useMemo(() => {
    if (Object.keys(prFiles).length === 0 || !selectedRepoForFiles) return [];

    const frequencyMap: Record<string, number> = {};
    const typeMap: Record<string, 'directory' | 'file'> = {};

    // Filter to selected repo only
    const prMap = new Map(
      bugfixPRs
        .filter(pr => pr.repoId === selectedRepoForFiles)
        .map(pr => [`${pr.repoId}#${pr.number}`, pr])
    );

    Object.entries(prFiles).forEach(([compositeKey, files]) => {
      const pr = prMap.get(compositeKey);
      if (!pr) return;

      files.forEach((f: any) => {
        // NO repo prefix - single repo mode
        const filename = f.filename;
        const pathParts = filename.split('/');

        // Check if within current path
        let isInCurrentPath = true;
        if (currentPath.length > 0) {
          for (let i = 0; i < currentPath.length; i++) {
            if (pathParts[i] !== currentPath[i]) {
              isInCurrentPath = false;
              break;
            }
          }
        }

        if (!isInCurrentPath) return;

        let item: string;
        let type: 'directory' | 'file';

        if (pathParts.length > currentPath.length + 1) {
          item = pathParts[currentPath.length];
          type = 'directory';
        } else if (pathParts.length === currentPath.length + 1) {
          item = pathParts[currentPath.length];
          type = 'file';
        } else {
          return;
        }

        frequencyMap[item] = (frequencyMap[item] || 0) + 1;
        typeMap[item] = type;
      });
    });

    return Object.entries(frequencyMap)
      .map(([name, count]) => ({
        name,
        count,
        type: typeMap[name],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [prFiles, bugfixPRs, currentPath, selectedRepoForFiles]);

  // Calculate max changes at root level for fixed X axis
  const maxChangesAtRoot = useMemo(() => {
    if (Object.keys(prFiles).length === 0 || !selectedRepoForFiles) return 0;

    const frequencyMap: Record<string, number> = {};

    const prMap = new Map(
      bugfixPRs
        .filter(pr => pr.repoId === selectedRepoForFiles)
        .map(pr => [`${pr.repoId}#${pr.number}`, pr])
    );

    Object.entries(prFiles).forEach(([compositeKey, files]) => {
      const pr = prMap.get(compositeKey);
      if (!pr) return;

      files.forEach((f: any) => {
        const filename = f.filename;
        const pathParts = filename.split('/');

        // Get root level item (first part of path)
        const item = pathParts[0];
        frequencyMap[item] = (frequencyMap[item] || 0) + 1;
      });
    });

    return Math.max(...Object.values(frequencyMap), 0);
  }, [prFiles, bugfixPRs, selectedRepoForFiles]);

  // Filter to only repositories that have loaded data
  const repositoriesWithData = useMemo(() => {
    if (bugfixPRs.length === 0 && allPRs.length === 0) {
      return [];
    }

    const repoIdsWithData = new Set([
      ...bugfixPRs.map(pr => pr.repoId),
      ...allPRs.map(pr => pr.repoId),
    ]);

    return repositories.filter(repo => repoIdsWithData.has(repo.id));
  }, [repositories, bugfixPRs, allPRs]);

  // Create safe keys for throughput chart (must be before throughputPercentageData)
  const throughputSafeKeys = useMemo(() => {
    const keys: Record<string, string> = {};
    const usedNames: Record<string, number> = {};

    repositoriesWithData.forEach((repo) => {
      // Use just the repo name for chart labels, but add a suffix if duplicate
      let safeKey = repo.repo;
      if (usedNames[repo.repo] !== undefined) {
        usedNames[repo.repo]++;
        safeKey = `${repo.repo}-${usedNames[repo.repo]}`;
      } else {
        usedNames[repo.repo] = 0;
      }
      keys[repo.id] = safeKey;
    });
    return keys;
  }, [repositoriesWithData]);

  // Calculate monthly throughput percentage per repo
  const throughputPercentageData = useMemo(() => {
    if (bugfixPRs.length === 0 || allPRs.length === 0 || Object.keys(throughputSafeKeys).length === 0) return [];

    // Numerator: Bugfix PRs per repo per month
    const monthlyFilteredMap: Record<string, Record<string, number>> = {};
    bugfixPRs.forEach((pr) => {
      const date = new Date(pr.created_at);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyFilteredMap[yearMonth]) monthlyFilteredMap[yearMonth] = {};
      monthlyFilteredMap[yearMonth][pr.repoId] = (monthlyFilteredMap[yearMonth][pr.repoId] || 0) + 1;
    });

    // Denominator: ALL PRs across all repos per month
    const monthlyTotalMap: Record<string, number> = {};
    allPRs.forEach((pr) => {
      const date = new Date(pr.created_at);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      monthlyTotalMap[yearMonth] = (monthlyTotalMap[yearMonth] || 0) + 1;
    });

    // Get all months where there are closed PRs
    const allMonths = Object.keys(monthlyTotalMap).sort();

    return allMonths
      .map((month) => {
        const total = monthlyTotalMap[month] || 0;
        if (total === 0) return null;

        const dataPoint: any = { month, _monthTotal: total };
        const filteredCounts = monthlyFilteredMap[month] || {};

        // Only add repos that have bugfix PRs in this month
        Object.keys(filteredCounts).forEach(repoId => {
          const count = filteredCounts[repoId];
          const safeKey = throughputSafeKeys[repoId];
          const percentage = (count / total) * 100;
          dataPoint[safeKey] = percentage;
          dataPoint[`_${safeKey}_count`] = count; // Store the count for tooltip
        });

        return dataPoint;
      })
      .filter((d): d is any => d !== null);
  }, [bugfixPRs, allPRs, throughputSafeKeys]);

  const throughputChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    repositoriesWithData.forEach((repo, index) => {
      const safeKey = throughputSafeKeys[repo.id];
      config[safeKey] = {
        label: safeKey,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });
    return config;
  }, [repositoriesWithData, throughputSafeKeys]);

  // Calculate daily open PR counts for "PR Involvement" chart
  const prInvolvementData = useMemo(() => {
    if (allPRs.length === 0) return [];

    // Extract date range from all PRs (both creation and closing dates)
    const allDates = allPRs.flatMap(pr => {
      const dates = [new Date(pr.created_at).getTime()];
      if (pr.closed_at) {
        dates.push(new Date(pr.closed_at).getTime());
      }
      return dates;
    });
    const minDate = new Date(Math.min(...allDates));
    // Get min date at midnight local time
    const minDateLocal = new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate());

    // Get today at midnight local time
    const now = new Date();
    const todayLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Fall back to total count when no authors selected (legacy behavior)
    if (selectedAuthors.length === 0) {
      const dateMap: Record<string, number> = {};

      // Iterate through each day in the range (up to and including today)
      for (let currentDate = new Date(minDateLocal); currentDate <= todayLocal; currentDate.setDate(currentDate.getDate() + 1)) {
        // Format as YYYY-MM-DD in local time
        const year = currentDate.getFullYear();
        const month = String(currentDate.getMonth() + 1).padStart(2, '0');
        const day = String(currentDate.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;

        const dayEnd = new Date(dateStr + 'T23:59:59.999');

        const openCount = allPRs.filter(pr => {
          const createdAt = new Date(pr.created_at);
          const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;

          const wasCreated = createdAt < dayEnd;
          const stillOpen = !closedAt || closedAt > dayEnd;

          return wasCreated && stillOpen;
        }).length;

        dateMap[dateStr] = openCount;
      }

      return Object.entries(dateMap)
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, openCount]) => ({
          date,
          openCount
        }));
    }

    // Calculate per-author involvement over time
    const dataPoints: Array<any> = [];

    // Iterate through each day
    for (let currentDate = new Date(minDateLocal); currentDate <= todayLocal; currentDate.setDate(currentDate.getDate() + 1)) {
      const year = currentDate.getFullYear();
      const month = String(currentDate.getMonth() + 1).padStart(2, '0');
      const day = String(currentDate.getDate()).padStart(2, '0');
      const dateStr = `${year}-${month}-${day}`;
      const dayEnd = new Date(dateStr + 'T23:59:59.999');

      const dataPoint: any = { date: dateStr };

      // Count per author
      const authorCounts: number[] = [];
      selectedAuthors.forEach(author => {
        const count = allPRs.filter(pr => {
          const prKey = `${pr.repoId}#${pr.number}`;
          const isInvolved = prInvolvement.get(prKey)?.has(author) ?? false;

          if (!isInvolved) return false;

          const createdAt = new Date(pr.created_at);
          const closedAt = pr.closed_at ? new Date(pr.closed_at) : null;
          const wasCreated = createdAt < dayEnd;
          const stillOpen = !closedAt || closedAt > dayEnd;

          return wasCreated && stillOpen;
        }).length;

        const safeKey = createSafeChartKey(author);
        dataPoint[safeKey] = count;

        // Only include in balance calculation if author has PRs on this day
        if (count > 0) {
          authorCounts.push(count);
        }
      });

      // Calculate team balance score with only authors who have PRs today
      dataPoint.teamBalance = calculateTeamBalanceScore(authorCounts);
      dataPoint.teamEntropy = calculateNormalizedEntropy(authorCounts);

      dataPoints.push(dataPoint);
    }

    return dataPoints;
  }, [allPRs, prInvolvement, selectedAuthors]);

  // Calculate per-repo PR breakdown
  const repoBreakdown = useMemo(() => {
    const breakdown: Array<{
      repoId: string;
      bugfixCount: number;
      totalCount: number;
      percentage: number;
    }> = [];

    repositoriesWithData.forEach((repo) => {
      const bugfixCount = bugfixPRs.filter(pr => pr.repoId === repo.id).length;
      const totalCount = allPRs.filter(pr => pr.repoId === repo.id).length;
      const percentage = totalCount > 0 ? (bugfixCount / totalCount) * 100 : 0;

      breakdown.push({
        repoId: repo.id,
        bugfixCount,
        totalCount,
        percentage,
      });
    });

    return breakdown;
  }, [repositoriesWithData, bugfixPRs, allPRs]);

  // Get PRs that modified the selected file
  const prsForSelectedFile = useMemo(() => {
    if (!selectedFile || !selectedRepoForFiles) return [];

    const fullFilePath = [...currentPath, selectedFile].join('/');

    return bugfixPRs
      .filter(pr => pr.repoId === selectedRepoForFiles)
      .filter(pr => {
        const compositeKey = `${pr.repoId}#${pr.number}`;
        const files = prFiles[compositeKey] || [];
        return files.some(file => file.filename === fullFilePath);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [selectedFile, selectedRepoForFiles, currentPath, bugfixPRs, prFiles]);

  // Check if configuration is complete
  const isConfigurationComplete = repositories.length > 0 && bugfixPRsQuery.trim().length > 0 && totalPRsQuery.trim().length > 0;

  return (
    <>
      <AppSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        onRefresh={loadGithubPRs}
        isLoading={githubLoading}
        isConfigurationComplete={isConfigurationComplete}
      />
      <SidebarInset>
        <main className="flex flex-1 flex-col gap-4 p-4">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold">
              {activeSection === 'configuration' && 'Configuration'}
              {activeSection === 'code-health' && 'Code health'}
              {activeSection === 'team-health' && 'Team health'}
            </h2>
            {activeSection === 'configuration' && lastSavedAt && (
              <p className="text-sm text-muted-foreground">
                Auto-saved at {new Date(lastSavedAt).toLocaleString()}
              </p>
            )}
            {activeSection === 'code-health' && (
              <p className="text-sm text-muted-foreground">
                Track code quality metrics and bugfix patterns
              </p>
            )}
            {activeSection === 'team-health' && null}
          </div>

          {githubLoading && loadingProgress.totalRepos > 0 && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner />
              <span>Loading: {loadingProgress.loadedRepos}/{loadingProgress.totalRepos} repos</span>
            </div>
          )}

          {activeSection === 'configuration' && (
            <ConfigurationCard
              repoInput={repoInput}
              authorInput={authorInput}
              bugfixPRsQuery={bugfixPRsQuery}
              totalPRsQuery={totalPRsQuery}
              onRepoInputChange={setRepoInput}
              onAuthorInputChange={setAuthorInput}
              onBugfixQueryChange={setBugfixPRsQuery}
              onTotalQueryChange={setTotalPRsQuery}
              onRepositoriesChange={setRepositories}
              onAuthorsChange={setSelectedAuthors}
              onRefresh={loadGithubPRs}
              isLoading={githubLoading}
            />
          )}

          {activeSection === 'code-health' && (
            <>
              {bugfixPRs.length === 0 && allPRs.length === 0 && !githubLoading ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {isConfigurationComplete ? 'No data loaded' : 'Configuration required'}
                    </EmptyTitle>
                    <EmptyDescription>
                      {isConfigurationComplete
                        ? 'Click the Refresh button in the sidebar to load your data.'
                        : 'Complete the configuration in the Configuration section, then click Refresh to load data.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <>
                  {!githubLoading && (
                    <BugfixBreakdownCard
                      repoBreakdown={repoBreakdown}
                      githubTotalCount={githubTotalCount}
                    />
                  )}

                  <ThroughputCard
                    throughputPercentageData={throughputPercentageData}
                    throughputChartConfig={throughputChartConfig}
                    throughputSafeKeys={throughputSafeKeys}
                    selectedReposForThroughput={selectedReposForThroughput}
                    repositoriesWithData={repositoriesWithData}
                    onRepoToggle={(repoId) => {
                      setSelectedReposForThroughput(prev =>
                        prev.includes(repoId)
                          ? prev.filter(id => id !== repoId)
                          : [...prev, repoId]
                      );
                    }}
                  />

                  <CodeHotspotsCard
                    currentLevelData={currentLevelData}
                    maxChangesAtRoot={maxChangesAtRoot}
                    selectedRepoForFiles={selectedRepoForFiles}
                    currentPath={currentPath}
                    selectedFile={selectedFile}
                    prsForSelectedFile={prsForSelectedFile}
                    repositoriesWithData={repositoriesWithData}
                    onRepoChange={setSelectedRepoForFiles}
                    onNavigate={setCurrentPath}
                    onFileSelect={setSelectedFile}
                  />
                </>
              )}
            </>
          )}

          {activeSection === 'team-health' && (
            <>
              {allPRs.length === 0 && !githubLoading ? (
                <Empty>
                  <EmptyHeader>
                    <EmptyTitle>
                      {isConfigurationComplete ? 'No data loaded' : 'Configuration required'}
                    </EmptyTitle>
                    <EmptyDescription>
                      {isConfigurationComplete
                        ? 'Click the Refresh button in the sidebar to load your data.'
                        : 'Complete the configuration in the Configuration section, then click Refresh to load data.'}
                    </EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
                <PRInvolvementCard
                  data={prInvolvementData}
                  devs={selectedAuthors}
                  query={buildInvolvesQuery('<username>')}
                />
              )}
            </>
          )}
        </main>
      </SidebarInset>
    </>
  );
}
