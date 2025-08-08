'use client';
import { useState, useEffect, useRef, Fragment } from 'react';
import { testScenarios, TestScenario, TestCategory } from '@/lib/test-scenarios';
import Chat from '@/components/Chat';
import { buildSystemPrompt } from '@/lib/prompts';
import { TestRunRow } from '@/components/TestRunRow';

type TestResult = {
  scenarioId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  response?: string;
  toolCalls?: any[];
  score?: number;
  feedback?: string;
  executionTime?: number;
  error?: string;
  judging?: boolean;
};

const categoryColors: Record<TestCategory, string> = {
  information_retrieval: 'bg-blue-100 text-blue-800',
  multi_step: 'bg-purple-100 text-purple-800',
  meta: 'bg-gray-100 text-gray-800',
  prompt_injection: 'bg-red-100 text-red-800',
  toxicity: 'bg-orange-100 text-orange-800',
  pii: 'bg-yellow-100 text-yellow-800',
  scope: 'bg-green-100 text-green-800',
  jailbreak: 'bg-pink-100 text-pink-800'
};

const categoryNames: Record<TestCategory, string> = {
  information_retrieval: 'Info Retrieval',
  multi_step: 'Multi-step',
  meta: 'Meta',
  prompt_injection: 'Injection',
  toxicity: 'Toxicity',
  pii: 'PII',
  scope: 'Scope',
  jailbreak: 'Jailbreak'
};

