/**
 * Risk Assessment - Main Container
 * 
 * Orchestrates the AI-driven risk profile questionnaire:
 * 1. Welcome screen
 * 2. Dynamic questionnaire
 * 3. Results dashboard
 */

import { useState } from 'react';
import RiskQuestionnaire from './RiskQuestionnaire';
import RiskResults from './RiskResults';
import { calculateAssessment } from '../services/riskScoringService';

export default function RiskAssessment() {
  const [view, setView] = useState('welcome'); // welcome | questionnaire | results
  const [assessmentResult, setAssessmentResult] = useState(null);

  const handleStart = () => {
    setView('questionnaire');
  };

  const handleComplete = (questionHistory) => {
    // Calculate scores and generate result
    const result = calculateAssessment(questionHistory);
    setAssessmentResult(result);
    setView('results');
  };

  const handleRestart = () => {
    setAssessmentResult(null);
    setView('welcome');
  };

  const handleClose = () => {
    // TODO: Save to database
    console.log('[Risk Assessment] Saving result:', assessmentResult);
    alert('Assessment saved! (TODO: Implement database save)');
    window.location.href = '/'; // Return to dashboard
  };

  const handleCancel = () => {
    if (confirm('Are you sure you want to cancel? Your progress will be lost.')) {
      setView('welcome');
    }
  };

  // Welcome Screen
  if (view === 'welcome') {
    return (
      <div className="min-h-screen bg-[#333333] flex items-center justify-center p-4">
        <div className="max-w-4xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            <img 
              src="/farther-wordmark.png" 
              alt="Farther" 
              className="h-12 w-auto mx-auto mb-6 opacity-80"
            />
            <h1 className="text-4xl font-bold text-white mb-4">
              Risk Profile Questionnaire
            </h1>
            <p className="text-[#6d9dbe] text-lg">
              AI-powered adaptive assessment to determine your ideal investment strategy
            </p>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
              <div className="text-3xl mb-3">🎯</div>
              <h3 className="text-white font-bold mb-2">Adaptive Questions</h3>
              <p className="text-[#ffffff] opacity-80 text-sm">
                AI generates contextual questions based on your wealth tier and experience
              </p>
            </div>

            <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
              <div className="text-3xl mb-3">⚡</div>
              <h3 className="text-white font-bold mb-2">Zero Latency</h3>
              <p className="text-[#ffffff] opacity-80 text-sm">
                Predictive prefetching ensures instant transitions between questions
              </p>
            </div>

            <div className="bg-[#5b6a71] rounded-lg p-6 border border-[#6d9dbe]/20">
              <div className="text-3xl mb-3">📊</div>
              <h3 className="text-white font-bold mb-2">Dual-Dimension Scoring</h3>
              <p className="text-[#ffffff] opacity-80 text-sm">
                Measures both financial capacity and behavioral willingness to take risk
              </p>
            </div>
          </div>

          {/* What to Expect */}
          <div className="bg-[#5b6a71] rounded-lg p-8 border border-[#6d9dbe]/20 mb-8">
            <h2 className="text-2xl font-bold text-white mb-4">What to Expect</h2>
            <div className="space-y-4 text-[#ffffff] opacity-80">
              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a7a82] flex items-center justify-center text-white font-bold mr-3">
                  1
                </div>
                <div>
                  <div className="font-bold text-white">15 Questions</div>
                  <div className="text-sm">Takes approximately 5-7 minutes</div>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a7a82] flex items-center justify-center text-white font-bold mr-3">
                  2
                </div>
                <div>
                  <div className="font-bold text-white">Adaptive Flow</div>
                  <div className="text-sm">Questions adapt based on your answers and profile</div>
                </div>
              </div>

              <div className="flex items-start">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a7a82] flex items-center justify-center text-white font-bold mr-3">
                  3
                </div>
                <div>
                  <div className="font-bold text-white">Comprehensive Results</div>
                  <div className="text-sm">
                    Detailed breakdown with Behavioral Investor Type, recommended allocation, and compliance trail
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="text-center">
            <button
              onClick={handleStart}
              className="px-12 py-4 bg-[#1a7a82] text-white text-lg font-bold rounded-lg hover:bg-[#1a7a82]/80 transition"
            >
              Start Assessment →
            </button>
            <p className="text-[#6d9dbe] text-sm mt-4">
              This assessment is compliant with DOL PTE 2020-02
            </p>
          </div>

          {/* Footer */}
          <div className="mt-12 text-center">
            <a
              href="/"
              className="text-[#6d9dbe] hover:text-white transition"
            >
              ← Back to Dashboard
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Questionnaire View
  if (view === 'questionnaire') {
    return (
      <RiskQuestionnaire
        onComplete={handleComplete}
        onCancel={handleCancel}
      />
    );
  }

  // Results View
  if (view === 'results' && assessmentResult) {
    return (
      <RiskResults
        result={assessmentResult}
        onRestart={handleRestart}
        onClose={handleClose}
      />
    );
  }

  return null;
}
