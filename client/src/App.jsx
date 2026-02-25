/**
 * Farther Financial Path - Main App
 * 
 * Multi-tool platform with centralized navigation:
 * - Dashboard (landing page / tool selector)
 * - Financial Planning (institutional-grade)
 * - Portfolio Analysis (coming soon)
 * - Risk Assessment
 * - Client Proposals (coming soon)
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// Components
import Dashboard from './components/Dashboard';
import PlanningWizard from './components/PlanningWizard';
import RiskAssessment from './components/RiskAssessment';
import ProposifyBuilder from './components/ProposifyBuilder';
import FocusDashboard from './components/FocusDashboard';
import ErrorBoundary from './components/ErrorBoundary';

// Future tools (placeholders)
const ComingSoon = ({ toolName }) => (
  <div className="min-h-screen bg-[#333333] flex items-center justify-center">
    <div className="text-center">
      <div className="text-6xl mb-4">🚧</div>
      <h1 className="text-3xl font-bold text-white mb-2">{toolName}</h1>
      <p className="text-[#6d9dbe]">Coming soon...</p>
      <a
        href="/"
        className="inline-block mt-6 px-6 py-3 bg-[#1a7a82] text-white rounded hover:bg-[#1a7a82]/80 transition"
      >
        ← Back to Dashboard
      </a>
    </div>
  </div>
);

function App() {
  console.log('[App] Initializing router');
  
  return (
    <ErrorBoundary>
      <Router>
      <Routes>
        {/* Landing Page - Dashboard */}
        <Route path="/" element={<Dashboard />} />

        {/* Financial Planning - Full Wizard */}
        <Route path="/planning" element={<PlanningWizard />} />

        {/* Risk Assessment */}
        <Route path="/risk" element={<RiskAssessment />} />

        {/* Proposify */}
        <Route path="/proposify" element={<ProposifyBuilder />} />

        {/* Focus - Portfolio Analytics */}
        <Route path="/portfolio" element={<FocusDashboard />} />
        <Route path="/reports" element={<ComingSoon toolName="Narrative" />} />
        <Route path="/alternatives" element={<ComingSoon toolName="Beyond" />} />

        {/* 404 Redirect */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
    </ErrorBoundary>
  );
}

export default App;
