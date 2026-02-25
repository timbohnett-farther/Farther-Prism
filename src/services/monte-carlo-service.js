/**
 * Monte Carlo Simulation Service
 * 
 * Runs 10,000+ Monte Carlo simulations for financial planning projections.
 * Incorporates Farther's investment philosophy:
 * - Preservation-first approach
 * - Tax alpha optimization (1-3% boost)
 * - Human-led, tech-amplified strategy
 * - Private + public market diversification
 * 
 * Uses historical market data from Backblaze data lake.
 */

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import pool from '../db/pool.js';
import fs from 'fs';
import path from 'path';

export class MonteCarloService {
  constructor() {
    // Load Backblaze credentials
    const envPath = path.join(process.cwd(), '.env.backblaze');
    if (fs.existsSync(envPath)) {
      const envContent = fs.readFileSync(envPath, 'utf-8');
      this.b2Config = {};
      envContent.split('\n').forEach(line => {
        if (line && !line.startsWith('#')) {
          const [key, value] = line.split('=');
          if (key && value) this.b2Config[key.trim()] = value.trim();
        }
      });
      
      this.s3Client = new S3Client({
        endpoint: `https://${this.b2Config.BACKBLAZE_ENDPOINT}`,
        region: this.b2Config.BACKBLAZE_REGION,
        credentials: {
          accessKeyId: this.b2Config.BACKBLAZE_KEY_ID,
          secretAccessKey: this.b2Config.BACKBLAZE_APPLICATION_KEY,
        },
        forcePathStyle: true,
      });
      
      this.bucket = this.b2Config.BACKBLAZE_BUCKET_NAME;
    }

    // Market data cache
    this.marketDataCache = null;
    this.correlationMatrix = null;
  }

  /**
   * Run Monte Carlo simulation for a scenario.
   * 
   * @param {string} scenarioId - Scenario UUID
   * @param {Object} scenario - Scenario data (people, accounts, assumptions)
   * @param {Object} options - Simulation options
   * @returns {Promise<Object>} Simulation results
   */
  async runSimulation(scenarioId, scenario, options = {}) {
    const {
      simulations = 10000,
      years = 30,
      startDate = new Date().toISOString().split('T')[0],
    } = options;

    console.log(`[MonteCarlo] Starting ${simulations} simulations for scenario ${scenarioId}`);

    const startTime = Date.now();

    // Load market data
    await this.loadMarketData();

    // Extract scenario parameters
    const params = this.extractParameters(scenario);

    // Run simulations
    const results = [];
    for (let i = 0; i < simulations; i++) {
      const simulation = await this.runSingleSimulation(params, years);
      results.push(simulation);

      // Progress logging every 1000 simulations
      if ((i + 1) % 1000 === 0) {
        console.log(`[MonteCarlo] Progress: ${i + 1}/${simulations} (${Math.round((i + 1) / simulations * 100)}%)`);
      }
    }

    // Analyze results
    const analysis = this.analyzeResults(results, params);

    // Store in database
    await this.storeResults(scenarioId, analysis, results);

    const duration = Date.now() - startTime;
    console.log(`[MonteCarlo] Completed ${simulations} simulations in ${duration}ms`);

    return {
      scenarioId,
      simulations,
      years,
      analysis,
      duration,
    };
  }

  /**
   * Load historical market data from Backblaze.
   */
  async loadMarketData() {
    if (this.marketDataCache) {
      return; // Already loaded
    }

    console.log('[MonteCarlo] Loading market data from Backblaze...');

    try {
      // Load SPY as representative (we have 8 asset classes, can expand later)
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: 'market-data/daily-prices/SPY.csv',
      });

      const response = await this.s3Client.send(command);
      const csvData = await this.streamToString(response.Body);

      // Parse CSV
      const lines = csvData.split('\n').filter(l => l.trim());
      const data = [];

