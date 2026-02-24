/**
 * Risk Profile Questionnaire - Dynamic Interview UI
 * 
 * Features:
 * - Predictive prefetching (generates next question as user selects answer)
 * - Smooth animations
 * - Progress tracking
 * - Farther branding
 */

import React, { useState, useEffect, useRef } from 'react';
import type { Question, Answer, QuestionHistory, InterviewContext } from '../types/risk';
import {
  generateNextQuestion,
  getInitialQuestion,
  determineWealthTier,
} from '../services/riskInterviewService';

interface Props {
  onComplete: (questionHistory: QuestionHistory[]) => void;
  onCancel: () => void;
}

export default function RiskQuestionnaire({ onComplete, onCancel }: Props) {
  const [currentQuestion, setCurrentQuestion] = useState<Question>(getInitialQuestion());
  const [questionHistory, setQuestionHistory] = useState<QuestionHistory[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [prefetchedQuestion, setPrefetchedQuestion] = useState<Question | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [wealthTier, setWealthTier] = useState<Question['wealthTier']>('affluent');
  
  // Refs for race condition prevention
  const prefetchAnswerRef = useRef<string | null>(null);
  const currentQuestionNumberRef = useRef(1);

  const maxQuestions = 15;
  const progress = (questionHistory.length / maxQuestions) * 100;

  /**
   * Handle option selection
   */
  const handleSelect = (optionId: string) => {
    setSelectedOption(optionId);
    
    // Start prefetching next question immediately
    if (questionHistory.length + 1 < maxQuestions) {
      prefetchNextQuestion(optionId);
    }
  };

  /**
   * Prefetch next question (zero latency UX)
   */
  const prefetchNextQuestion = async (selectedOptionId: string) => {
    // Prevent race conditions
    if (prefetchAnswerRef.current === selectedOptionId) {
      return; // Already prefetching for this answer
    }
    
    prefetchAnswerRef.current = selectedOptionId;
    
    try {
      // Build tentative answer
      const tentativeAnswer: Answer = {
        questionId: currentQuestion.id,
        optionId: selectedOptionId,
        score: currentQuestion.options.find(o => o.id === selectedOptionId)?.score || 0,
        timestamp: Date.now(),
      };
      
      // Build tentative history
      const tentativeHistory: QuestionHistory[] = [
        ...questionHistory,
        {
          question: currentQuestion,
          answer: tentativeAnswer,
        },
      ];
      
      // Build context
      const context: InterviewContext = {
        answers: tentativeHistory.map(h => h.answer),
        questionHistory: tentativeHistory,
        currentWealthTier: wealthTier,
        currentExperience: 'intermediate', // TODO: Extract from history
      };
      
      // Generate next question
      const nextQ = await generateNextQuestion(context, questionHistory.length + 2);
      
      // Only set if user hasn't changed their selection
      if (prefetchAnswerRef.current === selectedOptionId) {
        setPrefetchedQuestion(nextQ);
      }
    } catch (error) {
      console.error('[Questionnaire] Prefetch error:', error);
      // Silently fail - will fetch on-demand if needed
    }
  };

  /**
   * Confirm answer and move to next question
   */
  const handleNext = async () => {
    if (!selectedOption) return;
    
    setIsTransitioning(true);
    
    try {
      // Record answer
      const answer: Answer = {
        questionId: currentQuestion.id,
        optionId: selectedOption,
        score: currentQuestion.options.find(o => o.id === selectedOption)?.score || 0,
        timestamp: Date.now(),
      };
      
      // Update history
      const newHistory: QuestionHistory[] = [
        ...questionHistory,
        {
          question: currentQuestion,
          answer,
        },
      ];
      
      setQuestionHistory(newHistory);
      
      // Extract wealth tier from Q1
      if (currentQuestion.id === 'Q1') {
        const tier = determineWealthTier(selectedOption);
        setWealthTier(tier);
      }
      
      // Check if done
      if (newHistory.length >= maxQuestions) {
        onComplete(newHistory);
        return;
      }
      
      // Use prefetched question if available
      let nextQuestion: Question;
      
      if (prefetchedQuestion && prefetchAnswerRef.current === selectedOption) {
        nextQuestion = prefetchedQuestion;
      } else {
        // Fallback: fetch on-demand
        setIsLoading(true);
        const context: InterviewContext = {
          answers: newHistory.map(h => h.answer),
          questionHistory: newHistory,
          currentWealthTier: wealthTier,
          currentExperience: 'intermediate',
        };
        nextQuestion = await generateNextQuestion(context, newHistory.length + 1);
        setIsLoading(false);
      }
      
      // Transition to next question
      currentQuestionNumberRef.current++;
      setCurrentQuestion(nextQuestion);
      setSelectedOption(null);
      setPrefetchedQuestion(null);
      prefetchAnswerRef.current = null;
      
    } catch (error) {
      console.error('[Questionnaire] Error:', error);
      alert('Failed to load next question. Please try again.');
    } finally {
      setIsTransitioning(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#333333] flex items-center justify-center p-4">
      <div className="max-w-3xl w-full">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white mb-2">
            Risk Profile Questionnaire
          </h1>
          <p className="text-[#6d9dbe]">
            Question {questionHistory.length + 1} of {maxQuestions}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="w-full h-2 bg-[#5b6a71] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1a7a82] transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-[#5b6a71] rounded-lg p-8 border border-[#6d9dbe]/20 mb-6">
          {/* Section Badge */}
          <div className="mb-4">
            <span className="px-3 py-1 bg-[#333333] text-[#6d9dbe] text-sm rounded-full">
              {currentQuestion.section}
            </span>
          </div>

          {/* Question Text */}
          <h2 className="text-2xl font-bold text-white mb-6">
            {currentQuestion.text}
          </h2>

          {/* Options */}
          <div className="space-y-3">
            {currentQuestion.options.map((option) => (
              <button
                key={option.id}
                onClick={() => handleSelect(option.id)}
                disabled={isTransitioning}
                className={`
                  w-full text-left p-4 rounded-lg border-2 transition-all
                  ${
                    selectedOption === option.id
                      ? 'border-[#1a7a82] bg-[#1a7a82]/10'
                      : 'border-[#6d9dbe]/20 hover:border-[#6d9dbe] hover:bg-[#6d9dbe]/5'
                  }
                  ${isTransitioning ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
              >
                <div className="flex items-start">
                  <div className="flex-shrink-0 mt-1">
                    <div
                      className={`
                        w-5 h-5 rounded-full border-2 transition-colors
                        ${
                          selectedOption === option.id
                            ? 'border-[#1a7a82] bg-[#1a7a82]'
                            : 'border-[#6d9dbe]'
                        }
                      `}
                    >
                      {selectedOption === option.id && (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="w-2 h-2 bg-white rounded-full" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="ml-3">
                    <p className="text-white font-medium">{option.text}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={onCancel}
            className="px-6 py-3 text-[#6d9dbe] hover:text-white transition"
          >
            ← Cancel
          </button>

          <button
            onClick={handleNext}
            disabled={!selectedOption || isTransitioning || isLoading}
            className={`
              px-8 py-3 rounded-lg font-medium transition
              ${
                selectedOption && !isTransitioning && !isLoading
                  ? 'bg-[#1a7a82] text-white hover:bg-[#1a7a82]/80 cursor-pointer'
                  : 'bg-[#5b6a71] text-[#6d9dbe] cursor-not-allowed opacity-50'
              }
            `}
          >
            {isLoading ? (
              <span className="flex items-center">
                <svg
                  className="animate-spin h-5 w-5 mr-2"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Loading...
              </span>
            ) : questionHistory.length + 1 >= maxQuestions ? (
              'Finish'
            ) : (
              'Next →'
            )}
          </button>
        </div>

        {/* Rationale (if available) */}
        {currentQuestion.rationale && (
          <div className="mt-6 p-4 bg-[#333333] rounded-lg border border-[#6d9dbe]/20">
            <p className="text-[#6d9dbe] text-sm">
              <span className="font-medium">Why this question:</span> {currentQuestion.rationale}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
