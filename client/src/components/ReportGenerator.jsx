import { FileText, Download, Mail, CheckCircle } from 'lucide-react';

export default function ReportGenerator({ data, onPrev }) {
  const { clientData, portfolio, riskProfile, monteCarloResults } = data;
  
  const totalValue = portfolio.reduce((sum, h) => sum + h.value, 0);
  const successRate = monteCarloResults?.results?.successRate || 0;

  const handleDownloadPDF = () => {
    alert('PDF generation coming soon!');
  };

  const handleEmailReport = () => {
    alert('Email functionality coming soon!');
  };

  return (
    <div>
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
          <CheckCircle className="w-12 h-12 text-green-600" />
        </div>
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Analysis Complete!</h2>
        <p className="text-slate-600">
          Your comprehensive risk assessment and projection report is ready.
        </p>
      </div>

      {/* Report Summary */}
      <div className="bg-white rounded-lg border-2 border-slate-200 shadow-lg p-8 mb-8">
        <h3 className="text-2xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-200">
          Executive Summary
        </h3>

        {/* Client Info */}
        <div className="mb-6">
          <h4 className="text-lg font-semibold text-slate-900 mb-3">Client Information</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Name:</span>
              <span className="ml-2 font-medium text-slate-900">
                {clientData.firstName} {clientData.lastName}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Age:</span>
              <span className="ml-2 font-medium text-slate-900">{clientData.age}</span>
            </div>
            <div>
              <span className="text-slate-600">Target Retirement:</span>
              <span className="ml-2 font-medium text-slate-900">{clientData.retirementAge}</span>
            </div>
            <div>
              <span className="text-slate-600">Years to Retirement:</span>
              <span className="ml-2 font-medium text-slate-900">
                {clientData.retirementAge - clientData.age} years
              </span>
            </div>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-3">Portfolio Summary</h4>
          <div className="bg-slate-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <span className="text-slate-600">Total Portfolio Value:</span>
              <span className="text-2xl font-bold text-slate-900">
                ${totalValue.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Number of Holdings:</span>
              <span className="font-medium text-slate-900">{portfolio.length}</span>
            </div>
          </div>
        </div>

        {/* Risk Assessment */}
        <div className="mb-6 pb-6 border-b border-slate-200">
          <h4 className="text-lg font-semibold text-slate-900 mb-3">Risk Profile</h4>
          <div className="flex items-center justify-between bg-blue-50 p-4 rounded-lg">
            <div>
              <div className="text-sm text-slate-600 mb-1">Behavioral Risk Tolerance</div>
              <div className="text-2xl font-bold text-blue-600">{riskProfile.level}</div>
            </div>
            <div className="text-5xl font-bold text-blue-600">{riskProfile.score}/100</div>
          </div>
        </div>

        {/* Monte Carlo Results */}
        <div>
          <h4 className="text-lg font-semibold text-slate-900 mb-3">Projection Results</h4>
          <div className={`p-6 rounded-lg ${
            successRate >= 75 ? 'bg-green-50' : 'bg-orange-50'
          }`}>
            <div className="grid grid-cols-3 gap-6 mb-4">
              <div>
                <div className="text-sm text-slate-600 mb-1">Success Rate</div>
                <div className={`text-3xl font-bold ${
                  successRate >= 75 ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {successRate.toFixed(1)}%
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">Median Outcome</div>
                <div className="text-2xl font-bold text-slate-900">
                  ${(monteCarloResults.results.medianFinalValue / 1000000).toFixed(2)}M
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-600 mb-1">Time Horizon</div>
                <div className="text-2xl font-bold text-slate-900">
                  {monteCarloResults.parameters.years} years
                </div>
              </div>
            </div>
            <div className={`text-sm ${
              successRate >= 75 ? 'text-green-700' : 'text-orange-700'
            }`}>
              {successRate >= 75
                ? '✓ Portfolio is well-positioned to meet retirement goals'
                : '⚠ Portfolio may need adjustments to meet retirement goals'
              }
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <button
          onClick={handleDownloadPDF}
          className="flex items-center justify-center px-6 py-4 bg-farther-navy text-white font-semibold rounded-lg hover:bg-farther-blue transition-all shadow-md hover:shadow-xl"
        >
          <Download className="w-5 h-5 mr-2" />
          Download PDF Report
        </button>
        <button
          onClick={handleEmailReport}
          className="flex items-center justify-center px-6 py-4 bg-farther-gold text-farther-navy font-semibold rounded-lg hover:bg-farther-lightGold transition-all shadow-md hover:shadow-xl"
        >
          <Mail className="w-5 h-5 mr-2" />
          Email to Client
        </button>
      </div>

      {/* Compliance Footer */}
      <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 mb-8">
        <h4 className="font-semibold text-slate-900 mb-2 text-sm">Important Disclosure</h4>
        <p className="text-xs text-slate-600 leading-relaxed">
          This analysis is provided for informational purposes only and does not constitute investment advice or a 
          recommendation. Monte Carlo simulations are based on historical market data and assumptions that may not 
          reflect future market conditions. Past performance does not guarantee future results. The projections shown 
          represent hypothetical outcomes and actual results may vary significantly. This report was generated using 
          Farther Prism, an AI-powered risk assessment tool. Please consult with a qualified financial advisor before 
          making any investment decisions.
        </p>
      </div>

      {/* Navigation */}
      <div className="flex justify-between pt-6 border-t border-slate-200">
        <button
          onClick={onPrev}
          className="px-8 py-3 border-2 border-farther-navy text-farther-navy font-semibold rounded-lg hover:bg-farther-gray-50 transition-all"
        >
          ← Back to Results
        </button>
        <button
          onClick={() => window.location.reload()}
          className="px-8 py-3 bg-farther-gold text-farther-navy font-semibold rounded-lg hover:bg-farther-lightGold transition-all shadow-md hover:shadow-xl"
        >
          Start New Analysis
        </button>
      </div>
    </div>
  );
}
