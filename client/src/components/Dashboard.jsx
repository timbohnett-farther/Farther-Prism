/**
 * Farther Prism - Dashboard
 * 
 * Farther logo header + 6 tool cards (Prism image is card #1)
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const Dashboard = () => {
  const navigate = useNavigate();

  const tools = [
    {
      id: 'prism',
      name: 'Prism',
      type: 'image-card', // Special card type
      route: '/planning',
      status: 'active',
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
      ],
    },
    {
      id: 'risk',
      name: 'Risk Assessment',
      description: 'AI-powered adaptive questionnaire with dual-dimension scoring',
      icon: '⚖️',
      route: '/risk',
      status: 'active',
      features: [
        'Behavioral risk tolerance',
        'Financial risk capacity',
        'Behavioral Investor Type',
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
        'E-signature integration',
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
        'Compliance-ready exports',
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
      {/* Header with Farther Logo */}
      <header className="bg-[#333333] border-b border-[#5b6a71]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-center">
            <img 
              src="/farther-wordmark.png" 
              alt="Farther" 
              className="h-12 w-auto"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Section Header - Logo & Tagline */}
        <div className="mb-12 text-center">
          <div className="flex justify-center mb-6">
            <img 
              src="/farther-logo-main.png" 
              alt="Farther" 
              className="h-24 w-auto"
            />
          </div>
          <p className="text-[#FCFDFC] text-lg max-w-3xl mx-auto opacity-90 leading-relaxed">
            An Intelligent Wealth Platform that unifies planning, portfolios, risk, proposals, reporting, and alternatives - so you can see clearly and go
          </p>
        </div>

        {/* Tools Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tools.map((tool) => {
            // Special card: Prism image with glass button BELOW
            if (tool.type === 'image-card') {
              return (
                <div
                  key={tool.id}
                  onClick={() => handleToolClick(tool)}
                  className="rounded-lg overflow-hidden cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-2xl bg-[#5b6a71]"
                >
                  {/* Prism Image - Full size, no cropping */}
                  <div className="w-full">
                    <img 
                      src="/prism-hero.jpg" 
                      alt="Prism Planning Tool"
                      className="w-full h-auto object-contain"
                      style={{ display: 'block' }}
                    />
                  </div>
                  
                  {/* Glass Button BELOW Image */}
                  <div className="p-6 flex items-center justify-center">
                    <button className="group relative px-10 py-4 text-xl font-light tracking-wide text-[#FCFDFC] transition-all duration-300 hover:scale-105">
                      {/* Glass background */}
                      <div className="absolute inset-0 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 shadow-2xl transition-all duration-300 group-hover:bg-white/20 group-hover:border-white/30" />
                      
                      {/* Shine effect */}
                      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shine" />
                      </div>
                      
                      {/* Button text */}
                      <span className="relative z-10">Begin Planning</span>
                    </button>
                  </div>
                </div>
              );
            }

            // Regular tool cards
            return (
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
                      <span className="px-2 py-1 bg-[#1a7a82] text-[#FCFDFC] text-xs rounded">
                        Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 bg-[#333333] text-[#FCFDFC] text-xs rounded opacity-70">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>

                {/* Tool Info */}
                <h3 className="text-xl font-bold text-[#FCFDFC] mb-2">
                  {tool.name}
                </h3>
                <p className="text-[#FCFDFC] opacity-80 text-sm mb-4">
                  {tool.description}
                </p>

                {/* Features List */}
                <ul className="space-y-2">
                  {tool.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start text-sm text-[#FCFDFC] opacity-70">
                      <span className="mr-2">•</span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* Action Button */}
                {tool.status === 'active' && (
                  <div className="mt-6">
                    <button className="w-full px-4 py-2 bg-[#1a7a82] text-[#FCFDFC] rounded hover:bg-[#1a7a82]/80 transition font-medium">
                      Open Tool →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-[#333333] border-t border-[#5b6a71] mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <img 
                src="/farther-symbol.png" 
                alt="Farther" 
                className="h-6 w-auto opacity-60"
              />
              <div className="text-[#FCFDFC] text-sm opacity-60">
                © 2026 Farther, Inc. All rights reserved.
              </div>
            </div>
            <div className="flex space-x-6 text-sm">
              <a href="#" className="text-[#FCFDFC] opacity-60 hover:opacity-100 transition">Documentation</a>
              <a href="#" className="text-[#FCFDFC] opacity-60 hover:opacity-100 transition">API</a>
              <a href="#" className="text-[#FCFDFC] opacity-60 hover:opacity-100 transition">Support</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Dashboard;
