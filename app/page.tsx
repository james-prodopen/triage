'use client';

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { ChartConfig } from '@/components/ui/chart';
import { Spinner } from '@/components/ui/spinner';
import { parseRepositories, parseAuthors } from '@/lib/utils/repository-parser';
import { CHART_COLORS } from '@/lib/utils/chart-helpers';
import { fetchPRsWithPagination } from '@/lib/api/github-fetcher';
import { fetchFilesForPRs } from '@/lib/api/pr-files-fetcher';
import type { Repository, GitHubPR, PRFilesMap, LoadingProgress } from '@/lib/types/github';
import { BugfixBreakdownCard } from './components/BugfixBreakdownCard';
import { ThroughputCard } from './components/ThroughputCard';
import { CodeHotspotsCard } from './components/CodeHotspotsCard';
import { ConfigurationCard } from './components/ConfigurationCard';

export default function Home() {
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
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);

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

    const config = {
      repositories: parsedRepos.map(r => r.id),
      authors: parsedAuthors,
      bugfixPRsQuery,
      totalPRsQuery,
    };

    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (response.ok) {
        toast.success('Configuration saved successfully!');
      } else {
        toast.error('Failed to save configuration');
      }
    } catch (error) {
      toast.error('Error saving configuration');
      console.error(error);
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

      // Open config if required fields are not set
      if (!config.repositories?.length || !config.bugfixPRsQuery || !config.totalPRsQuery) {
        setIsConfigOpen(true);
      }
    } catch (err) {
      // Config file doesn't exist yet, use defaults
    }
  };

  // Load config on mount
  useEffect(() => {
    loadConfigFromFile();
  }, []);

  const loadGithubPRs = async () => {
    if (!bugfixPRsQuery.trim() || repositories.length === 0) return;

    setGithubLoading(true);
    setBugfixPRs([]);
    setAllPRs([]);
    setPrFiles({});
    setCurrentPath([]);
    setLoadingProgress({ totalRepos: repositories.length, loadedRepos: 0, totalPRs: 0 });

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

          // Fetch total PRs with query 2
          const totalQueryWithAuthors = totalPRsQuery + authorFilter;
          const repoAllPRs = await fetchPRsWithPagination({
            owner,
            repo,
            repoId: id,
            query: totalQueryWithAuthors,
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

          // Update progress after each repo
          setLoadingProgress(prev => ({
            ...prev,
            loadedRepos: prev.loadedRepos + 1,
            totalPRs: prev.totalPRs + repoPRs.length
          }));

          return { filteredPRs: repoPRs, allPRs: repoAllPRs };
        } catch (err) {
          console.error(`Failed to load ${id}:`, err);
          return { filteredPRs: [], allPRs: [] };
        }
      });

      // Wait for all repos to complete
      const allRepoResults = await Promise.all(repoPromises);
      const bugfixPRsFromAllRepos = allRepoResults.flatMap(r => r.filteredPRs);
      const allPRsFromAllRepos = allRepoResults.flatMap(r => r.allPRs);

      setBugfixPRs(bugfixPRsFromAllRepos);
      setAllPRs(allPRsFromAllRepos);
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

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">Quality Triage</h1>

      <ConfigurationCard
        isOpen={isConfigOpen}
        onOpenChange={setIsConfigOpen}
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
        onSaveConfig={saveConfig}
        onRefresh={loadGithubPRs}
        isLoading={githubLoading}
      />

      <div className="mb-6">
        <Button
          onClick={loadGithubPRs}
          disabled={githubLoading || !repoInput.trim() || !bugfixPRsQuery.trim() || !totalPRsQuery.trim()}
          className="w-full"
        >
          {githubLoading ? 'Loading...' : 'Refresh'}
        </Button>
      </div>

      {githubLoading && loadingProgress.totalRepos > 0 && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Spinner />
          <span>Loading: {loadingProgress.loadedRepos}/{loadingProgress.totalRepos} repos</span>
        </div>
      )}

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
    </div>
  );
}
