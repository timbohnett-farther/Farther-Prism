/**
 * Focus Dashboard - Portfolio Analytics & Optimization
 * 
 * Overview, allocation, tax-loss harvesting, rebalancing, fees.
 */

import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from 'recharts';
import { Target, TrendingUp, TrendingDown, DollarSign, AlertTriangle, Loader2, ArrowLeft, Scissors, RefreshCw, Receipt } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://farther-prism-production.up.railway.app';

const COLORS = ['#1a7a82', '#2d9da6', '#40c0ca', '#6dcfd6', '#99dfe4', '#c5eff2', '#e0f7f9'];

const ASSET_CLASS_LABELS = {
  us_stocks: 'US Stocks',
  intl_stocks: 'International',
  bonds: 'Bonds',
  real_estate: 'Real Estate',
  commodities: 'Commodities',
  cash: 'Cash',
  other: 'Other',
};

export default function FocusDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [householdId, setHouseholdId] = useState('');
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState(null);
  const [allocation, setAllocation] = useState(null);
  const [taxLoss, setTaxLoss] = useState(null);
  const [rebalance, setRebalance] = useState(null);
  const [fees, setFees] = useState(null);
  const [performance, setPerformance] = useState(null);

  const loadData = async (tab) => {
    if (!householdId) return;
    setLoading(true);

    try {
      switch (tab) {
        case 'overview': {
          const res = await axios.get(`${API_URL}/api/v1/focus/${householdId}/overview`);
          setOverview(res.data);
          break;
        }
        case 'performance': {
          const res = await axios.get(`${API_URL}/api/v1/focus/${householdId}/performance`);
          setPerformance(res.data);
          break;
        }
        case 'allocation': {
          const res = await axios.get(`${API_URL}/api/v1/focus/${householdId}/allocation`);
          setAllocation(res.data);
          break;
        }
        case 'tax-loss': {
          const res = await axios.get(`${API_URL}/api/v1/focus/${householdId}/tax-loss`);
          setTaxLoss(res.data);
          break;
        }
        case 'rebalance': {
          const res = await axios.get(`${API_URL}/api/v1/focus/${householdId}/rebalance`);
          setRebalance(res.data);
          break;
        }
        case 'fees': {
          const res = await axios.get(`${API_URL}/api/v1/focus/${householdId}/fees`);
          setFees(res.data);
          break;
        }
      }
    } catch (error) {
      console.error(`Failed to load ${tab}:`, error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (householdId) loadData(activeTab);
  }, [activeTab, householdId]);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Target },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'allocation', label: 'Allocation', icon: PieChart },
    { id: 'tax-loss', label: 'Tax Harvesting', icon: Scissors },
    { id: 'rebalance', label: 'Rebalance', icon: RefreshCw },
    { id: 'fees', label: 'Fees', icon: Receipt },
  ];

  const fmt = (n) => n?.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) || '0';
  const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

  // Household selector (if not set)
  if (!householdId) {
    return (
      <div className="min-h-screen bg-[#333333] p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-[#FCFDFC] mb-4">🎯 Focus</h1>
          <p className="text-[#FCFDFC] opacity-80 mb-8">Focus on what matters most. Go Farther.</p>
          <div className="bg-[#5b6a71] rounded-lg p-8">
            <label className="block text-[#FCFDFC] font-medium mb-2">Enter Household ID</label>
            <input
              type="text"
              placeholder="UUID of household"
              className="w-full px-4 py-3 rounded-lg bg-[#333333] text-[#FCFDFC] border-2 border-[#1a7a82] mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Enter') setHouseholdId(e.target.value);
              }}
            />
            <button
              onClick={(e) => {
                const input = e.target.parentElement.querySelector('input');
                setHouseholdId(input.value);
              }}
              className="px-6 py-3 bg-[#1a7a82] text-[#FCFDFC] rounded-lg hover:bg-[#1a7a82]/80 font-bold"
            >
              Analyze Portfolio
            </button>
          </div>
          <a href="/" className="inline-block mt-6 text-[#FCFDFC] opacity-60 hover:opacity-100">
            ← Back to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#333333]">
      {/* Header */}
      <header className="bg-[#5b6a71] border-b border-[#333333] px-8 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <a href="/" className="text-[#FCFDFC] opacity-60 hover:opacity-100">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <h1 className="text-2xl font-bold text-[#FCFDFC]">🎯 Focus</h1>
          </div>
          <p className="text-[#FCFDFC] opacity-60 text-sm">Household: {householdId.slice(0, 8)}...</p>
        </div>
      </header>

      {/* Tabs */}
      <div className="bg-[#5b6a71]/50 border-b border-[#333333]">
        <div className="max-w-7xl mx-auto px-8 flex gap-1 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition border-b-2 ${
                activeTab === tab.id
                  ? 'text-[#1a7a82] border-[#1a7a82]'
                  : 'text-[#FCFDFC] opacity-60 border-transparent hover:opacity-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-8 py-8">
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-[#1a7a82] mx-auto mb-4" />
            <p className="text-[#FCFDFC] opacity-80">Analyzing portfolio...</p>
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {activeTab === 'overview' && overview && (
              <div>
                {/* Key Metrics */}
                <div className="grid grid-cols-4 gap-4 mb-8">
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Total Value</p>
                    <p className="text-2xl font-bold text-[#FCFDFC]">${fmt(overview.totalValue)}</p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Total Gain/Loss</p>
                    <p className={`text-2xl font-bold ${overview.totalGainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {overview.totalGainLoss >= 0 ? '+' : ''}${fmt(overview.totalGainLoss)}
                    </p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Return</p>
                    <p className={`text-2xl font-bold ${overview.returnPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pct(overview.returnPct)}
                    </p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">TLH Opportunities</p>
                    <p className="text-2xl font-bold text-[#1a7a82]">{overview.tlhOpportunities}</p>
                  </div>
                </div>

                {/* Allocation Pie */}
                {overview.allocation && Object.keys(overview.allocation).length > 0 && (
                  <div className="bg-[#5b6a71] rounded-lg p-6 mb-8">
                    <h3 className="text-lg font-bold text-[#FCFDFC] mb-4">Asset Allocation</h3>
                    <div className="flex items-center gap-8">
                      <ResponsiveContainer width={300} height={250}>
                        <PieChart>
                          <Pie
                            data={Object.entries(overview.allocation).map(([cls, data]) => ({
                              name: ASSET_CLASS_LABELS[cls] || cls,
                              value: data.value,
                            }))}
                            cx="50%"
                            cy="50%"
                            outerRadius={100}
                            dataKey="value"
                            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          >
                            {Object.keys(overview.allocation).map((_, i) => (
                              <Cell key={i} fill={COLORS[i % COLORS.length]} />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1">
                        {Object.entries(overview.allocation).map(([cls, data], i) => (
                          <div key={cls} className="flex items-center justify-between py-2 border-b border-[#333333] last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                              <span className="text-[#FCFDFC]">{ASSET_CLASS_LABELS[cls] || cls}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[#FCFDFC] font-bold">{pct(data.percentage)}</span>
                              <span className="text-[#FCFDFC] opacity-60 ml-2">${fmt(data.value)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Concentration Risks */}
                {overview.concentrations?.length > 0 && (
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <h3 className="text-lg font-bold text-[#FCFDFC] mb-4 flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-yellow-400" />
                      Concentration Risks
                    </h3>
                    {overview.concentrations.map((c, i) => (
                      <div key={i} className="flex items-center justify-between py-2 border-b border-[#333333] last:border-0">
                        <span className="text-[#FCFDFC] font-bold">{c.symbol}</span>
                        <div>
                          <span className="text-yellow-400 font-bold">{pct(c.pct)}</span>
                          <span className="text-[#FCFDFC] opacity-60 ml-2">${fmt(c.value)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tax-Loss Tab */}
            {activeTab === 'tax-loss' && taxLoss && (
              <div>
                <div className="bg-[#5b6a71] rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-bold text-[#FCFDFC] mb-2">Tax-Loss Harvesting Opportunities</h3>
                  <p className="text-[#1a7a82] text-3xl font-bold">${fmt(taxLoss.totalPotentialSavings)} potential savings</p>
                  <p className="text-[#FCFDFC] opacity-60">{taxLoss.count} opportunities found</p>
                  {taxLoss.washSaleWarnings > 0 && (
                    <p className="text-yellow-400 mt-2">⚠️ {taxLoss.washSaleWarnings} wash sale warning(s)</p>
                  )}
                </div>

                {taxLoss.opportunities?.map((opp, i) => (
                  <div key={i} className="bg-[#5b6a71] rounded-lg p-4 mb-3 flex items-center justify-between">
                    <div>
                      <span className="text-[#FCFDFC] font-bold text-lg">{opp.symbol}</span>
                      <span className="text-[#FCFDFC] opacity-60 ml-2">{opp.accountName}</span>
                      {opp.washSaleViolation && (
                        <span className="ml-2 text-xs bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded">Wash Sale</span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-red-400 font-bold">-${fmt(opp.unrealizedLoss)} loss</p>
                      <p className="text-green-400 text-sm">${fmt(opp.estimatedTaxSavings)} tax savings</p>
                      {opp.replacementSymbol && (
                        <p className="text-[#FCFDFC] opacity-60 text-xs">Replace with {opp.replacementSymbol}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fees Tab */}
            {activeTab === 'fees' && fees && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Weighted Expense Ratio</p>
                    <p className="text-2xl font-bold text-[#FCFDFC]">{fees.weightedExpenseRatio?.toFixed(2)}%</p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Annual Fund Costs</p>
                    <p className="text-2xl font-bold text-[#FCFDFC]">${fmt(fees.totalAnnualCost)}</p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">10-Year Cost Drag</p>
                    <p className="text-2xl font-bold text-red-400">${fmt(fees.tenYearCostProjection)}</p>
                  </div>
                </div>

                <div className="bg-[#5b6a71] rounded-lg p-6">
                  <h3 className="text-lg font-bold text-[#FCFDFC] mb-4">Holdings by Cost</h3>
                  {fees.holdings?.map((h, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#333333] last:border-0">
                      <span className="text-[#FCFDFC] font-bold">{h.symbol}</span>
                      <div className="text-right">
                        <span className="text-[#FCFDFC]">{h.expenseRatio?.toFixed(2)}%</span>
                        <span className="text-[#FCFDFC] opacity-60 ml-4">${fmt(h.annualCost)}/yr</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rebalance Tab */}
            {activeTab === 'rebalance' && rebalance && (
              <div>
                <div className="bg-[#5b6a71] rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-bold text-[#FCFDFC] mb-2">Rebalancing</h3>
                  {rebalance.needsRebalance ? (
                    <>
                      <p className="text-yellow-400 font-bold">Portfolio drift: {pct(rebalance.totalDrift)}</p>
                      <p className="text-[#FCFDFC] opacity-80">{rebalance.tradeCount} trades recommended</p>
                    </>
                  ) : (
                    <p className="text-green-400 font-bold">✓ Portfolio is within target allocation</p>
                  )}
                </div>

                {rebalance.trades?.map((trade, i) => (
                  <div key={i} className="bg-[#5b6a71] rounded-lg p-4 mb-3 flex items-center justify-between">
                    <div>
                      <span className={`font-bold ${trade.action === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                        {trade.action.toUpperCase()}
                      </span>
                      <span className="text-[#FCFDFC] ml-2">{ASSET_CLASS_LABELS[trade.assetClass] || trade.assetClass}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-[#FCFDFC] font-bold">${fmt(trade.amount)}</p>
                      <p className="text-[#FCFDFC] opacity-60 text-sm">{trade.reason}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Performance Tab */}
            {activeTab === 'performance' && performance && (
              <div>
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Total Return</p>
                    <p className={`text-2xl font-bold ${performance.totalReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pct(performance.totalReturn)}
                    </p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Total Gain/Loss</p>
                    <p className={`text-2xl font-bold ${(performance.totalValue - performance.totalCost) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      ${fmt(performance.totalValue - performance.totalCost)}
                    </p>
                  </div>
                  <div className="bg-[#5b6a71] rounded-lg p-6">
                    <p className="text-[#FCFDFC] opacity-60 text-sm">Holdings</p>
                    <p className="text-2xl font-bold text-[#FCFDFC]">
                      {(performance.topPerformers?.length || 0) + (performance.bottomPerformers?.length || 0)}
                    </p>
                  </div>
                </div>

                {/* Top Performers */}
                <div className="bg-[#5b6a71] rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-bold text-[#FCFDFC] mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-green-400" /> Top Performers
                  </h3>
                  {performance.topPerformers?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#333333] last:border-0">
                      <span className="text-[#FCFDFC] font-bold">{p.symbol}</span>
                      <div>
                        <span className="text-green-400 font-bold">{pct(p.returnPct)}</span>
                        <span className="text-[#FCFDFC] opacity-60 ml-4">+${fmt(p.gain)}</span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bottom Performers */}
                <div className="bg-[#5b6a71] rounded-lg p-6">
                  <h3 className="text-lg font-bold text-[#FCFDFC] mb-4 flex items-center gap-2">
                    <TrendingDown className="w-5 h-5 text-red-400" /> Bottom Performers
                  </h3>
                  {performance.bottomPerformers?.map((p, i) => (
                    <div key={i} className="flex items-center justify-between py-2 border-b border-[#333333] last:border-0">
                      <span className="text-[#FCFDFC] font-bold">{p.symbol}</span>
                      <div>
                        <span className="text-red-400 font-bold">{pct(p.returnPct)}</span>
                        <span className="text-[#FCFDFC] opacity-60 ml-4">${fmt(p.gain)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Allocation Tab */}
            {activeTab === 'allocation' && allocation && (
              <div>
                <div className="bg-[#5b6a71] rounded-lg p-6 mb-6">
                  <h3 className="text-xl font-bold text-[#FCFDFC] mb-2">Allocation Drift</h3>
                  <p className={`font-bold ${allocation.needsRebalance ? 'text-yellow-400' : 'text-green-400'}`}>
                    Total drift: {pct(allocation.totalDrift)}
                    {allocation.needsRebalance ? ' — Rebalancing recommended' : ' — Within range'}
                  </p>
                </div>

                {Object.entries(allocation.drift || {}).map(([cls, data], i) => (
                  <div key={cls} className="bg-[#5b6a71] rounded-lg p-4 mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[#FCFDFC] font-bold">{ASSET_CLASS_LABELS[cls] || cls}</span>
                      <span className={`font-bold ${data.drift > 0 ? 'text-yellow-400' : data.drift < -0.02 ? 'text-blue-400' : 'text-green-400'}`}>
                        {data.drift > 0 ? '+' : ''}{pct(data.drift)}
                      </span>
                    </div>
                    <div className="flex gap-4 text-sm text-[#FCFDFC] opacity-60">
                      <span>Current: {pct(data.current)}</span>
                      <span>Target: {pct(data.target)}</span>
                      <span>${fmt(data.value)}</span>
                    </div>
                    {/* Visual bar */}
                    <div className="mt-2 h-2 bg-[#333333] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(data.current * 100, 100)}%`,
                          backgroundColor: Math.abs(data.drift) > 0.05 ? '#EAB308' : '#1a7a82',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
