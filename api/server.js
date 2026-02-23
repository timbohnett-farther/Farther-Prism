/**
 * Farther Prism API Server
 * 
 * Production-ready REST API for risk assessment and portfolio analysis
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { runMonteCarlo } from '../projects/risk-engine/src/monte-carlo.js';
import { generateComprehensivePlan } from '../projects/financial-planning/src/plan-generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from React build
app.use(express.static(path.join(__dirname, '../client/dist')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'farther-prism-api',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Farther Prism API',
    description: 'AI-powered risk assessment and wealth planning platform',
    version: '0.1.0',
    endpoints: {
      health: 'GET /health',
      monteCarlo: 'POST /api/monte-carlo',
      financialPlan: 'POST /api/financial-plan',
      docs: 'GET /api/docs',
    },
    repository: 'https://github.com/Ledger-AI-Team/Prism',
  });
});

// Monte Carlo simulation endpoint
app.post('/api/monte-carlo', (req, res) => {
  try {
    const {
      initialValue,
      expectedReturn,
      volatility,
      years,
      annualContribution = 0,
      annualWithdrawal = 0,
      numSimulations = 10000,
    } = req.body;

    // Validate required parameters
    if (!initialValue || !expectedReturn || !volatility || !years) {
      return res.status(400).json({
        error: 'Missing required parameters',
        required: ['initialValue', 'expectedReturn', 'volatility', 'years'],
      });
    }

    // Validate ranges
    if (initialValue <= 0) {
      return res.status(400).json({ error: 'initialValue must be positive' });
    }
    if (volatility < 0 || volatility > 1) {
      return res.status(400).json({ error: 'volatility must be between 0 and 1' });
    }
    if (years < 1 || years > 100) {
      return res.status(400).json({ error: 'years must be between 1 and 100' });
    }
    if (numSimulations < 100 || numSimulations > 50000) {
      return res.status(400).json({ error: 'numSimulations must be between 100 and 50,000' });
    }

    // Run simulation
    const results = runMonteCarlo({
      initialValue,
      expectedReturn,
      volatility,
      years,
      annualContribution,
      annualWithdrawal,
      numSimulations,
    });

    // Return results (excluding full paths to reduce payload size)
    res.json({
      parameters: {
        initialValue,
        expectedReturn,
        volatility,
        years,
        annualContribution,
        annualWithdrawal,
        numSimulations,
      },
      results: {
        successRate: results.successRate,
        medianFinalValue: results.medianFinalValue,
        percentile5: results.percentile5,
        percentile95: results.percentile95,
        executionTimeMs: results.executionTimeMs,
      },
      metadata: {
        timestamp: new Date().toISOString(),
        version: '0.1.0',
      },
    });
  } catch (error) {
    console.error('Monte Carlo error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// Comprehensive Financial Plan endpoint
app.post('/api/financial-plan', async (req, res) => {
  try {
    const clientData = req.body;
    
    // Validate required fields
    if (!clientData.personal || !clientData.personal.age) {
      return res.status(400).json({
        error: 'Missing required client data',
        required: ['personal.age', 'personal.retirementAge', 'income', 'expenses'],
      });
    }
    
    // Generate comprehensive plan
    const plan = await generateComprehensivePlan(clientData);
    
    res.json({
      success: true,
      plan,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Financial planning error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error.message,
    });
  }
});

// API documentation
app.get('/api/docs', (req, res) => {
  res.json({
    endpoints: [
      {
        method: 'POST',
        path: '/api/monte-carlo',
        description: 'Run Monte Carlo portfolio projection simulation',
        parameters: {
          initialValue: 'number (required) - Starting portfolio value in dollars',
          expectedReturn: 'number (required) - Annual expected return (e.g., 0.08 for 8%)',
          volatility: 'number (required) - Annual volatility (e.g., 0.15 for 15%)',
          years: 'number (required) - Projection horizon in years (1-100)',
          annualContribution: 'number (optional) - Additional savings per year',
          annualWithdrawal: 'number (optional) - Annual spending/withdrawals',
          numSimulations: 'number (optional) - Number of Monte Carlo paths (100-50,000, default 10,000)',
        },
        response: {
          successRate: 'Percentage of simulations ending above initial value',
          medianFinalValue: '50th percentile outcome',
          percentile5: '5th percentile (bad luck scenario)',
          percentile95: '95th percentile (good luck scenario)',
          executionTimeMs: 'Time taken to run simulation',
        },
        example: {
          request: {
            initialValue: 1000000,
            expectedReturn: 0.08,
            volatility: 0.15,
            years: 30,
            annualContribution: 25000,
            annualWithdrawal: 50000,
            numSimulations: 10000,
          },
        },
      },
    ],
  });
});

// Serve React app for all other routes (client-side routing)
app.get('*', (req, res) => {
  // If request is for /api/* or /health, return 404 JSON
  if (req.path.startsWith('/api') || req.path === '/health') {
    return res.status(404).json({
      error: 'Not found',
      path: req.path,
      method: req.method,
    });
  }
  // Otherwise serve React app
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'An error occurred' : err.message,
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Farther Prism API listening on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`📈 Monte Carlo endpoint: POST http://localhost:${PORT}/api/monte-carlo`);
  console.log(`📖 API docs: http://localhost:${PORT}/api/docs`);
});
