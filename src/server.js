/**
 * Farther Prism - API Server
 * 
 * Main entry point for the institutional financial planning platform.
 * 
 * Routes:
 *   /api/v1/households    - Planning Graph (household CRUD)
 *   /api/v1/plans         - Plans, Scenarios, Runs, Results
 *   /api/v1/health        - Health check
 *   /api/v1/docs          - API documentation
 */

import express from 'express';
import cors from 'cors';
import { healthCheck } from './db/pool.js';
import householdRoutes from './routes/households.js';
import planRoutes from './routes/plans.js';
import { runMonteCarlo } from '../projects/risk-engine/src/monte-carlo.js';

const app = express();
const PORT = process.env.API_PORT || process.env.PORT || 3000;

// ============================================================================
// MIDDLEWARE
// ============================================================================

app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api/')) {
      console.log(`[API] ${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
    }
  });
  next();
});

// Set audit context (for database triggers)
app.use((req, res, next) => {
  // TODO: Extract from JWT token
  const userId = req.headers['x-user-id'] || null;
  const userEmail = req.headers['x-user-email'] || null;
  
  if (userId || userEmail) {
    // These are picked up by the audit_log_trigger function
    req.dbContext = { userId, userEmail };
  }
  next();
});

// ============================================================================
// ROUTES
// ============================================================================

// Health check
app.get('/api/v1/health', async (req, res) => {
  const db = await healthCheck();
  res.status(db.ok ? 200 : 503).json({
    status: db.ok ? 'healthy' : 'unhealthy',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    database: db,
    uptime: process.uptime(),
  });
});

// Monte Carlo simulation (temporary endpoint until full calc engine deployed)
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
      goalValue = 0,
    } = req.body;

    // Validate inputs
    if (!initialValue || !expectedReturn || !volatility || !years) {
      return res.status(400).json({
        error: 'Missing required parameters: initialValue, expectedReturn, volatility, years',
      });
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
      goalValue,
    });

    res.json({
      results,
      parameters: {
        initialValue,
        expectedReturn,
        volatility,
        years,
        annualContribution,
        annualWithdrawal,
        numSimulations,
        goalValue,
      },
    });
  } catch (error) {
    console.error('Monte Carlo error:', error);
    res.status(500).json({ error: error.message });
  }
});

// API documentation
app.get('/api/v1/docs', (req, res) => {
  res.json({
    name: 'Farther Prism API',
    version: '1.0.0',
    description: 'Institutional-grade financial planning platform',
    endpoints: {
      health: 'GET /api/v1/health',
      households: {
        create: 'POST /api/v1/households',
        list: 'GET /api/v1/households',
        get: 'GET /api/v1/households/:id',
        graph: 'GET /api/v1/households/:id/graph',
        update: 'PATCH /api/v1/households/:id',
        archive: 'DELETE /api/v1/households/:id',
        people: {
          add: 'POST /api/v1/households/:id/people',
          list: 'GET /api/v1/households/:id/people',
          update: 'PATCH /api/v1/households/:id/people/:pid',
          deactivate: 'DELETE /api/v1/households/:id/people/:pid',
        },
        entities: {
          add: 'POST /api/v1/households/:id/entities',
          list: 'GET /api/v1/households/:id/entities',
          update: 'PATCH /api/v1/households/:id/entities/:eid',
          delete: 'DELETE /api/v1/households/:id/entities/:eid',
        },
        relationships: {
          add: 'POST /api/v1/households/:id/relationships',
          list: 'GET /api/v1/households/:id/relationships',
          delete: 'DELETE /api/v1/households/:id/relationships/:rid',
        },
        accounts: {
          add: 'POST /api/v1/households/:id/accounts',
          list: 'GET /api/v1/households/:id/accounts',
          update: 'PATCH /api/v1/households/:id/accounts/:aid',
        },
        incomeStreams: {
          add: 'POST /api/v1/households/:id/income-streams',
          list: 'GET /api/v1/households/:id/income-streams',
        },
        expenseStreams: {
          add: 'POST /api/v1/households/:id/expense-streams',
          list: 'GET /api/v1/households/:id/expense-streams',
        },
        goals: {
          add: 'POST /api/v1/households/:id/goals',
          list: 'GET /api/v1/households/:id/goals',
        },
      },
      plans: {
        create: 'POST /api/v1/plans',
        listByHousehold: 'GET /api/v1/plans/household/:hid',
        get: 'GET /api/v1/plans/:id',
        update: 'PATCH /api/v1/plans/:id',
        archive: 'DELETE /api/v1/plans/:id',
        scenarios: {
          add: 'POST /api/v1/plans/:id/scenarios',
          list: 'GET /api/v1/plans/:id/scenarios',
        },
        assumptionSets: {
          add: 'POST /api/v1/plans/scenarios/:sid/assumption-sets',
          list: 'GET /api/v1/plans/scenarios/:sid/assumption-sets',
          get: 'GET /api/v1/plans/assumption-sets/:id',
        },
        runs: {
          create: 'POST /api/v1/plans/scenarios/:sid/runs',
          get: 'GET /api/v1/plans/runs/:id',
          status: 'GET /api/v1/plans/runs/:id/status',
          summary: 'GET /api/v1/plans/runs/:id/summary',
          timeseries: 'GET /api/v1/plans/runs/:id/timeseries',
          recommendations: 'GET /api/v1/plans/runs/:id/recommendations',
        },
        referenceData: {
          returnModels: 'GET /api/v1/plans/return-models',
          taxRuleSets: 'GET /api/v1/plans/tax-rule-sets',
        },
      },
    },
  });
});

// Mount route modules
app.use('/api/v1/households', householdRoutes);
app.use('/api/v1/plans', planRoutes);

// Serve frontend (if built)
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientDist = path.join(__dirname, '..', 'client', 'dist');

app.use(express.static(clientDist));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API endpoint not found' });
  }
  res.sendFile(path.join(clientDist, 'index.html'));
});

// ============================================================================
// GLOBAL ERROR HANDLER
// ============================================================================

app.use((err, req, res, next) => {
  console.error('[Global Error]', err);
  res.status(500).json({
    error: 'Internal server error',
    ...(process.env.NODE_ENV !== 'production' && { detail: err.message }),
  });
});

// ============================================================================
// START SERVER
// ============================================================================

app.listen(PORT, () => {
  console.log(`
  ┌──────────────────────────────────────────┐
  │                                          │
  │   ⚡ Farther Prism API v1.0.0            │
  │                                          │
  │   Port:    ${PORT}                          │
  │   Health:  /api/v1/health                │
  │   Docs:    /api/v1/docs                  │
  │                                          │
  │   📈 Institutional Financial Planning    │
  │                                          │
  └──────────────────────────────────────────┘
  `);
});

export default app;
