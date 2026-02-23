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
    <div className="min-h-screen bg-gradient-to-br from-farther-slate to-farther-gray-50">
      {/* Header */}
      <div className="bg-farther-navy border-b border-farther-gold/20 shadow-lg">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                <span className="text-farther-gold">◆</span>
                Farther Prism
              </h1>
              <p className="text-sm text-farther-gold/80 mt-1">Intelligent Risk Assessment & Wealth Planning</p>
            </div>
            <div className="text-right">
              <div className="text-sm font-semibold text-farther-gold">
                Step {currentStep} of {steps.length}
              </div>
              <div className="text-xs text-white/70">{steps[currentStep - 1].name}</div>
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
                    className={`flex items-center justify-center w-12 h-12 rounded-full border-2 transition-all shadow-md ${
                      currentStep > step.id
                        ? 'bg-farther-gold border-farther-gold text-farther-navy'
                        : currentStep === step.id
                        ? 'bg-farther-blue border-farther-gold text-white ring-4 ring-farther-gold/20'
                        : 'bg-white border-farther-gray-300 text-farther-gray-600'
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
                      className={`flex-1 h-1 mx-3 transition-all rounded ${
                        currentStep > step.id ? 'bg-farther-gold' : 'bg-farther-gray-200'
                      }`}
                    />
                  )}
                </div>
                <div
                  className={`mt-3 text-sm font-semibold ${
                    currentStep >= step.id ? 'text-farther-navy' : 'text-farther-gray-600'
                  }`}
                >
                  {step.name}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Current Step Content */}
        <div className="bg-white rounded-xl shadow-2xl border border-farther-gray-200 p-8">
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