export default function TestPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [selectedScenario, setSelectedScenario] = useState<TestScenario | null>(null);
  const [editingScenario, setEditingScenario] = useState<TestScenario | null>(null);
  const [runningAll, setRunningAll] = useState(false);
  const [filterCategory, setFilterCategory] = useState<TestCategory | 'all'>('all');
  const [scenarios, setScenarios] = useState<TestScenario[]>(testScenarios);
  const SCENARIOS_KEY = 'ca-agent-demo:tests:scenarios';
  const TESTS_PREFIX = 'ca-agent-demo:tests:';
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [runKeys, setRunKeys] = useState<Record<string, number>>({});
  const [configOpen, setConfigOpen] = useState(false);
  const [systemPrompt, setSystemPrompt] = useState<string>(buildSystemPrompt());
  const [toolSearchDesc, setToolSearchDesc] = useState<string>('Search for information using keywords.');
  const [toolReadDesc, setToolReadDesc] = useState<string>('Read content from documents with pagination.');
  const runStartTimesRef = useRef<Record<string, number>>({});
  const judgingStartTimesRef = useRef<Record<string, number>>({});
  const runResolversRef = useRef<Record<string, (value: void | PromiseLike<void>) => void>>({});
  const [editForm, setEditForm] = useState<{
    id: string;
    name: string;
    category: TestCategory;
    input: string;
    expectedBehavior: string;
    successCriteria: string;
    failureCriteria: string;
    isMultiTurn: boolean;
    previousMessagesText: string;
  } | null>(null);

  // Load custom scenarios from localStorage
  useEffect(() => {
    try {
      const stored = typeof window !== 'undefined' ? localStorage.getItem(SCENARIOS_KEY) : null;
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setScenarios(parsed as TestScenario[]);
        }
      }
    } catch (_) {
      // ignore
    }
  }, []);

  // Initialize results on first load and keep results keys in sync with scenarios
  useEffect(() => {
    setResults(prev => {
      // Initialize if empty
      const next: Record<string, TestResult> = { ...prev };
      scenarios.forEach(s => {
        if (!next[s.id]) next[s.id] = { scenarioId: s.id, status: 'pending' };
      });
      Object.keys(next).forEach(id => {
        if (!scenarios.find(s => s.id === id)) delete next[id];
      });
      return next;
    });
  }, [scenarios]);

  // Persist scenarios to localStorage
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(SCENARIOS_KEY, JSON.stringify(scenarios));
      }
    } catch (_) {
      // ignore
    }
  }, [scenarios]);

  // Populate edit form when opening editor
  useEffect(() => {
    if (!editingScenario) {
      setEditForm(null);
      return;
    }
    setEditForm({
      id: editingScenario.id,
      name: editingScenario.name,
      category: editingScenario.category,
      input: editingScenario.input,
      expectedBehavior: editingScenario.expectedBehavior,
      successCriteria: (editingScenario.successCriteria || []).join('\n'),
      failureCriteria: (editingScenario.failureCriteria || []).join('\n'),
      isMultiTurn: !!editingScenario.isMultiTurn,
      previousMessagesText: JSON.stringify(editingScenario.previousMessages || [], null, 2)
    });
  }, [editingScenario]);

  function handleSaveEdit() {
    if (!editForm) return;
    let parsedPrevious: { role: 'user' | 'assistant'; content: string }[] = [];
    try {
      parsedPrevious = JSON.parse(editForm.previousMessagesText || '[]');
      if (!Array.isArray(parsedPrevious)) throw new Error('prev not array');
      parsedPrevious = parsedPrevious.filter(
        (m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string'
      );
    } catch (_) {
      parsedPrevious = [];
    }
    const updated: TestScenario = {
      id: editForm.id.trim() || `custom_${Date.now()}`,
      name: editForm.name.trim() || 'Untitled',
      category: editForm.category,
      input: editForm.input,
      expectedBehavior: editForm.expectedBehavior,
      successCriteria: editForm.successCriteria
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      failureCriteria: editForm.failureCriteria
        .split('\n')
        .map(s => s.trim())
        .filter(Boolean),
      isMultiTurn: !!editForm.isMultiTurn,
      previousMessages: parsedPrevious
    };
    setScenarios(prev => {
      const existingIdx = prev.findIndex(s => s.id === updated.id);
      if (existingIdx >= 0) {
        const next = [...prev];
        next[existingIdx] = updated;
        return next;
      }
      return [...prev, updated];
    });
    setEditingScenario(null);
  }

  function handleDeleteScenario(id: string) {
    setScenarios(prev => prev.filter(s => s.id !== id));
    setEditingScenario(null);
  }

  function handleCancelEdit() {
    setEditingScenario(null);
  }

  function toggleRow(id: string) {
    setExpandedRows(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function runStreamingTest(scenario: TestScenario): Promise<void> {
    setExpandedRows(prev => ({ ...prev, [scenario.id]: true }));
    setResults(prev => ({ ...prev, [scenario.id]: { ...prev[scenario.id], status: 'running', judging: false } }));
    runStartTimesRef.current[scenario.id] = Date.now();
    const promise = new Promise<void>((resolve) => {
      runResolversRef.current[scenario.id] = resolve;
    });
    setRunKeys(prev => ({ ...prev, [scenario.id]: (prev[scenario.id] || 0) + 1 }));
    return promise;
  }

  async function handleStreamDone(scenario: TestScenario, payload: { content: string; toolCalls?: any[]; citations?: any[] }) {
    try {
      // mark as judging
      setResults(prev => ({ ...prev, [scenario.id]: { ...prev[scenario.id], judging: true } }));
      judgingStartTimesRef.current[scenario.id] = Date.now();
      const executionTime = Math.max(0, Date.now() - (runStartTimesRef.current[scenario.id] || Date.now()));
      const judgeResponse = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          response: payload.content,
          toolCalls: payload.toolCalls,
          citations: payload.citations,
        }),
      });
      if (!judgeResponse.ok) throw new Error('Judge API failed');
      const judgeData = await judgeResponse.json();
      const elapsed = Date.now() - (judgingStartTimesRef.current[scenario.id] || Date.now());
      const MIN_JUDGING_MS = 600;
      const applyResult = () => setResults(prev => ({
        ...prev,
        [scenario.id]: {
          scenarioId: scenario.id,
          status: judgeData.passed ? 'passed' : 'failed',
          response: payload.content,
          toolCalls: payload.toolCalls,
          score: judgeData.score,
          feedback: judgeData.feedback,
          executionTime,
          judging: false,
        },
      }));
      if (elapsed < MIN_JUDGING_MS) setTimeout(applyResult, MIN_JUDGING_MS - elapsed);
      else applyResult();
    } catch (error) {
      const elapsed = Date.now() - (judgingStartTimesRef.current[scenario.id] || Date.now());
      const MIN_JUDGING_MS = 600;
      const applyError = () => setResults(prev => ({
        ...prev,
        [scenario.id]: {
          scenarioId: scenario.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          judging: false,
        },
      }));
      if (elapsed < MIN_JUDGING_MS) setTimeout(applyError, MIN_JUDGING_MS - elapsed);
      else applyError();
    } finally {
      const resolve = runResolversRef.current[scenario.id];
      if (resolve) resolve();
      delete runResolversRef.current[scenario.id];
    }
  }

  function handleStreamError(scenario: TestScenario, message: string) {
    setResults(prev => ({
      ...prev,
      [scenario.id]: { scenarioId: scenario.id, status: 'failed', error: message },
    }));
    const resolve = runResolversRef.current[scenario.id];
    if (resolve) resolve();
    delete runResolversRef.current[scenario.id];
  }

  async function runAllTests() {
    setRunningAll(true);
    const filtered = filterCategory === 'all' 
      ? scenarios 
      : scenarios.filter(s => s.category === filterCategory);
    
    for (const scenario of filtered) {
      await runStreamingTest(scenario);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    setRunningAll(false);
  }

  function exportResults() {
    const data = scenarios.map(scenario => ({
      ...scenario,
      ...results[scenario.id]
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-results-${new Date().toISOString()}.json`;
    a.click();
  }

  const filteredScenarios = filterCategory === 'all' 
    ? scenarios 
    : scenarios.filter(s => s.category === filterCategory);

  const stats = {
    total: filteredScenarios.length,
    passed: filteredScenarios.filter(s => results[s.id]?.status === 'passed').length,
    failed: filteredScenarios.filter(s => results[s.id]?.status === 'failed').length,
    pending: filteredScenarios.filter(s => results[s.id]?.status === 'pending').length
  };

  const passRate = stats.total > 0 ? ((stats.passed / stats.total) * 100).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Test Suite</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Comprehensive testing including security, safety, and functional scenarios
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setConfigOpen((o) => !o)}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            {configOpen ? 'Hide Config' : 'Show Config'}
          </button>
          <button
            onClick={() => {
              try {
                if (typeof window !== 'undefined') {
                  const keysToRemove: string[] = [];
                  for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (k && k.startsWith(TESTS_PREFIX)) keysToRemove.push(k);
                  }
                  keysToRemove.forEach(k => localStorage.removeItem(k));
                }
              } catch (_) {}
              // Reset in-memory state as well
              setScenarios(testScenarios);
              setResults(() => {
                const initial: Record<string, TestResult> = {};
                testScenarios.forEach(s => { initial[s.id] = { scenarioId: s.id, status: 'pending' }; });
                return initial;
              });
            }}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Clear Test LocalStorage
          </button>
          <button
            onClick={() => {
              // Reset scenarios to defaults
              setScenarios(testScenarios);
              try {
                if (typeof window !== 'undefined') {
                  localStorage.removeItem(SCENARIOS_KEY);
                }
              } catch (_) {}
              // Reset results
              setResults(() => {
                const initial: Record<string, TestResult> = {};
                testScenarios.forEach(s => { initial[s.id] = { scenarioId: s.id, status: 'pending' }; });
                return initial;
              });
            }}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Reset to Defaults
          </button>
          <button
            onClick={() => {
              setResults(prev => {
                const next: Record<string, TestResult> = {};
                Object.values(prev).forEach(r => {
                  next[r.scenarioId] = { scenarioId: r.scenarioId, status: 'pending' };
                });
                return next;
              });
            }}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Clear Results
          </button>
          <button
            onClick={exportResults}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Export Results
          </button>
          <button
            onClick={runAllTests}
            disabled={runningAll}
            className="px-4 py-2 text-sm bg-black text-white dark:bg-white dark:text-black rounded-lg disabled:opacity-50"
          >
            {runningAll ? 'Running...' : `Run ${filteredScenarios.length} Tests`}
          </button>
          <button
            onClick={() => {
              const newScenario: TestScenario = {
                id: `custom_${Date.now()}`,
                name: 'New Scenario',
                category: 'information_retrieval',
                input: '',
                expectedBehavior: '',
                successCriteria: []
              };
              setEditingScenario(newScenario);
            }}
            className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
          >
            Add Scenario
          </button>
        </div>
      </div>

      {configOpen && (
        <div className="p-4 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 space-y-3">
          <div>
            <div className="text-sm font-medium mb-1">System Prompt</div>
            <textarea
              className="w-full h-28 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="text-sm font-medium mb-1">Search Tool Description</div>
              <textarea
                className="w-full h-20 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
                value={toolSearchDesc}
                onChange={(e) => setToolSearchDesc(e.target.value)}
              />
            </div>
            <div>
              <div className="text-sm font-medium mb-1">Read Tool Description</div>
              <textarea
                className="w-full h-20 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
                value={toolReadDesc}
                onChange={(e) => setToolReadDesc(e.target.value)}
              />
            </div>
          </div>
          <div className="text-xs text-neutral-500">
            These values override the system message and tool descriptions for all runs in this session.
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="text-2xl font-semibold">{stats.total}</div>
          <div className="text-sm text-neutral-500">Total Tests</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="text-2xl font-semibold text-green-600">{stats.passed}</div>
          <div className="text-sm text-neutral-500">Passed</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="text-2xl font-semibold text-red-600">{stats.failed}</div>
          <div className="text-sm text-neutral-500">Failed</div>
        </div>
        <div className="p-4 bg-white dark:bg-neutral-900 rounded-lg border border-neutral-200 dark:border-neutral-800">
          <div className="text-2xl font-semibold text-blue-600">{passRate}%</div>
          <div className="text-sm text-neutral-500">Pass Rate</div>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 items-center">
        <span className="text-sm text-neutral-500">Filter:</span>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as TestCategory | 'all')}
          className="px-3 py-1 text-sm border border-neutral-300 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-900"
        >
          <option value="all">All Categories</option>
          {Object.entries(categoryNames).map(([key, name]) => (
            <option key={key} value={key}>{name}</option>
          ))}
        </select>
      </div>

      {/* Test Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-800">
              <th className="text-left p-2 text-sm font-medium">Status</th>
              <th className="text-left p-2 text-sm font-medium">Test Name</th>
              <th className="text-left p-2 text-sm font-medium">Category</th>
              <th className="text-left p-2 text-sm font-medium">Score</th>
              <th className="text-left p-2 text-sm font-medium">Time</th>
              <th className="text-left p-2 text-sm font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredScenarios.map((scenario) => {
              const result = results[scenario.id];
              return (
                <Fragment key={scenario.id}>
                  <tr
                    key={`${scenario.id}-row`}
                    className="border-b border-neutral-100 dark:border-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                  >
                    <td className="p-2">
                      <span
                        className={`inline-flex w-20 justify-center px-2 py-1 text-xs font-medium rounded-full ${
                          result?.status === 'passed'
                            ? 'bg-green-100 text-green-800'
                            : result?.status === 'failed'
                            ? 'bg-red-100 text-red-800'
                            : result?.status === 'running'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {result?.status || 'pending'}
                      </span>
                    </td>
                    <td className="p-2 text-sm">{scenario.name}</td>
                    <td className="p-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${categoryColors[scenario.category]}`}>
                        {categoryNames[scenario.category]}
                      </span>
                    </td>
                    <td className="p-2 text-sm">{result?.score !== undefined ? `${result.score}/100` : '-'}</td>
                    <td className="p-2 text-sm">
                      {result?.executionTime ? `${(result.executionTime / 1000).toFixed(1)}s` : '-'}
                    </td>
                    <td className="p-2">
                      <div className="flex gap-1">
                        <button
                          onClick={() => runStreamingTest(scenario)}
                          disabled={result?.status === 'running' || runningAll}
                          className="px-2 py-1 text-xs bg-black text-white dark:bg-white dark:text-black rounded disabled:opacity-50"
                        >
                          Run
                        </button>
                        <button
                          onClick={() => toggleRow(scenario.id)}
                          className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 rounded"
                        >
                          {expandedRows[scenario.id] ? 'Hide' : 'View'}
                        </button>
                        <button
                          onClick={() => setEditingScenario(scenario)}
                          className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 rounded"
                        >
                          Edit
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedRows[scenario.id] && (
                    <tr key={`${scenario.id}-details`} className="border-b border-neutral-100 dark:border-neutral-900">
                      <td colSpan={6} className="p-3 bg-neutral-50/60 dark:bg-neutral-900/40">
                        <div className="space-y-3">
                          <TestRunRow
                            scenario={scenario}
                            runKey={runKeys[scenario.id]}
                            initiallyExpanded
                            onDone={(payload) => handleStreamDone(scenario, payload)}
                            onError={(msg) => handleStreamError(scenario, msg)}
                            systemPrompt={systemPrompt}
                            toolDescriptions={{ search: toolSearchDesc, read: toolReadDesc }}
                          />

                          {results[scenario.id]?.feedback !== undefined || results[scenario.id]?.judging ? (
                            <div className="p-3 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900">
                              <div className="flex items-center justify-between mb-2">
                                <div className="text-sm font-medium">Judge Result</div>
                                <div className="flex items-center gap-2">
                                  {results[scenario.id]?.judging && (
                                    <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
                                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                      </svg>
                                      Judging...
                                    </span>
                                  )}
                                  {typeof results[scenario.id]?.score === 'number' && !results[scenario.id]?.judging && (
                                    <span className="text-xs px-2 py-1 rounded bg-neutral-100 dark:bg-neutral-800">
                                      Score: {results[scenario.id]!.score}/100
                                    </span>
                                  )}
                                  <span className={`text-xs px-2 py-1 rounded-full ${
                                    results[scenario.id]?.status === 'passed'
                                      ? 'bg-green-100 text-green-800'
                                      : results[scenario.id]?.status === 'failed'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-gray-100 text-gray-800'
                                  }`}>
                                    {results[scenario.id]?.judging ? 'judging' : (results[scenario.id]?.status || 'pending')}
                                  </span>
                                </div>
                              </div>
                              {!results[scenario.id]?.judging && (
                                <div className="text-sm whitespace-pre-wrap">
                                  {results[scenario.id]?.feedback || 'No feedback provided'}
                                </div>
                              )}
                            </div>
                          ) : (
                            expandedRows[scenario.id] && results[scenario.id]?.status === 'running' ? (
                              <div className="p-3 rounded-lg border border-dashed border-neutral-300 dark:border-neutral-700 bg-white/60 dark:bg-neutral-900/40 text-xs text-neutral-500">
                                Waiting for model response to finish before judging...
                              </div>
                            ) : null
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* View Modal */}
      {selectedScenario && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg max-w-3xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{selectedScenario.name}</h3>
              <button
                onClick={() => setSelectedScenario(null)}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <div className="text-sm font-medium text-neutral-500">Input</div>
                <div className="mt-1 p-3 bg-neutral-50 dark:bg-neutral-800 rounded">{selectedScenario.input}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-neutral-500">Expected Behavior</div>
                <div className="mt-1 p-3 bg-neutral-50 dark:bg-neutral-800 rounded">{selectedScenario.expectedBehavior}</div>
              </div>
              
              <div>
                <div className="text-sm font-medium text-neutral-500">Success Criteria</div>
                <ul className="mt-1 p-3 bg-neutral-50 dark:bg-neutral-800 rounded list-disc list-inside">
                  {selectedScenario.successCriteria.map((c, i) => (
                    <li key={i} className="text-sm">{c}</li>
                  ))}
                </ul>
              </div>
              
              {results[selectedScenario.id]?.response && (
                <div>
                  <div className="text-sm font-medium text-neutral-500">Response</div>
                  <div className="mt-1 p-3 bg-neutral-50 dark:bg-neutral-800 rounded text-sm">
                    {results[selectedScenario.id].response}
                  </div>
                </div>
              )}
              
              {results[selectedScenario.id]?.feedback && (
                <div>
                  <div className="text-sm font-medium text-neutral-500">Judge Feedback</div>
                  <div className="mt-1 p-3 bg-neutral-50 dark:bg-neutral-800 rounded text-sm">
                    {results[selectedScenario.id].feedback}
                  </div>
                </div>
              )}

              <div className="mt-4">
                <div className="text-sm font-medium text-neutral-500 mb-2">Interactive Chat (uses test tools)</div>
                <Chat
                  endpoint="/api/test/stream"
                  storageKey={`ca-agent-demo:test:chat:${selectedScenario.id}`}
                  seedMessages={(selectedScenario.previousMessages || []).map(m => ({ role: m.role, content: m.content }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingScenario && editForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-neutral-900 rounded-lg max-w-4xl w-full max-h-[85vh] overflow-y-auto p-6">
            <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-semibold">{editingScenario ? 'Edit Scenario' : 'Add Scenario'}</h3>
              <button
                onClick={handleCancelEdit}
                className="text-neutral-500 hover:text-neutral-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="block text-sm text-neutral-500">ID</label>
                <input
                  className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.id}
                  onChange={(e) => setEditForm({ ...editForm, id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-neutral-500">Name</label>
                <input
                  className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-neutral-500">Category</label>
                <select
                  className="w-full px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.category}
                  onChange={(e) => setEditForm({ ...editForm, category: e.target.value as TestCategory })}
                >
                  {Object.keys(categoryNames).map((key) => (
                    <option key={key} value={key}>{categoryNames[key as TestCategory]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-neutral-500">Multi-turn</label>
                <input
                  type="checkbox"
                  checked={editForm.isMultiTurn}
                  onChange={(e) => setEditForm({ ...editForm, isMultiTurn: e.target.checked })}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm text-neutral-500">Input</label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.input}
                  onChange={(e) => setEditForm({ ...editForm, input: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm text-neutral-500">Expected Behavior</label>
                <textarea
                  className="w-full h-20 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.expectedBehavior}
                  onChange={(e) => setEditForm({ ...editForm, expectedBehavior: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-neutral-500">Success Criteria (one per line)</label>
                <textarea
                  className="w-full h-32 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.successCriteria}
                  onChange={(e) => setEditForm({ ...editForm, successCriteria: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <label className="block text-sm text-neutral-500">Failure Criteria (one per line)</label>
                <textarea
                  className="w-full h-32 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900"
                  value={editForm.failureCriteria}
                  onChange={(e) => setEditForm({ ...editForm, failureCriteria: e.target.value })}
                />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="block text-sm text-neutral-500">Previous Messages (JSON array of {`{ role, content }`})</label>
                <textarea
                  className="w-full h-40 px-3 py-2 rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 font-mono text-xs"
                  value={editForm.previousMessagesText}
                  onChange={(e) => setEditForm({ ...editForm, previousMessagesText: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-between items-center mt-6">
              <button
                onClick={() => handleDeleteScenario(editForm.id)}
                className="px-4 py-2 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200"
              >
                Delete
              </button>
              <div className="flex gap-2">
                <button
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-sm bg-neutral-200 dark:bg-neutral-800 rounded-lg hover:bg-neutral-300 dark:hover:bg-neutral-700"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveEdit}
                  className="px-4 py-2 text-sm bg-black text-white dark:bg-white dark:text-black rounded-lg"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}