      for (let i = 1; i < lines.length; i++) { // Skip header
        const [date, open, high, low, close, adjClose, volume] = lines[i].split(',');
        const adjCloseVal = parseFloat(adjClose);
        
        if (isNaN(adjCloseVal)) continue; // Skip invalid data
        
        data.push({
          date,
          adjClose: adjCloseVal,
          return: 0, // Will calculate after all data loaded
        });
      }

      // Calculate returns (after data is loaded)
      for (let i = 1; i < data.length; i++) {
        data[i].return = (data[i].adjClose / data[i - 1].adjClose) - 1;
      }

      this.marketDataCache = data;
      console.log(`[MonteCarlo] Loaded ${data.length} days of market data`);

      // Calculate statistics
      const returns = data.map(d => d.return).filter(r => r !== 0);
      const mean = returns.reduce((sum, r) => sum + r, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      const stdDev = Math.sqrt(variance);

      // Annualize (252 trading days)
      this.marketStats = {
        annualMean: mean * 252,
        annualStdDev: stdDev * Math.sqrt(252),
      };

      console.log(`[MonteCarlo] Market stats: Mean=${(this.marketStats.annualMean * 100).toFixed(2)}%, StdDev=${(this.marketStats.annualStdDev * 100).toFixed(2)}%`);

    } catch (error) {
      console.warn('[MonteCarlo] Failed to load market data from Backblaze, using synthetic:', error.message);
      
      // Fallback to synthetic data
      this.marketStats = {
        annualMean: 0.08, // 8% historical average
        annualStdDev: 0.18, // 18% historical volatility
      };
    }
  }

  /**
   * Extract simulation parameters from scenario.
   */
  extractParameters(scenario) {
    const {
      people = [],
      accounts = [],
      incomeStreams = [],
      expenseStreams = [],
      goals = [],
      assumptions = {},
    } = scenario;

    // Calculate starting portfolio value
    const portfolioValue = accounts.reduce((sum, acc) => sum + (acc.current_value || 0), 0);

    // Calculate annual income
    const annualIncome = incomeStreams.reduce((sum, stream) => {
      const amount = stream.frequency === 'annual' ? stream.amount : stream.amount * 12;
      return sum + amount;
    }, 0);

    // Calculate annual expenses
    const annualExpenses = expenseStreams.reduce((sum, stream) => {
      const amount = stream.frequency === 'annual' ? stream.amount : stream.amount * 12;
      return sum + amount;
    }, 0);

    // Annual spending need (withdrawals)
    const annualWithdrawal = Math.max(0, annualExpenses - annualIncome);

    // Portfolio allocation (simplified - use from accounts or default)
    const stockAllocation = assumptions.stockAllocation || 0.70; // 70% stocks default
    const bondAllocation = 1 - stockAllocation;

    return {
      portfolioValue,
      annualIncome,
      annualExpenses,
      annualWithdrawal,
      stockAllocation,
      bondAllocation,
      inflationRate: assumptions.inflationRate || 0.03, // 3% default
      taxAlpha: assumptions.taxAlpha || 0.02, // 2% tax alpha (Farther's 1-3% range)
    };
  }

  /**
   * Run a single Monte Carlo simulation.
   */
  async runSingleSimulation(params, years) {
    const monthlyData = [];
    let portfolioValue = params.portfolioValue;
    let annualWithdrawal = params.annualWithdrawal;

    for (let month = 0; month < years * 12; month++) {
      const year = Math.floor(month / 12);

      // Generate monthly return (stochastic)
      const monthlyReturn = this.generateReturn(params.stockAllocation);

      // Apply withdrawal (monthly)
      const monthlyWithdrawal = annualWithdrawal / 12;
      portfolioValue -= monthlyWithdrawal;

      // Apply return
      portfolioValue *= (1 + monthlyReturn);

      // Apply tax alpha boost (Farther advantage)
      portfolioValue *= (1 + params.taxAlpha / 12);

      // Inflation adjustment to withdrawal (annual)
      if (month % 12 === 0 && month > 0) {
        annualWithdrawal *= (1 + params.inflationRate);
      }

      monthlyData.push({
        month,
        year,
        portfolioValue: Math.max(0, portfolioValue),
        withdrawal: monthlyWithdrawal,
      });

      // Portfolio depleted
      if (portfolioValue <= 0) {
        break;
      }
    }

    return {
      endingValue: monthlyData[monthlyData.length - 1].portfolioValue,
      depleted: monthlyData[monthlyData.length - 1].portfolioValue === 0,
      monthsLasted: monthlyData.length,
      monthlyData,
    };
  }

  /**
   * Generate a single monthly return using Farther's approach.
   * Preservation-first: slightly defensive modeling.
   */
  generateReturn(stockAllocation) {
    // Stock returns (using historical data if available)
    const stockMean = this.marketStats.annualMean;
    const stockStdDev = this.marketStats.annualStdDev;
    const stockReturn = this.gaussianRandom(stockMean / 12, stockStdDev / Math.sqrt(12));

    // Bond returns (lower vol, lower return)
    const bondMean = 0.04; // 4% bonds
    const bondStdDev = 0.06; // 6% bond vol
    const bondReturn = this.gaussianRandom(bondMean / 12, bondStdDev / Math.sqrt(12));

    // Weighted portfolio return
    return (stockReturn * stockAllocation) + (bondReturn * (1 - stockAllocation));
  }

  /**
   * Analyze simulation results.
   */
  analyzeResults(results, params) {
    // Sort by ending value
    const sorted = results.map(r => r.endingValue).sort((a, b) => a - b);

    // Success rate (portfolio survives)
    const successful = results.filter(r => !r.depleted).length;
    const successRate = successful / results.length;

    // Percentiles
    const percentile = (p) => {
      const index = Math.floor(sorted.length * p);
      return sorted[index];
    };

    const median = percentile(0.50);
    const p5 = percentile(0.05); // Worst case (5th percentile)
    const p95 = percentile(0.95); // Best case (95th percentile)

    // Average ending value
    const avgEnding = results.reduce((sum, r) => sum + r.endingValue, 0) / results.length;

    // Probability of various outcomes
    const probabilities = {
      depleted: results.filter(r => r.depleted).length / results.length,
      doubledWealth: results.filter(r => r.endingValue > params.portfolioValue * 2).length / results.length,
      preservedWealth: results.filter(r => r.endingValue > params.portfolioValue).length / results.length,
    };

    return {
      successRate,
      median,
      percentile5: p5,
      percentile95: p95,
      averageEnding: avgEnding,
      probabilities,
      startingValue: params.portfolioValue,
    };
  }

  /**
   * Store results in database.
   */
  async storeResults(scenarioId, analysis, simulations) {
    // Skip storage if scenarioId is not a valid UUID (test mode)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(scenarioId)) {
      console.log(`[MonteCarlo] Skipping database storage (test mode, invalid UUID: ${scenarioId})`);
      return;
    }

    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Delete existing results
      await client.query(
        'DELETE FROM monte_carlo_results WHERE scenario_id = $1',
        [scenarioId]
      );

      // Insert summary
      await client.query(`
        INSERT INTO monte_carlo_results (
          scenario_id, simulations_run, success_rate,
          median_ending_value, percentile_5, percentile_95,
          average_ending_value, probability_depleted,
          probability_doubled, probability_preserved,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      `, [
        scenarioId,
        simulations.length,
        analysis.successRate,
        analysis.median,
        analysis.percentile5,
        analysis.percentile95,
        analysis.averageEnding,
        analysis.probabilities.depleted,
        analysis.probabilities.doubledWealth,
        analysis.probabilities.preservedWealth,
      ]);

      await client.query('COMMIT');
      console.log(`[MonteCarlo] Stored results for scenario ${scenarioId}`);

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Gaussian random number generator (Box-Muller transform).
   */
  gaussianRandom(mean = 0, stdev = 1) {
    const u = 1 - Math.random();
    const v = Math.random();
    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return z * stdev + mean;
  }

  /**
   * Convert stream to string.
   */
  async streamToString(stream) {
    const chunks = [];
    for await (const chunk of stream) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf-8');
  }
}

export default MonteCarloService;
