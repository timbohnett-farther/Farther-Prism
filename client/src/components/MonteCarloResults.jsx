import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, Loader2, AlertCircle } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://farther-prism-production.up.railway.app';

export default function MonteCarloResults({ data, onUpdate, onNext, onPrev }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState(data.monteCarloResults);

  useEffect(() => {
    if (!results) {
      runSimulation();
    }
  }, []);

  const runSimulation = async () => {
    setLoading(true);
    setError(null);

    try {
      const { clientData, portfolio } = data;
      const totalValue = portfolio.reduce((sum, h) => sum + h.value, 0);
      
      // Calculate years until retirement
      const yearsToRetirement = clientData.retirementAge - clientData.age;
      
      const params = {
        initialValue: clientData.currentSavings || totalValue,
        expectedReturn: 0.08, // 8% default
        volatility: 0.15, // 15% default
        years: yearsToRetirement,
        annualContribution: 0,
        annualWithdrawal: clientData.retirementGoal || 0,
        numSimulations: 10000,
      };

      const response = await axios.post(`${API_URL}/api/monte-carlo`, params);
      const resultData = response.data;
      
      setResults(resultData);
      onUpdate('monteCarloResults', resultData);
    } catch (err) {
      setError(err.message || 'Failed to run simulation');
      console.error('Monte Carlo Error:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <Loader2 className="w-16 h-16 animate-spin text-blue-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Running Monte Carlo Simulation</h3>
        <p className="text-slate-600">Analyzing 10,000 possible scenarios...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20">
        <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
        <h3 className="text-2xl font-bold text-slate-900 mb-2">Simulation Failed</h3>
        <p className="text-slate-600 mb-6">{error}</p>
        <button
          onClick={runSimulation}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!results) {
    return null;
  }

  const { successRate, medianFinalValue, percentile5, percentile95, executionTimeMs } = results.results;
  const isSuccess = successRate >= 75;

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Monte Carlo Projection</h2>
        <p className="text-slate-600">
          Based on 10,000 simulated scenarios over {results.parameters.years} years
        </p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Success Rate</span>
            {isSuccess ? (
              <TrendingUp className="w-5 h-5 text-green-600" />
            ) : (
              <TrendingDown className="w-5 h-5 text-red-600" />
            )}
          </div>
          <div className={`text-4xl font-bold ${isSuccess ? 'text-green-600' : 'text-red-600'}`}>
            {successRate.toFixed(1)}%
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Probability of meeting goals
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Median Outcome</span>
            <Target className="w-5 h-5 text-blue-600" />
          </div>
          <div className="text-3xl font-bold text-slate-900">
            ${(medianFinalValue / 1000000).toFixed(2)}M
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Most likely final value
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Best Case (95th)</span>
            <DollarSign className="w-5 h-5 text-green-600" />
          </div>
          <div className="text-3xl font-bold text-green-600">
            ${(percentile95 / 1000000).toFixed(2)}M
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Top 5% of scenarios
          </p>
        </div>

        <div className="bg-white p-6 rounded-lg border-2 border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-600">Worst Case (5th)</span>
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="text-3xl font-bold text-orange-600">
            ${(percentile5 / 1000000).toFixed(2)}M
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Bottom 5% of scenarios
          </p>
        </div>
      </div>

      {/* Success/Warning Banner */}
      <div className={`p-6 rounded-lg mb-8 ${
        isSuccess 
          ? 'bg-green-50 border-2 border-green-200' 
          : 'bg-orange-50 border-2 border-orange-200'
      }`}>
        <div className="flex items-start">
          {isSuccess ? (
            <TrendingUp className="w-8 h-8 text-green-600 mr-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-8 h-8 text-orange-600 mr-4 flex-shrink-0" />
          )}
          <div>
            <h3 className={`text-lg font-bold mb-2 ${isSuccess ? 'text-green-900' : 'text-orange-900'}`}>
              {isSuccess ? 'On Track to Meet Goals' : 'Goals May Be At Risk'}
            </h3>
            <p className={`${isSuccess ? 'text-green-700' : 'text-orange-700'}`}>
              {isSuccess
                ? `With a ${successRate.toFixed(1)}% success rate, this portfolio is well-positioned to meet retirement goals. The median projected value of $${(medianFinalValue / 1000000).toFixed(2)}M provides a comfortable cushion.`
                : `With only a ${successRate.toFixed(1)}% success rate, there's significant risk of not meeting retirement goals. Consider increasing contributions, adjusting timeline, or reviewing risk allocation.`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Portfolio Parameters */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8">
        <h3 className="font-bold text-slate-900 mb-4">Simulation Parameters</h3>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <span className="text-slate-600">Initial Value:</span>
            <span className="ml-2 font-medium text-slate-900">
              ${results.parameters.initialValue.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-600">Expected Return:</span>
            <span className="ml-2 font-medium text-slate-900">
              {(results.parameters.expectedReturn * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-slate-600">Volatility:</span>
            <span className="ml-2 font-medium text-slate-900">
              {(results.parameters.volatility * 100).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-slate-600">Time Horizon:</span>
            <span className="ml-2 font-medium text-slate-900">
              {results.parameters.years} years
            </span>
          </div>
          <div>
            <span className="text-slate-600">Annual Withdrawal:</span>
            <span className="ml-2 font-medium text-slate-900">
              ${results.parameters.annualWithdrawal.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-slate-600">Execution Time:</span>
            <span className="ml-2 font-medium text-slate-900">
              {executionTimeMs.toFixed(0)}ms
            </span>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-slate-200">
        <button
          onClick={onPrev}
          className="px-8 py-3 border-2 border-farther-slate text-farther-charcoal font-semibold rounded-lg hover:bg-gray-50 transition-all"
        >
          ← Back
        </button>
        <button
          onClick={onNext}
          className="px-8 py-3 bg-farther-teal text-white font-semibold rounded-lg hover:bg-farther-teal/90 transition-all shadow-md hover:shadow-xl focus:ring-2 focus:ring-farther-teal"
        >
          Generate Report →
        </button>
      </div>
    </div>
  );
}
