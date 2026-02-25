/**
 * Focus Service - Portfolio Analytics & Optimization
 * 
 * Performance attribution, allocation drift, tax-loss harvesting,
 * rebalancing recommendations, and fee analysis.
 */

import pool from '../db/pool.js';

// ETF-to-asset-class mapping
const ASSET_CLASS_MAP = {
  // US Equities
  SPY: 'us_stocks', QQQ: 'us_stocks', IWM: 'us_stocks', VTI: 'us_stocks', VOO: 'us_stocks',
  AAPL: 'us_stocks', MSFT: 'us_stocks', GOOGL: 'us_stocks', AMZN: 'us_stocks', NVDA: 'us_stocks',
  META: 'us_stocks', TSLA: 'us_stocks', BRK: 'us_stocks', JPM: 'us_stocks', V: 'us_stocks',
  // International
  EFA: 'intl_stocks', EEM: 'intl_stocks', VEA: 'intl_stocks', VXUS: 'intl_stocks', IEMG: 'intl_stocks',
  // Bonds
  AGG: 'bonds', BND: 'bonds', TLT: 'bonds', IEF: 'bonds', LQD: 'bonds', HYG: 'bonds',
  TIPS: 'bonds', SHY: 'bonds', MUB: 'bonds', VGSH: 'bonds',
  // Real Estate
  VNQ: 'real_estate', SCHH: 'real_estate', IYR: 'real_estate',
  // Commodities
  GLD: 'commodities', SLV: 'commodities', IAU: 'commodities', DBC: 'commodities',
  // Cash
  SHV: 'cash', BIL: 'cash', SGOV: 'cash',
};

// Expense ratios for common ETFs
const EXPENSE_RATIOS = {
  SPY: 0.0945, QQQ: 0.20, IWM: 0.19, VTI: 0.03, VOO: 0.03,
  EFA: 0.32, EEM: 0.68, VEA: 0.05, VXUS: 0.07,
  AGG: 0.03, BND: 0.03, TLT: 0.15, IEF: 0.15, LQD: 0.14,
  VNQ: 0.12, GLD: 0.40, SLV: 0.50, IAU: 0.25,
  SHV: 0.15, BIL: 0.14, SGOV: 0.05,
};

// Replacement securities for tax-loss harvesting (correlated but not substantially identical)
const TLH_REPLACEMENTS = {
  SPY: 'VOO', VOO: 'IVV', IVV: 'SPY', VTI: 'ITOT', ITOT: 'VTI',
  QQQ: 'QQQM', AGG: 'BND', BND: 'AGG', TLT: 'VGLT', VGLT: 'TLT',
  EFA: 'VEA', VEA: 'EFA', EEM: 'VWO', VWO: 'EEM',
  VNQ: 'SCHH', SCHH: 'VNQ', GLD: 'IAU', IAU: 'GLD',
  IWM: 'VTWO', VTWO: 'IWM',
};

export class FocusService {

  // =========================================================================
  // PORTFOLIO OVERVIEW
  // =========================================================================

  /**
   * Get portfolio overview for a household.
   */
  async getOverview(householdId) {
    const accounts = await pool.query(
      'SELECT * FROM accounts WHERE household_id = $1',
      [householdId]
    );

    const lots = await pool.query(`
      SELECT l.*, a.account_type, a.account_name
      FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
    `, [householdId]);

    const holdings = lots.rows;
    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);
    const totalCost = holdings.reduce((sum, h) => sum + parseFloat(h.cost_basis || 0), 0);
    const totalGainLoss = totalValue - totalCost;
    const returnPct = totalCost > 0 ? (totalGainLoss / totalCost) : 0;

    // Allocation breakdown
    const allocation = this.calculateAllocation(holdings);

    // Tax-loss opportunities count
    const tlhOpportunities = holdings.filter(h =>
      parseFloat(h.current_value || 0) < parseFloat(h.cost_basis || 0)
    ).length;

