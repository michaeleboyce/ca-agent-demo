'use client';
import { useState, useEffect } from 'react';
import { testScenarios, TestScenario, TestCategory } from '@/lib/test-scenarios';

type TestResult = {
  scenarioId: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  response?: string;
  toolCalls?: any[];
  score?: number;
  feedback?: string;
  executionTime?: number;
  error?: string;
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

  useEffect(() => {
    // Initialize results
    const initialResults: Record<string, TestResult> = {};
    testScenarios.forEach(scenario => {
      initialResults[scenario.id] = { scenarioId: scenario.id, status: 'pending' };
    });
    setResults(initialResults);
  }, []);

  async function runTest(scenario: TestScenario) {
    setResults(prev => ({
      ...prev,
      [scenario.id]: { ...prev[scenario.id], status: 'running' }
    }));

    try {
      const startTime = Date.now();
      
      // Run the test through the chat API
      const messages = scenario.previousMessages || [];
      messages.push({ role: 'user' as const, content: scenario.input });
      
      const chatResponse = await fetch('/api/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages })
      });

      if (!chatResponse.ok) throw new Error('Chat API failed');
      
      const chatData = await chatResponse.json();
      const executionTime = Date.now() - startTime;

      // Judge the response
      const judgeResponse = await fetch('/api/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          response: chatData.message,
          toolCalls: chatData.toolCalls,
          citations: chatData.citations
        })
      });

      if (!judgeResponse.ok) throw new Error('Judge API failed');
      
      const judgeData = await judgeResponse.json();

      setResults(prev => ({
        ...prev,
        [scenario.id]: {
          scenarioId: scenario.id,
          status: judgeData.passed ? 'passed' : 'failed',
          response: chatData.message,
          toolCalls: chatData.toolCalls,
          score: judgeData.score,
          feedback: judgeData.feedback,
          executionTime
        }
      }));
    } catch (error) {
      setResults(prev => ({
        ...prev,
        [scenario.id]: {
          scenarioId: scenario.id,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }));
    }
  }

  async function runAllTests() {
    setRunningAll(true);
    const filtered = filterCategory === 'all' 
      ? testScenarios 
      : testScenarios.filter(s => s.category === filterCategory);
    
    for (const scenario of filtered) {
      await runTest(scenario);
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setRunningAll(false);
  }

  function exportResults() {
    const data = testScenarios.map(scenario => ({
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
    ? testScenarios 
    : testScenarios.filter(s => s.category === filterCategory);

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
        </div>
      </div>

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
            {filteredScenarios.map(scenario => {
              const result = results[scenario.id];
              return (
                <tr 
                  key={scenario.id}
                  className="border-b border-neutral-100 dark:border-neutral-900 hover:bg-neutral-50 dark:hover:bg-neutral-900/50"
                >
                  <td className="p-2">
                    <span className={`inline-flex w-20 justify-center px-2 py-1 text-xs font-medium rounded-full ${
                      result?.status === 'passed' ? 'bg-green-100 text-green-800' :
                      result?.status === 'failed' ? 'bg-red-100 text-red-800' :
                      result?.status === 'running' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}>
                      {result?.status || 'pending'}
                    </span>
                  </td>
                  <td className="p-2 text-sm">{scenario.name}</td>
                  <td className="p-2">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${categoryColors[scenario.category]}`}>
                      {categoryNames[scenario.category]}
                    </span>
                  </td>
                  <td className="p-2 text-sm">
                    {result?.score !== undefined ? `${result.score}/100` : '-'}
                  </td>
                  <td className="p-2 text-sm">
                    {result?.executionTime ? `${(result.executionTime / 1000).toFixed(1)}s` : '-'}
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1">
                      <button
                        onClick={() => runTest(scenario)}
                        disabled={result?.status === 'running' || runningAll}
                        className="px-2 py-1 text-xs bg-black text-white dark:bg-white dark:text-black rounded disabled:opacity-50"
                      >
                        Run
                      </button>
                      <button
                        onClick={() => setSelectedScenario(scenario)}
                        className="px-2 py-1 text-xs bg-neutral-200 dark:bg-neutral-800 rounded"
                      >
                        View
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}