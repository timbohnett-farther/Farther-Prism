/**
 * Monte Carlo API Routes
 * 
 * POST /api/v1/monte-carlo/run - Run Monte Carlo simulation
 * GET  /api/v1/monte-carlo/:scenarioId - Get simulation results
 */

import express from 'express';
import { MonteCarloService } from '../services/monte-carlo-service.js';

const router = express.Router();
const monteCarloService = new MonteCarloService();

/**
 * Run Monte Carlo simulation for a scenario.
 */
router.post('/run', async (req, res) => {
  try {
    const {
      scenarioId,
      scenario,
      simulations = 10000,
      years = 30,
    } = req.body;

    if (!scenarioId) {
      return res.status(400).json({ error: 'scenarioId is required' });
    }

    if (!scenario) {
      return res.status(400).json({ error: 'scenario data is required' });
    }

    console.log(`[API] Monte Carlo simulation requested for scenario ${scenarioId}`);

    // Run simulation
    const result = await monteCarloService.runSimulation(scenarioId, scenario, {
      simulations,
      years,
    });

    res.json({
      success: true,
      scenarioId,
      result: {
        successRate: result.analysis.successRate,
        median: result.analysis.median,
        percentile5: result.analysis.percentile5,
        percentile95: result.analysis.percentile95,
        averageEnding: result.analysis.averageEnding,
        probabilities: result.analysis.probabilities,
        startingValue: result.analysis.startingValue,
      },
      meta: {
        simulations: result.simulations,
        years: result.years,
        duration: result.duration,
      },
    });

  } catch (error) {
    console.error('[Monte Carlo API Error]', error.message);
    res.status(500).json({
      error: 'Monte Carlo simulation failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * Get stored Monte Carlo results for a scenario.
 */
router.get('/:scenarioId', async (req, res) => {
  try {
    const { scenarioId } = req.params;

    // Query database for results
    const result = await pool.query(
      'SELECT * FROM monte_carlo_results WHERE scenario_id = $1 ORDER BY created_at DESC LIMIT 1',
      [scenarioId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No Monte Carlo results found for this scenario' });
    }

    res.json({
      success: true,
      result: result.rows[0],
    });

  } catch (error) {
    console.error('[Monte Carlo API Error]', error.message);
    res.status(500).json({ error: 'Failed to retrieve Monte Carlo results', message: error.message });
  }
});

export default router;
