/**
 * Beyond Marketplace - Alternative Investments
 * 
 * Browse and allocate to private equity, real estate, hedge funds,
 * venture capital, and credit opportunities.
 */

import { useState, useEffect } from 'react';
import { TrendingUp, Shield, Clock, DollarSign, AlertTriangle, CheckCircle, ArrowLeft, Filter } from 'lucide-react';
import axios from 'axios';

const API_URL = 'https://farther-prism-production.up.railway.app';

const CATEGORY_LABELS = {
  private_equity: 'Private Equity',
  hedge_fund: 'Hedge Funds',
  real_estate: 'Real Estate',
  venture_capital: 'Venture Capital',
  credit: 'Credit / Direct Lending',
  infrastructure: 'Infrastructure',
  commodities: 'Commodities',
};

const RISK_COLORS = {
  low: 'text-green-400',
  moderate: 'text-yellow-400',
  high: 'text-orange-400',
  very_high: 'text-red-400',
};

export default function BeyondMarketplace() {
  const [householdId, setHouseholdId] = useState('');
  const [view, setView] = useState('home'); // home, marketplace, detail
  const [investments, setInvestments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedInvestment, setSelectedInvestment] = useState(null);
  const [allocations, setAllocations] = useState([]);
  const [suitability, setSuitability] = useState(null);
  const [loading, setLoading] = useState(false);

  const fmt = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

  const loadInvestments = async () => {
    setLoading(true);
    try {
      const [invRes, catRes] = await Promise.all([
        axios.get(`${API_URL}/api/v1/beyond/investments`, { params: { category: selectedCategory } }),
        axios.get(`${API_URL}/api/v1/beyond/categories`),
      ]);
      setInvestments(invRes.data.investments || []);
      setCategories(catRes.data.categories || []);
      setView('marketplace');
    } catch (e) {
      console.error('Failed to load investments:', e);
    } finally {
      setLoading(false);
    }
  };

  const loadAllocations = async () => {
    if (!householdId) return;
    try {
      const res = await axios.get(`${API_URL}/api/v1/beyond/household/${householdId}/allocations`);
      setAllocations(res.data.allocations || []);
    } catch (e) {
      console.error('Failed to load allocations:', e);
    }
  };

  const checkSuitability = async (investmentId) => {
    if (!householdId) return;
    try {
      const res = await axios.get(`${API_URL}/api/v1/beyond/suitability/${householdId}/${investmentId}`);
      setSuitability(res.data);
    } catch (e) {
      console.error('Suitability check failed:', e);
    }
  };

  useEffect(() => {
    if (householdId && view === 'marketplace') {
      loadAllocations();
    }
  }, [householdId, view]);

  useEffect(() => {
    if (selectedInvestment && householdId) {
      checkSuitability(selectedInvestment.id);
    }
  }, [selectedInvestment, householdId]);

  // Household selector
  if (!householdId || view === 'home') {
    return (
      <div className="min-h-screen bg-[#333333] p-8">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold text-[#FCFDFC] mb-4">🚀 Beyond</h1>
          <p className="text-[#FCFDFC] opacity-80 mb-8">Explore opportunities beyond the mainstream. Go Farther.</p>
          <div className="bg-[#5b6a71] rounded-lg p-8">
            <label className="block text-[#FCFDFC] font-medium mb-2">Enter Household ID</label>
            <input
              type="text"
              placeholder="UUID of household"
              className="w-full px-4 py-3 rounded-lg bg-[#333333] text-[#FCFDFC] border-2 border-[#1a7a82] mb-4"
              value={householdId}
              onChange={(e) => setHouseholdId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadInvestments(); }}
            />
            <button
              onClick={loadInvestments}
              disabled={loading}
              className="px-6 py-3 bg-[#1a7a82] text-[#FCFDFC] rounded-lg hover:bg-[#1a7a82]/80 font-bold disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Explore Alternatives'}
            </button>
          </div>
          <a href="/" className="inline-block mt-6 text-[#FCFDFC] opacity-60 hover:opacity-100">← Back to Dashboard</a>
        </div>
      </div>
    );
  }

  // Detail view
  if (view === 'detail' && selectedInvestment) {
    const inv = selectedInvestment;
    return (
      <div className="min-h-screen bg-[#333333] p-8">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-8">
            <button onClick={() => { setView('marketplace'); setSelectedInvestment(null); setSuitability(null); }} className="text-[#FCFDFC] opacity-60 hover:opacity-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-3xl font-bold text-[#FCFDFC]">{inv.name}</h1>
          </div>

          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-[#5b6a71] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2 text-[#FCFDFC] opacity-60">
                <TrendingUp className="w-4 h-4" /> Target Return
              </div>
              <p className="text-2xl font-bold text-[#FCFDFC]">{pct(inv.target_return)}</p>
            </div>
            <div className="bg-[#5b6a71] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2 text-[#FCFDFC] opacity-60">
                <DollarSign className="w-4 h-4" /> Minimum
              </div>
              <p className="text-2xl font-bold text-[#FCFDFC]">${fmt(inv.minimum_investment)}</p>
            </div>
            <div className="bg-[#5b6a71] rounded-lg p-6">
              <div className="flex items-center gap-2 mb-2 text-[#FCFDFC] opacity-60">
                <Shield className="w-4 h-4" /> Risk
              </div>
              <p className={`text-2xl font-bold ${RISK_COLORS[inv.risk_rating]}`}>{inv.risk_rating.replace('_', ' ').toUpperCase()}</p>
            </div>
          </div>

          <div className="bg-[#5b6a71] rounded-lg p-6 mb-6">
            <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Strategy</h2>
            <p className="text-[#FCFDFC] opacity-80">{inv.strategy}</p>
          </div>

          <div className="grid grid-cols-2 gap-6 mb-6">
            {inv.highlights && inv.highlights.length > 0 && (
              <div className="bg-[#5b6a71] rounded-lg p-6">
                <h3 className="text-lg font-bold text-[#FCFDFC] mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" /> Highlights
                </h3>
                <ul className="space-y-2">
                  {inv.highlights.map((h, i) => (
                    <li key={i} className="text-[#FCFDFC] opacity-80 text-sm flex items-start gap-2">
                      <span className="text-green-400 mt-1">•</span>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inv.risks && inv.risks.length > 0 && (
              <div className="bg-[#5b6a71] rounded-lg p-6">
                <h3 className="text-lg font-bold text-[#FCFDFC] mb-3 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-yellow-400" /> Risks
                </h3>
                <ul className="space-y-2">
                  {inv.risks.map((r, i) => (
                    <li key={i} className="text-[#FCFDFC] opacity-80 text-sm flex items-start gap-2">
                      <span className="text-yellow-400 mt-1">•</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-[#5b6a71] rounded-lg p-6 mb-6">
            <h3 className="text-lg font-bold text-[#FCFDFC] mb-4">Key Terms</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex justify-between py-2 border-b border-[#333333]">
                <span className="text-[#FCFDFC] opacity-60">Management Fee</span>
                <span className="text-[#FCFDFC] font-bold">{pct(inv.management_fee)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#333333]">
                <span className="text-[#FCFDFC] opacity-60">Performance Fee</span>
                <span className="text-[#FCFDFC] font-bold">{pct(inv.performance_fee)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#333333]">
                <span className="text-[#FCFDFC] opacity-60">Lockup</span>
                <span className="text-[#FCFDFC] font-bold">{inv.lockup_months} months</span>
              </div>
              <div className="flex justify-between py-2 border-b border-[#333333]">
                <span className="text-[#FCFDFC] opacity-60">Liquidity</span>
                <span className="text-[#FCFDFC] font-bold">{inv.liquidity}</span>
              </div>
              <div className="flex justify-between py-2">
                <span className="text-[#FCFDFC] opacity-60">DD Score</span>
                <span className="text-[#FCFDFC] font-bold">{inv.due_diligence_score}/100</span>
              </div>
              {inv.target_yield > 0 && (
                <div className="flex justify-between py-2">
                  <span className="text-[#FCFDFC] opacity-60">Target Yield</span>
                  <span className="text-[#FCFDFC] font-bold">{pct(inv.target_yield)}</span>
                </div>
              )}
            </div>
          </div>

          {suitability && (
            <div className={`rounded-lg p-6 mb-6 ${suitability.recommendation === 'suitable' ? 'bg-green-900/30 border-2 border-green-400' : 'bg-yellow-900/30 border-2 border-yellow-400'}`}>
              <h3 className="text-lg font-bold text-[#FCFDFC] mb-3 flex items-center gap-2">
                {suitability.recommendation === 'suitable' ? <CheckCircle className="w-5 h-5 text-green-400" /> : <AlertTriangle className="w-5 h-5 text-yellow-400" />}
                Suitability Check
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-[#FCFDFC] opacity-80">Portfolio Value:</span>
                  <span className="text-[#FCFDFC] font-bold">${fmt(suitability.portfolioValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FCFDFC] opacity-80">Minimum Investment:</span>
                  <span className="text-[#FCFDFC] font-bold">${fmt(suitability.minimumInvestment)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FCFDFC] opacity-80">Max Alt Allocation (20%):</span>
                  <span className="text-[#FCFDFC] font-bold">${fmt(suitability.maxAltAllocation)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#FCFDFC] opacity-80">Existing Alts:</span>
                  <span className="text-[#FCFDFC] font-bold">${fmt(suitability.existingAltAllocations)}</span>
                </div>
                <div className="flex justify-between col-span-2">
                  <span className="text-[#FCFDFC] opacity-80">Remaining Capacity:</span>
                  <span className={`font-bold ${suitability.hasCapacity ? 'text-green-400' : 'text-yellow-400'}`}>
                    ${fmt(suitability.remainingCapacity)}
                  </span>
                </div>
              </div>
              <p className="text-[#FCFDFC] mt-4">
                {suitability.recommendation === 'suitable' 
                  ? '✓ This investment is suitable for this client based on portfolio size and existing alternative allocations.'
                  : '⚠️ This investment may exceed recommended alternative allocation limits. Consider reducing existing alternatives or increasing portfolio size.'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Marketplace view
  return (
    <div className="min-h-screen bg-[#333333] p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('home')} className="text-[#FCFDFC] opacity-60 hover:opacity-100"><ArrowLeft className="w-5 h-5" /></button>
            <h1 className="text-3xl font-bold text-[#FCFDFC]">🚀 Beyond Marketplace</h1>
          </div>
        </div>

        {/* Categories */}
        <div className="flex gap-3 mb-8 overflow-x-auto pb-2">
          <button
            onClick={() => { setSelectedCategory(null); loadInvestments(); }}
            className={`px-4 py-2 rounded-lg whitespace-nowrap ${!selectedCategory ? 'bg-[#1a7a82] text-[#FCFDFC]' : 'bg-[#5b6a71] text-[#FCFDFC] opacity-60'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat.category}
              onClick={() => { setSelectedCategory(cat.category); loadInvestments(); }}
              className={`px-4 py-2 rounded-lg whitespace-nowrap ${selectedCategory === cat.category ? 'bg-[#1a7a82] text-[#FCFDFC]' : 'bg-[#5b6a71] text-[#FCFDFC] opacity-60'}`}
            >
              {cat.label} ({cat.count})
            </button>
          ))}
        </div>

        {/* Current Allocations */}
        {allocations.length > 0 && (
          <div className="bg-[#5b6a71] rounded-lg p-6 mb-8">
            <h2 className="text-xl font-bold text-[#FCFDFC] mb-4">Your Allocations</h2>
            <div className="grid grid-cols-3 gap-4">
              {allocations.map((a, i) => (
                <div key={i} className="bg-[#333333] rounded-lg p-4">
                  <p className="text-[#FCFDFC] font-bold">{a.name}</p>
                  <p className="text-[#1a7a82] text-xl font-bold">${fmt(a.amount)}</p>
                  <p className="text-[#FCFDFC] opacity-60 text-sm">{CATEGORY_LABELS[a.category]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Investment Cards */}
        <div className="grid grid-cols-3 gap-6">
          {investments.map((inv) => (
            <div key={inv.id} className="bg-[#5b6a71] rounded-lg p-6 hover:bg-[#5b6a71]/80 cursor-pointer transition" onClick={() => { setSelectedInvestment(inv); setView('detail'); }}>
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-[#FCFDFC]">{inv.name}</h3>
                <span className={`text-xs px-2 py-1 rounded ${RISK_COLORS[inv.risk_rating]} bg-black/20`}>
                  {inv.risk_rating.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[#FCFDFC] opacity-60 text-sm mb-4">{CATEGORY_LABELS[inv.category]}</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-[#FCFDFC]">
                  <span className="opacity-60">Target Return:</span>
                  <span className="font-bold">{pct(inv.target_return)}</span>
                </div>
                <div className="flex justify-between text-[#FCFDFC]">
                  <span className="opacity-60">Minimum:</span>
                  <span className="font-bold">${fmt(inv.minimum_investment)}</span>
                </div>
                <div className="flex justify-between text-[#FCFDFC]">
                  <span className="opacity-60">Lockup:</span>
                  <span className="font-bold">{inv.lockup_months}mo</span>
                </div>
                <div className="flex justify-between text-[#FCFDFC]">
                  <span className="opacity-60">DD Score:</span>
                  <span className="font-bold">{inv.due_diligence_score}/100</span>
                </div>
              </div>
              <button className="w-full mt-4 px-4 py-2 bg-[#1a7a82] text-[#FCFDFC] rounded-lg text-sm font-medium">View Details</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
