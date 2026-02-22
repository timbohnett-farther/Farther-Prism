import { useState } from 'react';
import { CheckCircle2, Circle } from 'lucide-react';
import ClientOnboarding from './components/ClientOnboarding';
import PortfolioBuilder from './components/PortfolioBuilder';
import RiskAssessment from './components/RiskAssessment';
import MonteCarloResults from './components/MonteCarloResults';
import ReportGenerator from './components/ReportGenerator';

const steps = [
  { id: 1, name: 'Client Info', component: ClientOnboarding },
  { id: 2, name: 'Portfolio', component: PortfolioBuilder },
  { id: 3, name: 'Risk Assessment', component: RiskAssessment },
  { id: 4, name: 'Projection', component: MonteCarloResults },
  { id: 5, name: 'Report', component: ReportGenerator },
];

function App() {
  const [currentStep, setCurrentStep] = useState(1);
  const [clientData, setClientData] = useState({});
  const [portfolio, setPortfolio] = useState([]);
  const [riskProfile, setRiskProfile] = useState({});
  const [monteCarloResults, setMonteCarloResults] = useState(null);

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, steps.length));
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1));

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Farther Prism</h1>
              <p className="text-sm text-slate-600">AI-Powered Risk Assessment & Planning</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-slate-700">
                Step {currentStep} of {steps.length}
              </div>
              <div className="text-xs text-slate-500">{steps[currentStep - 1].name}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Steps */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-12">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <div className="flex flex-col items-center flex-1">
                <div className="flex items-center w-full">
                  <div
                    className={`flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all ${
                      currentStep > step.id
                        ? 'bg-green-500 border-green-500 text-white'
                        : currentStep === step.id
                        ? 'bg-blue-500 border-blue-500 text-white'
                        : 'bg-white border-slate-300 text-slate-400'
                    }`}
                  >
                    {currentStep > step.id ? (
                      <CheckCircle2 className="w-6 h-6" />
                    ) : (
                      <span className="font-semibold">{step.id}</span>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 transition-all ${
                        currentStep > step.id ? 'bg-green-500' : 'bg-slate-300'
                      }`}
                    />
                  )}
                </div>
                <div
                  className={`mt-2 text-sm font-medium ${
                    currentStep >= step.id ? 'text-slate-900' : 'text-slate-400'
                  }`}
                >
                  {step.name}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <CurrentStepComponent
            data={{
              clientData,
              portfolio,
              riskProfile,
              monteCarloResults,
            }}
            onUpdate={(key, value) => {
              if (key === 'clientData') setClientData(value);
              if (key === 'portfolio') setPortfolio(value);
              if (key === 'riskProfile') setRiskProfile(value);
              if (key === 'monteCarloResults') setMonteCarloResults(value);
            }}
            onNext={nextStep}
            onPrev={prevStep}
            isFirst={currentStep === 1}
            isLast={currentStep === steps.length}
          />
        </div>
      </div>
    </div>
  );
}

export default App;
