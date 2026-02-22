import { useState } from 'react';
import { AlertTriangle, TrendingUp, Shield } from 'lucide-react';

const questions = [
  {
    id: 'timeHorizon',
    question: 'What is your investment time horizon?',
    options: [
      { value: 1, label: 'Less than 3 years', score: 1 },
      { value: 2, label: '3-5 years', score: 2 },
      { value: 3, label: '5-10 years', score: 3 },
      { value: 4, label: '10-20 years', score: 4 },
      { value: 5, label: 'More than 20 years', score: 5 },
    ],
  },
  {
    id: 'marketDrop',
    question: 'If your portfolio dropped 20% in value, what would you do?',
    options: [
      { value: 1, label: 'Sell everything immediately', score: 1 },
      { value: 2, label: 'Sell some investments', score: 2 },
      { value: 3, label: 'Hold and wait', score: 3 },
      { value: 4, label: 'Buy more at lower prices', score: 4 },
      { value: 5, label: 'Aggressively buy more', score: 5 },
    ],
  },
  {
    id: 'experience',
    question: 'How would you describe your investment experience?',
    options: [
      { value: 1, label: 'No experience', score: 1 },
      { value: 2, label: 'Limited experience', score: 2 },
      { value: 3, label: 'Moderate experience', score: 3 },
      { value: 4, label: 'Experienced investor', score: 4 },
      { value: 5, label: 'Professional/Expert', score: 5 },
    ],
  },
  {
    id: 'priority',
    question: 'What is your primary investment goal?',
    options: [
      { value: 1, label: 'Preserve capital at all costs', score: 1 },
      { value: 2, label: 'Generate steady income', score: 2 },
      { value: 3, label: 'Balance growth and stability', score: 3 },
      { value: 4, label: 'Grow wealth aggressively', score: 4 },
      { value: 5, label: 'Maximize returns, accept high risk', score: 5 },
    ],
  },
  {
    id: 'reaction',
    question: 'How do you feel about market volatility?',
    options: [
      { value: 1, label: 'Very uncomfortable, causes stress', score: 1 },
      { value: 2, label: 'Somewhat uncomfortable', score: 2 },
      { value: 3, label: 'Neutral, part of investing', score: 3 },
      { value: 4, label: 'Comfortable, see opportunities', score: 4 },
      { value: 5, label: 'Excited by opportunities', score: 5 },
    ],
  },
];

export default function RiskAssessment({ data, onUpdate, onNext, onPrev }) {
  const [answers, setAnswers] = useState(data.riskProfile?.answers || {});

  const handleAnswer = (questionId, option) => {
    setAnswers({ ...answers, [questionId]: option });
  };

  const calculateRiskScore = () => {
    const scores = Object.values(answers).map(a => a.score);
    if (scores.length === 0) return 0;
    const total = scores.reduce((sum, score) => sum + score, 0);
    return Math.round((total / (questions.length * 5)) * 100);
  };

  const getRiskLevel = (score) => {
    if (score <= 20) return { label: 'Conservative', color: 'green', icon: Shield };
    if (score <= 40) return { label: 'Moderately Conservative', color: 'blue', icon: Shield };
    if (score <= 60) return { label: 'Moderate', color: 'yellow', icon: TrendingUp };
    if (score <= 80) return { label: 'Moderately Aggressive', color: 'orange', icon: TrendingUp };
    return { label: 'Aggressive', color: 'red', icon: AlertTriangle };
  };

  const allAnswered = Object.keys(answers).length === questions.length;
  const riskScore = calculateRiskScore();
  const riskLevel = getRiskLevel(riskScore);
  const Icon = riskLevel.icon;

  const handleContinue = () => {
    if (!allAnswered) {
      alert('Please answer all questions to continue');
      return;
    }
    onUpdate('riskProfile', { answers, score: riskScore, level: riskLevel.label });
    onNext();
  };

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Risk Assessment</h2>
        <p className="text-slate-600">Answer these questions to determine your client's risk tolerance.</p>
      </div>

      {/* Questions */}
      <div className="space-y-8 mb-8">
        {questions.map((q, index) => (
          <div key={q.id} className="p-6 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold mr-3">
                {index + 1}
              </div>
              <h3 className="text-lg font-semibold text-slate-900 pt-1">{q.question}</h3>
            </div>
            <div className="space-y-2 ml-11">
              {q.options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleAnswer(q.id, option)}
                  className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all ${
                    answers[q.id]?.value === option.value
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-slate-200 bg-white hover:border-blue-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Risk Score Display */}
      {allAnswered && (
        <div className="mb-8 p-8 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border-2 border-blue-200">
          <div className="text-center">
            <div className="flex items-center justify-center mb-4">
              <Icon className={`w-16 h-16 text-${riskLevel.color}-600`} />
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Risk Profile: {riskLevel.label}</h3>
            <div className="text-5xl font-bold text-blue-600 mb-4">{riskScore}/100</div>
            <p className="text-slate-600 max-w-2xl mx-auto">
              This score represents your client's behavioral risk tolerance based on their responses.
              We'll compare this with their financial capacity in the next step.
            </p>
          </div>

          {/* Score Bar */}
          <div className="mt-6">
            <div className="h-4 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500`}
                style={{ width: `${riskScore}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-slate-600">
              <span>Conservative</span>
              <span>Moderate</span>
              <span>Aggressive</span>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-slate-200">
        <button
          onClick={onPrev}
          className="px-8 py-3 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
        >
          Back
        </button>
        <button
          onClick={handleContinue}
          disabled={!allAnswered}
          className="px-8 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
        >
          Run Monte Carlo Projection
        </button>
      </div>
    </div>
  );
}
