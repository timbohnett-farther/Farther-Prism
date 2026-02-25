/**
 * Beyond Service - Alternative Investments
 * 
 * Due diligence, opportunity scoring, and allocation tracking
 * for private equity, real estate, hedge funds, venture capital, and credit.
 */

import pool from '../db/pool.js';

const CATEGORY_LABELS = {
  private_equity: 'Private Equity',
  hedge_fund: 'Hedge Funds',
  real_estate: 'Real Estate',
  venture_capital: 'Venture Capital',
  credit: 'Credit / Direct Lending',
  infrastructure: 'Infrastructure',
  commodities: 'Commodities',
};

export class BeyondService {

  async listInvestments(filters = {}) {
    const { category, riskRating, status = 'active', limit = 50 } = filters;
    const conditions = ['status = $1'];
    const values = [status];
    let idx = 2;

    if (category) { conditions.push(`category = $${idx}`); values.push(category); idx++; }
    if (riskRating) { conditions.push(`risk_rating = $${idx}`); values.push(riskRating); idx++; }

    values.push(limit);
    const result = await pool.query(`
      SELECT * FROM alternative_investments
      WHERE ${conditions.join(' AND ')}
      ORDER BY due_diligence_score DESC
      LIMIT $${idx}
    `, values);

    return result.rows;
  }

  async getInvestment(investmentId) {
    const result = await pool.query('SELECT * FROM alternative_investments WHERE id = $1', [investmentId]);
    if (result.rows.length === 0) throw new Error(`Investment ${investmentId} not found`);
    return result.rows[0];
  }

  async getCategories() {
    const result = await pool.query(`
      SELECT category, COUNT(*) as count, AVG(due_diligence_score) as avg_score
      FROM alternative_investments WHERE status = 'active'
      GROUP BY category ORDER BY count DESC
    `);
    return result.rows.map(r => ({
      ...r,
      label: CATEGORY_LABELS[r.category] || r.category,
    }));
  }

  async allocate(householdId, investmentId, amount) {
    const result = await pool.query(`
      INSERT INTO alt_allocations (household_id, investment_id, amount, commitment_date)
      VALUES ($1, $2, $3, CURRENT_DATE)
      RETURNING *
    `, [householdId, investmentId, amount]);
    return result.rows[0];
  }

  async getHouseholdAllocations(householdId) {
    const result = await pool.query(`
      SELECT aa.*, ai.name, ai.category, ai.target_return, ai.target_yield, ai.risk_rating, ai.due_diligence_score
      FROM alt_allocations aa
      JOIN alternative_investments ai ON aa.investment_id = ai.id
      WHERE aa.household_id = $1
      ORDER BY aa.created_at DESC
    `, [householdId]);
    return result.rows;
  }

  async getSuitabilityCheck(householdId, investmentId) {
    const investment = await this.getInvestment(investmentId);

    // Get household total value
    const lots = await pool.query(`
      SELECT SUM(current_value) as total FROM lots l
      JOIN accounts a ON l.account_id = a.id
      WHERE a.household_id = $1
    `, [householdId]);

    const totalValue = parseFloat(lots.rows[0]?.total || 0);
    const minInvestment = parseFloat(investment.minimum_investment || 0);
    const maxAltAllocation = totalValue * 0.20; // Max 20% in alternatives (Farther guideline)

    // Get existing alt allocations
    const existing = await pool.query(`
      SELECT SUM(amount) as total FROM alt_allocations
      WHERE household_id = $1 AND status IN ('committed', 'funded')
    `, [householdId]);

    const existingAlts = parseFloat(existing.rows[0]?.total || 0);
    const remainingCapacity = maxAltAllocation - existingAlts;

    return {
      investment: investment.name,
      portfolioValue: totalValue,
      minimumInvestment: minInvestment,
      meetsMinimum: totalValue >= minInvestment * 5, // Can afford 5x minimum (reasonable threshold)
      maxAltAllocation,
      existingAltAllocations: existingAlts,
      remainingCapacity,
      hasCapacity: remainingCapacity >= minInvestment,
      riskRating: investment.risk_rating,
      lockupMonths: investment.lockup_months,
      recommendation: remainingCapacity >= minInvestment ? 'suitable' : 'exceeds_allocation_limit',
    };
  }
}

export default BeyondService;
