/**
 * Farther Financial Path - Main Dashboard
 * 
 * Central hub for all advisor tools:
 * - Financial Planning
 * - Portfolio Analysis
 * - Risk Assessment
 * - Client Proposals
 * - [Future Tools]
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();
  const [selectedHousehold, setSelectedHousehold] = useState(null);

  const tools = [
    {
      id: 'planning',
      name: 'Financial Planning',
      description: 'Institutional-grade planning engine with Monte Carlo projections',
      icon: '📊',
      route: '/planning',
      status: 'active',
      features: [
        'Monthly cash flow projections',
        'Tax-optimized withdrawals',
        'RMD & Roth conversion analysis',
        'Monte Carlo simulation (10K paths)',
        'IRMAA & NIIT modeling',
      ],
    },
    {
      id: 'portfolio',
      name: 'Portfolio Analysis',
      description: 'Performance attribution, rebalancing, and tax-loss harvesting',
      icon: '📈',
      route: '/portfolio',
      status: 'coming_soon',
      features: [
        'Performance attribution',
        'Asset allocation analysis',
        'Tax-loss harvesting opportunities',
        'Rebalancing recommendations',
        'Fee analysis & benchmarking',
      ],
    },
    {
      id: 'risk',
      name: 'Risk Assessment',
      description: 'Dual-dimension risk model (willingness + capacity)',
      icon: '⚖️',
      route: '/risk',
      status: 'active',
      features: [
        'Behavioral risk tolerance (Prospect Theory)',
        'Financial risk capacity (Arrow-Pratt)',
        'Recommended allocation',
        'Stress testing',
        'Drawdown analysis',
      ],
    },
    {
      id: 'proposals',
      name: 'Client Proposals',
      description: 'Branded pitch decks, fee calculators, and engagement letters',
      icon: '📄',
      route: '/proposals',
      status: 'coming_soon',
      features: [
        'Branded proposal templates',
        'Fee calculator & comparison',
        'Service tier breakdown',
        'E-signature integration',
        'CRM sync',
      ],
    },
    {
      id: 'reports',
      name: 'Client Reporting',
      description: 'Performance reports, tax summaries, and compliance exports',
      icon: '📋',
      route: '/reports',
      status: 'coming_soon',
      features: [
        'Quarterly performance reports',
        'Tax gain/loss summaries',
        'Realized gains reports',
        'Compliance-ready exports',
        'White-label branding',
      ],
    },
    {
      id: 'scenarios',
      name: 'What-If Scenarios',
      description: 'Model life events: retirement, home purchase, education funding',
      icon: '🔮',
      route: '/scenarios',
      status: 'coming_soon',
      features: [
        'Early retirement modeling',
        'Home purchase impact',
        'Education funding strategies',
        'Divorce/inheritance scenarios',
        'Business sale planning',
      ],
    },
  ];

  const handleToolClick = (tool) => {
    console.log('[Dashboard] Tool clicked:', tool.name, tool.route, tool.status);
    if (tool.status === 'active') {
      console.log('[Dashboard] Navigating to:', tool.route);
      navigate(tool.route);
    } else {
      console.log('[Dashboard] Tool not active, ignoring click');
    }
  };

  return (
    <div className="min-h-screen bg-[#333333]">
      {/* Header */}
      <header className="bg-[#333333] border-b border-[#5b6a71]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="/farther-wordmark.jpg" 
                alt="Farther" 
                className="h-10 w-auto"
              />
              <div className="h-8 w-px bg-[#5b6a71]"></div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Financial Path
                </h1>
                <p className="mt-1 text-[#6d9dbe]">
                  Institutional-grade tools for modern wealth advisors
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button className="px-4 py-2 bg-[#5b6a71] text-white rounded hover:bg-[#6d9dbe] transition">
                Households
              </button>
              <button className="px-4 py-2 bg-[#5b6a71] text-white rounded hover:bg-[#6d9dbe] transition">
                Settings
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Welcome Section */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-white mb-4">
            Welcome back, Advisor
          </h2>
          <p className="text-[#ffffff] opacity-80">
            Choose a tool to get started. All tools share the same household data and work together seamlessly.
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => (
            <div
              key={tool.id}
              onClick={() => handleToolClick(tool)}
              className={`
                bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20
                transition-all duration-200
                ${tool.status === 'active' 
                  ? 'cursor-pointer hover:border-[#1a7a82] hover:shadow-lg hover:scale-105' 
                  : 'opacity-60 cursor-not-allowed'
                }
              `}
            >
              {/* Tool Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="text-4xl">{tool.icon}</div>
                <div>
                  {tool.status === 'active' ? (
                    <span className="px-2 py-1 bg-[#1a7a82] text-white text-xs rounded">
                      Active
                    </span>
                  ) : (
                    <span className="px-2 py-1 bg-[#333333] text-[#6d9dbe] text-xs rounded">
                      Coming Soon
                    </span>
                  )}
                </div>
              </div>

              {/* Tool Info */}
              <h3 className="text-xl font-bold text-white mb-2">
                {tool.name}
              </h3>
              <p className="text-[#ffffff] opacity-80 text-sm mb-4">
                {tool.description}
              </p>

              {/* Features List */}
              <ul className="space-y-2">
                {tool.features.slice(0, 3).map((feature, idx) => (
                  <li key={idx} className="flex items-start text-sm text-[#6d9dbe]">
                    <span className="mr-2">•</span>
                    <span>{feature}</span>
                  </li>
                ))}
                {tool.features.length > 3 && (
                  <li className="text-sm text-[#6d9dbe] opacity-60">
                    +{tool.features.length - 3} more
                  </li>
                )}
              </ul>

              {/* Action Button */}
              {tool.status === 'active' && (
                <div className="mt-6">
                  <button className="w-full px-4 py-2 bg-[#1a7a82] text-white rounded hover:bg-[#1a7a82]/80 transition font-medium">
                    Open Tool →
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
            <div className="text-2xl font-bold text-white">127</div>
            <div className="text-[#6d9dbe] text-sm mt-1">Active Households</div>
          </div>
          <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
            <div className="text-2xl font-bold text-white">$2.4B</div>
            <div className="text-[#6d9dbe] text-sm mt-1">Assets Under Management</div>
          </div>
          <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
            <div className="text-2xl font-bold text-white">42</div>
            <div className="text-[#6d9dbe] text-sm mt-1">Plans Generated (30d)</div>
          </div>
          <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
            <div className="text-2xl font-bold text-white">94%</div>
            <div className="text-[#6d9dbe] text-sm mt-1">Avg Success Probability</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-12">
          <h3 className="text-xl font-bold text-white mb-4">Recent Activity</h3>
          <div className="bg-[#5b6a71] rounded-lg border border-[#6d9dbe]/20">
            <div className="p-4 border-b border-[#333333]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Smith Family - Financial Plan Updated</div>
                  <div className="text-[#6d9dbe] text-sm mt-1">Monte Carlo run completed • 87% success probability</div>
                </div>
                <div className="text-[#6d9dbe] text-sm">2 hours ago</div>
              </div>
            </div>
            <div className="p-4 border-b border-[#333333]">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Johnson Household - Portfolio Analysis</div>
                  <div className="text-[#6d9dbe] text-sm mt-1">Tax-loss harvesting opportunity: $15K potential savings</div>
                </div>
                <div className="text-[#6d9dbe] text-sm">5 hours ago</div>
              </div>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-white font-medium">Williams Trust - Risk Assessment</div>
                  <div className="text-[#6d9dbe] text-sm mt-1">Capacity score updated: 72 → 68 (market volatility)</div>
                </div>
                <div className="text-[#6d9dbe] text-sm">1 day ago</div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#333333] border-t border-[#5b6a71] mt-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/farther-symbol.jpg" 
                alt="Farther" 
                className="h-6 w-auto opacity-60"
              />
              <div className="text-[#6d9dbe] text-sm">
                © 2026 Farther, Inc. All rights reserved.
              </div>
            </div>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-[#6d9dbe] hover:text-white transition">Documentation</a>
              <a href="#" className="text-[#6d9dbe] hover:text-white transition">API</a>
              <a href="#" className="text-[#6d9dbe] hover:text-white transition">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