    // Concentration risks (>5% of portfolio)
    const concentrations = holdings
      .map(h => ({
        symbol: h.symbol,
        value: parseFloat(h.current_value || 0),
        pct: totalValue > 0 ? parseFloat(h.current_value || 0) / totalValue : 0,
      }))
      .filter(h => h.pct > 0.05)
      .sort((a, b) => b.pct - a.pct);

    return {
      totalValue,
      totalCost,
      totalGainLoss,
      returnPct,
      accountCount: accounts.rows.length,
      holdingCount: holdings.length,
      allocation,
      tlhOpportunities,
      concentrations,
    };
  }

  // =========================================================================
  // ALLOCATION ANALYSIS
  // =========================================================================

  /**
   * Calculate current allocation by asset class.
   */
  calculateAllocation(holdings) {
    const totalValue = holdings.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);
    if (totalValue === 0) return {};

    const byClass = {};
    for (const h of holdings) {
      const value = parseFloat(h.current_value || 0);
      const symbol = (h.symbol || '').toUpperCase();
      const assetClass = ASSET_CLASS_MAP[symbol] || 'other';

      if (!byClass[assetClass]) {
        byClass[assetClass] = { value: 0, holdings: [] };
      }
      byClass[assetClass].value += value;
      byClass[assetClass].holdings.push({ symbol, value });
    }

    // Calculate percentages
    const result = {};
    for (const [cls, data] of Object.entries(byClass)) {
      result[cls] = {
        value: data.value,
        percentage: data.value / totalValue,
        holdings: data.holdings,
      };
    }

    return result;
  }

  /**
   * Get allocation drift (current vs target).
   */
  async getAllocationDrift(householdId) {
    // Get current allocation
    const lots = await pool.query(`
      SELECT l.* FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
    `, [householdId]);

    const currentAllocation = this.calculateAllocation(lots.rows);

    // Get target allocation
    const targets = await pool.query(
      'SELECT * FROM allocation_targets WHERE household_id = $1',
      [householdId]
    );

    // If no targets set, use default (preservation-first)
    const targetMap = {};
    if (targets.rows.length > 0) {
      for (const t of targets.rows) {
        targetMap[t.asset_class] = parseFloat(t.target_percentage);
      }
    } else {
      // Farther's preservation-first defaults
      targetMap.us_stocks = 0.35;
      targetMap.intl_stocks = 0.15;
      targetMap.bonds = 0.30;
      targetMap.real_estate = 0.05;
      targetMap.commodities = 0.05;
      targetMap.cash = 0.10;
    }

    // Calculate drift
    const drift = {};
    const allClasses = new Set([...Object.keys(currentAllocation), ...Object.keys(targetMap)]);

    let totalDrift = 0;
    for (const cls of allClasses) {
      const current = currentAllocation[cls]?.percentage || 0;
      const target = targetMap[cls] || 0;
      const d = current - target;
      drift[cls] = {
        current,
        target,
        drift: d,
        overweight: d > 0,
        value: currentAllocation[cls]?.value || 0,
      };
      totalDrift += Math.abs(d);
    }

    return {
      drift,
      totalDrift,
      needsRebalance: totalDrift > 0.05, // >5% total drift triggers rebalance
    };
  }

  /**
   * Set allocation targets for a household.
   */
  async setAllocationTargets(householdId, targets) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing targets
      await client.query('DELETE FROM allocation_targets WHERE household_id = $1', [householdId]);

      // Insert new targets
      for (const [assetClass, target] of Object.entries(targets)) {
        await client.query(`
          INSERT INTO allocation_targets (household_id, asset_class, target_percentage, min_percentage, max_percentage)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          householdId,
          assetClass,
          target.target,
          target.min || target.target - 0.05,
          target.max || target.target + 0.05,
        ]);
      }

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // =========================================================================
  // TAX-LOSS HARVESTING
  // =========================================================================

  /**
   * Scan for tax-loss harvesting opportunities.
   */
  async scanTaxLossOpportunities(householdId, marginalTaxRate = 0.37) {
    // Get all lots in taxable accounts
    const lots = await pool.query(`
      SELECT l.*, a.account_type, a.account_name
      FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
      AND a.account_type = 'taxable'
    `, [householdId]);

    const opportunities = [];

    for (const lot of lots.rows) {
      const costBasis = parseFloat(lot.cost_basis || 0);
      const currentValue = parseFloat(lot.current_value || 0);
      const unrealizedLoss = currentValue - costBasis;

      // Only interested in losses
      if (unrealizedLoss >= 0) continue;

      const symbol = (lot.symbol || '').toUpperCase();
      const replacement = TLH_REPLACEMENTS[symbol] || null;
      const taxSavings = Math.abs(unrealizedLoss) * marginalTaxRate;

      // Check for wash sale violations (simplified - check recent purchases)
      const recentPurchases = await pool.query(`
        SELECT COUNT(*) as count FROM lots l
        JOIN accounts a ON l.account_id = a.id
        WHERE a.household_id = $1
        AND l.symbol = $2
        AND l.acquired_date > NOW() - INTERVAL '30 days'
      `, [householdId, symbol]);

      const washSaleViolation = parseInt(recentPurchases.rows[0].count) > 0;

      opportunities.push({
        lotId: lot.id,
        accountId: lot.account_id,
        accountName: lot.account_name,
        symbol,
        quantity: parseFloat(lot.quantity || 0),
        costBasis,
        currentValue,
        unrealizedLoss: Math.abs(unrealizedLoss),
        estimatedTaxSavings: taxSavings,
        replacementSymbol: replacement,
        washSaleViolation,
      });
    }

    // Sort by tax savings (highest first)
    opportunities.sort((a, b) => b.estimatedTaxSavings - a.estimatedTaxSavings);

    const totalSavings = opportunities.reduce((sum, o) => sum + o.estimatedTaxSavings, 0);

    return {
      opportunities,
      totalPotentialSavings: totalSavings,
      count: opportunities.length,
      washSaleWarnings: opportunities.filter(o => o.washSaleViolation).length,
    };
  }

  // =========================================================================
  // REBALANCING
  // =========================================================================

  /**
   * Generate rebalancing recommendations.
   */
  async generateRebalanceRecommendation(householdId) {
    const driftAnalysis = await this.getAllocationDrift(householdId);

    if (!driftAnalysis.needsRebalance) {
      return {
        needsRebalance: false,
        message: 'Portfolio is within acceptable drift range',
        totalDrift: driftAnalysis.totalDrift,
      };
    }

    // Get all lots grouped by account type
    const lots = await pool.query(`
      SELECT l.*, a.account_type, a.account_name, a.id as acc_id
      FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
      ORDER BY
        CASE a.account_type
          WHEN 'tax_deferred' THEN 1  -- Rebalance here first (no tax)
          WHEN 'tax_free' THEN 2      -- Roth second
          WHEN 'taxable' THEN 3       -- Taxable last
        END
    `, [householdId]);

    const totalValue = lots.rows.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);
    const trades = [];

    // For each overweight asset class, sell
    // For each underweight asset class, buy
    for (const [cls, data] of Object.entries(driftAnalysis.drift)) {
      if (Math.abs(data.drift) < 0.01) continue; // Skip tiny drifts

      const targetValue = totalValue * data.target;
      const currentValue = data.value;
      const adjustmentNeeded = targetValue - currentValue;

      if (adjustmentNeeded > 0) {
        // Need to BUY this asset class
        trades.push({
          assetClass: cls,
          action: 'buy',
          amount: adjustmentNeeded,
          reason: `Underweight by ${(Math.abs(data.drift) * 100).toFixed(1)}%`,
        });
      } else {
        // Need to SELL this asset class
        trades.push({
          assetClass: cls,
          action: 'sell',
          amount: Math.abs(adjustmentNeeded),
          reason: `Overweight by ${(Math.abs(data.drift) * 100).toFixed(1)}%`,
        });
      }
    }

    // Store recommendation
    const result = await pool.query(`
      INSERT INTO rebalance_recommendations (household_id, total_drift, trades)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [householdId, driftAnalysis.totalDrift, JSON.stringify(trades)]);

    return {
      needsRebalance: true,
      id: result.rows[0].id,
      totalDrift: driftAnalysis.totalDrift,
      trades,
      tradeCount: trades.length,
    };
  }

  // =========================================================================
  // FEE ANALYSIS
  // =========================================================================

  /**
   * Analyze portfolio fees and expenses.
   */
  async analyzeFees(householdId) {
    const lots = await pool.query(`
      SELECT l.* FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
    `, [householdId]);

    const totalValue = lots.rows.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);

    const holdings = lots.rows.map(h => {
      const symbol = (h.symbol || '').toUpperCase();
      const value = parseFloat(h.current_value || 0);
      const expenseRatio = EXPENSE_RATIOS[symbol] || 0.10; // Default 0.10% for unknown
      const annualCost = value * (expenseRatio / 100);

      return {
        symbol,
        value,
        expenseRatio,
        annualCost,
        weight: totalValue > 0 ? value / totalValue : 0,
      };
    });

    // Weighted average expense ratio
    const weightedER = holdings.reduce((sum, h) => sum + (h.expenseRatio * h.weight), 0);
    const totalAnnualCost = holdings.reduce((sum, h) => sum + h.annualCost, 0);

    // 10-year cost projection (compounded)
    const tenYearCost = totalValue * (1 - Math.pow(1 - weightedER / 100, 10));

    return {
      weightedExpenseRatio: weightedER,
      totalAnnualCost,
      tenYearCostProjection: tenYearCost,
      holdings: holdings.sort((a, b) => b.annualCost - a.annualCost),
      totalPortfolioValue: totalValue,
    };
  }

  // =========================================================================
  // PERFORMANCE
  // =========================================================================

  /**
   * Get performance attribution.
   */
  async getPerformance(householdId) {
    const lots = await pool.query(`
      SELECT l.*, a.account_type FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
    `, [householdId]);

    const totalValue = lots.rows.reduce((sum, h) => sum + parseFloat(h.current_value || 0), 0);
    const totalCost = lots.rows.reduce((sum, h) => sum + parseFloat(h.cost_basis || 0), 0);
    const totalReturn = totalCost > 0 ? (totalValue - totalCost) / totalCost : 0;

    // Attribution by asset class
    const attribution = {};
    for (const lot of lots.rows) {
      const symbol = (lot.symbol || '').toUpperCase();
      const assetClass = ASSET_CLASS_MAP[symbol] || 'other';
      const value = parseFloat(lot.current_value || 0);
      const cost = parseFloat(lot.cost_basis || 0);
      const gain = value - cost;

      if (!attribution[assetClass]) {
        attribution[assetClass] = { value: 0, cost: 0, gain: 0 };
      }
      attribution[assetClass].value += value;
      attribution[assetClass].cost += cost;
      attribution[assetClass].gain += gain;
    }

    // Calculate return contribution per class
    for (const [cls, data] of Object.entries(attribution)) {
      data.returnPct = data.cost > 0 ? data.gain / data.cost : 0;
      data.contribution = totalCost > 0 ? data.gain / totalCost : 0;
      data.weight = totalValue > 0 ? data.value / totalValue : 0;
    }

    // Top/bottom performers
    const performers = lots.rows.map(h => ({
      symbol: h.symbol,
      value: parseFloat(h.current_value || 0),
      cost: parseFloat(h.cost_basis || 0),
      gain: parseFloat(h.current_value || 0) - parseFloat(h.cost_basis || 0),
      returnPct: parseFloat(h.cost_basis || 0) > 0
        ? (parseFloat(h.current_value || 0) - parseFloat(h.cost_basis || 0)) / parseFloat(h.cost_basis || 0)
        : 0,
    })).sort((a, b) => b.returnPct - a.returnPct);

    return {
      totalValue,
      totalCost,
      totalReturn,
      attribution,
      topPerformers: performers.slice(0, 5),
      bottomPerformers: performers.slice(-5).reverse(),
    };
  }
}

export default FocusService;
