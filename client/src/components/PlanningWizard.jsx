/**
 * Financial Planning Wizard
 * 
 * The existing 5-step wizard, now accessible via /planning route.
 * Wraps the original flow with navigation and household context.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ClientOnboarding from './ClientOnboarding';
import PortfolioBuilder from './PortfolioBuilder';
import RiskAssessment from './RiskAssessment';
import MonteCarloResults from './MonteCarloResults';
import ReportGenerator from './ReportGenerator';

const PlanningWizard = () => {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [clientData, setClientData] = useState(null);
  const [portfolioData, setPortfolioData] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [simulationResults, setSimulationResults] = useState(null);

  const steps = [
    { number: 1, name: 'Client Info', component: ClientOnboarding },
    { number: 2, name: 'Portfolio', component: PortfolioBuilder },
    { number: 3, name: 'Risk Profile', component: RiskAssessment },
    { number: 4, name: 'Projections', component: MonteCarloResults },
    { number: 5, name: 'Report', component: ReportGenerator },
  ];

  const handleStepComplete = (data) => {
    if (currentStep === 1) {
      setClientData(data);
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setPortfolioData(data);
      setCurrentStep(3);
    } else if (currentStep === 3) {
      setRiskData(data);
      setCurrentStep(4);
    } else if (currentStep === 4) {
      setSimulationResults(data);
      setCurrentStep(5);
    }
  };

  const CurrentStepComponent = steps[currentStep - 1].component;

  return (
    <div className="min-h-screen bg-[#333333]">
      {/* Header with Back Button */}
      <header className="bg-[#333333] border-b border-[#5b6a71]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <img 
                src="/farther-wordmark.png" 
                alt="Farther" 
                className="h-8 w-auto"
              />
              <div className="h-6 w-px bg-[#5b6a71]"></div>
              <button
                onClick={() => navigate('/')}
                className="text-[#6d9dbe] hover:text-white transition flex items-center"
              >
                <span className="mr-2">←</span>
                <span>Dashboard</span>
              </button>
              <div className="h-6 w-px bg-[#5b6a71]"></div>
              <h1 className="text-xl font-bold text-white">
                Prism - Financial Planning
              </h1>
            </div>
            <div className="flex items-center space-x-2">
              {steps.map((step) => (
                <div
                  key={step.number}
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                    ${currentStep === step.number
                      ? 'bg-[#1a7a82] text-white'
                      : currentStep > step.number
                      ? 'bg-[#6d9dbe] text-white'
                      : 'bg-[#5b6a71] text-[#6d9dbe]'
                    }
                  `}
                >
                  {step.number}
                </div>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Wizard Content */}
      <main>
        {currentStep === 1 && (
          <ClientOnboarding onComplete={handleStepComplete} />
        )}
        {currentStep === 2 && (
          <PortfolioBuilder
            clientData={clientData}
            onComplete={handleStepComplete}
            onBack={() => setCurrentStep(1)}
          />
        )}
        {currentStep === 3 && (
          <RiskAssessment
            clientData={clientData}
            portfolioData={portfolioData}
            onComplete={handleStepComplete}
            onBack={() => setCurrentStep(2)}
          />
        )}
        {currentStep === 4 && (
          <MonteCarloResults
            clientData={clientData}
            portfolioData={portfolioData}
            riskData={riskData}
            onComplete={handleStepComplete}
            onBack={() => setCurrentStep(3)}
          />
        )}
        {currentStep === 5 && (
          <ReportGenerator
            clientData={clientData}
            portfolioData={portfolioData}
            riskData={riskData}
            simulationResults={simulationResults}
            onBack={() => setCurrentStep(4)}
          />
        )}
      </main>
    </div>
  );
};

export default PlanningWizard;
