/**
 * Farther Prism - Planning Service
 * 
 * CRUD for plans, scenarios, assumption sets, and plan runs.
 * Handles the immutable versioning pipeline:
 *   Plan → Scenario → Assumption Set → Plan Run → Results
 */

import { query, withTransaction } from '../db/pool.js';
import crypto from 'crypto';

// ============================================================================
// PLANS
// ============================================================================

export const plans = {
  async create(householdId, { planName, description }) {
    const result = await query(
      `INSERT INTO plans (household_id, plan_name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [householdId, planName, description]
    );
    return result.rows[0];
  },

  async getById(id) {
    const result = await query(
      `SELECT p.*,
        h.name AS household_name,
        (SELECT COUNT(*) FROM scenarios WHERE plan_id = p.id) AS scenario_count,
        (SELECT COUNT(*) FROM plan_runs pr 
         JOIN scenarios s ON pr.scenario_id = s.id 
         WHERE s.plan_id = p.id) AS run_count
       FROM plans p
       JOIN households h ON p.household_id = h.id
       WHERE p.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async listByHousehold(householdId, { status } = {}) {
    let sql = `
      SELECT p.*,
        (SELECT COUNT(*) FROM scenarios WHERE plan_id = p.id) AS scenario_count
      FROM plans p
      WHERE p.household_id = $1
    `;
    const params = [householdId];
    
    if (status) {
      sql += ' AND p.status = $2';
      params.push(status);
    }
    
    sql += ' ORDER BY p.updated_at DESC';
    
    const result = await query(sql, params);
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let idx = 2;

    const map = { planName: 'plan_name', description: 'description', status: 'status' };
    for (const [k, v] of Object.entries(updates)) {
      fields.push(`${map[k] || k} = $${idx++}`);
      params.push(v);
    }
    if (!fields.length) return this.getById(id);

    const result = await query(
      `UPDATE plans SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async archive(id) {
    return query(`UPDATE plans SET status = 'archived' WHERE id = $1 RETURNING *`, [id]).then(r => r.rows[0]);
  },
};

// ============================================================================
// SCENARIOS
// ============================================================================

export const scenarios = {
  async create(planId, { scenarioName, description }) {
    const result = await query(
      `INSERT INTO scenarios (plan_id, scenario_name, description)
       VALUES ($1, $2, $3) RETURNING *`,
      [planId, scenarioName, description]
    );
    return result.rows[0];
  },

  async getById(id) {
    const result = await query(
      `SELECT s.*, p.plan_name, p.household_id
       FROM scenarios s
       JOIN plans p ON s.plan_id = p.id
       WHERE s.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async listByPlan(planId) {
    const result = await query(
      `SELECT s.*,
        (SELECT COUNT(*) FROM assumption_sets WHERE scenario_id = s.id) AS assumption_set_count,
        (SELECT COUNT(*) FROM plan_runs WHERE scenario_id = s.id) AS run_count
       FROM scenarios s
       WHERE s.plan_id = $1
       ORDER BY s.created_at`,
      [planId]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let idx = 2;

    const map = { scenarioName: 'scenario_name', description: 'description', status: 'status' };
    for (const [k, v] of Object.entries(updates)) {
      fields.push(`${map[k] || k} = $${idx++}`);
      params.push(v);
    }
    if (!fields.length) return this.getById(id);

    const result = await query(
      `UPDATE scenarios SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },
};

// ============================================================================
// ASSUMPTION SETS
// ============================================================================

export const assumptionSets = {
  async create(scenarioId, {
    valuationAsOfDate, inflationCpi, healthcareInflation, educationInflation,
    longevityTable, longevityAdjustment, returnModelId,
    taxRuleSetFederalId, taxRuleSetStateId,
    safeWithdrawalRate, socialSecurityCola,
  }) {
    // Generate version hash for reproducibility
    const hashInput = [
      valuationAsOfDate, inflationCpi, healthcareInflation,
      returnModelId, taxRuleSetFederalId, taxRuleSetStateId,
    ].join('|');
    const versionHash = crypto.createHash('sha256').update(hashInput).digest('hex');

    const result = await query(
      `INSERT INTO assumption_sets (
        scenario_id, valuation_as_of_date, inflation_cpi, healthcare_inflation,
        education_inflation, longevity_table, longevity_adjustment,
        return_model_id, tax_rule_set_federal_id, tax_rule_set_state_id,
        safe_withdrawal_rate, social_security_cola, version_hash
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
      [
        scenarioId, valuationAsOfDate, inflationCpi, healthcareInflation,
        educationInflation, longevityTable, longevityAdjustment || 0,
        returnModelId, taxRuleSetFederalId, taxRuleSetStateId,
        safeWithdrawalRate, socialSecurityCola || 0.025, versionHash,
      ]
    );
    return result.rows[0];
  },

  async getById(id) {
    const result = await query(
      `SELECT a.*,
        rm.model_name AS return_model_name,
        trf.jurisdiction AS federal_jurisdiction,
        trf.tax_year AS federal_tax_year,
        trs.jurisdiction AS state_jurisdiction,
        trs.tax_year AS state_tax_year
       FROM assumption_sets a
       JOIN return_models rm ON a.return_model_id = rm.id
       JOIN tax_rule_sets trf ON a.tax_rule_set_federal_id = trf.id
       LEFT JOIN tax_rule_sets trs ON a.tax_rule_set_state_id = trs.id
       WHERE a.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async listByScenario(scenarioId) {
    const result = await query(
      `SELECT a.*, rm.model_name AS return_model_name
       FROM assumption_sets a
       JOIN return_models rm ON a.return_model_id = rm.id
       WHERE a.scenario_id = $1
       ORDER BY a.created_at DESC`,
      [scenarioId]
    );
    return result.rows;
  },
};

// ============================================================================
// RETURN MODELS
// ============================================================================

export const returnModels = {
  async list() {
    const result = await query(
      `SELECT id, model_name, description, effective_start, effective_end, version, created_at
       FROM return_models
       ORDER BY effective_start DESC`
    );
    return result.rows;
  },

  async getById(id) {
    const result = await query('SELECT * FROM return_models WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async create({ modelName, description, expectedReturns, covarianceMatrix, fatTailParams, effectiveStart, effectiveEnd, version }) {
    const result = await query(
      `INSERT INTO return_models (model_name, description, expected_returns, covariance_matrix, fat_tail_params, effective_start, effective_end, version)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [modelName, description, expectedReturns, covarianceMatrix, fatTailParams, effectiveStart, effectiveEnd, version]
    );
    return result.rows[0];
  },
};

// ============================================================================
// TAX RULE SETS
// ============================================================================

export const taxRuleSets = {
  async list({ jurisdiction, taxYear } = {}) {
    let sql = 'SELECT id, jurisdiction, tax_year, version, effective_start, effective_end, created_at FROM tax_rule_sets WHERE 1=1';
    const params = [];
    let idx = 1;

    if (jurisdiction) {
      sql += ` AND jurisdiction = $${idx++}`;
      params.push(jurisdiction);
    }
    if (taxYear) {
      sql += ` AND tax_year = $${idx++}`;
      params.push(taxYear);
    }

    sql += ' ORDER BY jurisdiction, tax_year DESC';
    const result = await query(sql, params);
    return result.rows;
  },

  async getById(id) {
    const result = await query('SELECT * FROM tax_rule_sets WHERE id = $1', [id]);
    return result.rows[0] || null;
  },
};

// ============================================================================
// PLAN RUNS
// ============================================================================

export const planRuns = {
  async create(scenarioId, assumptionSetId, {
    runType, runName, numSimulations, randomSeed, horizonYears,
    optimizationObjective, optimizationConstraints,
  }) {
    const result = await query(
      `INSERT INTO plan_runs (
        scenario_id, assumption_set_id, run_type, run_name,
        num_simulations, random_seed, horizon_years,
        optimization_objective, optimization_constraints,
        engine_version
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [
        scenarioId, assumptionSetId, runType, runName,
        numSimulations, randomSeed, horizonYears,
        optimizationObjective, optimizationConstraints,
        '1.0.0',
      ]
    );
    return result.rows[0];
  },

  async getById(id) {
    const result = await query(
      `SELECT pr.*,
        s.scenario_name,
        p.plan_name,
        p.household_id
       FROM plan_runs pr
       JOIN scenarios s ON pr.scenario_id = s.id
       JOIN plans p ON s.plan_id = p.id
       WHERE pr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async getStatus(id) {
    const result = await query(
      `SELECT id, run_status, progress_percentage, started_at, completed_at, error_message
       FROM plan_runs WHERE id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async updateStatus(id, { runStatus, progressPercentage, startedAt, completedAt, errorMessage }) {
    const fields = [];
    const params = [id];
    let idx = 2;

    if (runStatus) { fields.push(`run_status = $${idx++}`); params.push(runStatus); }
    if (progressPercentage !== undefined) { fields.push(`progress_percentage = $${idx++}`); params.push(progressPercentage); }
    if (startedAt) { fields.push(`started_at = $${idx++}`); params.push(startedAt); }
    if (completedAt) { fields.push(`completed_at = $${idx++}`); params.push(completedAt); }
    if (errorMessage) { fields.push(`error_message = $${idx++}`); params.push(errorMessage); }

    if (!fields.length) return this.getById(id);

    const result = await query(
      `UPDATE plan_runs SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async updateResults(id, { successProbability, medianTerminalWealth, p10TerminalWealth, p90TerminalWealth, maxDrawdownMedian }) {
    const result = await query(
      `UPDATE plan_runs SET 
        success_probability = $2,
        median_terminal_wealth = $3,
        p10_terminal_wealth = $4,
        p90_terminal_wealth = $5,
        max_drawdown_median = $6
       WHERE id = $1 RETURNING *`,
      [id, successProbability, medianTerminalWealth, p10TerminalWealth, p90TerminalWealth, maxDrawdownMedian]
    );
    return result.rows[0] || null;
  },

  async getSummary(id) {
    const result = await query(
      `SELECT 
        pr.id, pr.run_type, pr.run_status, pr.horizon_years, pr.num_simulations,
        pr.success_probability, pr.median_terminal_wealth,
        pr.p10_terminal_wealth, pr.p90_terminal_wealth,
        pr.max_drawdown_median,
        pr.queued_at, pr.started_at, pr.completed_at,
        EXTRACT(EPOCH FROM (pr.completed_at - pr.started_at)) AS duration_seconds
       FROM plan_runs pr
       WHERE pr.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  async getTimeseries(runId, { dimension, percentile, limit = 500, offset = 0 } = {}) {
    let sql = 'SELECT * FROM projection_timeseries WHERE plan_run_id = $1';
    const params = [runId];
    let idx = 2;

    if (dimension) {
      sql += ` AND dimension = $${idx++}`;
      params.push(dimension);
    }
    if (percentile !== undefined) {
      sql += ` AND percentile = $${idx++}`;
      params.push(percentile);
    }

    sql += ` ORDER BY time_index LIMIT $${idx++} OFFSET $${idx++}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  },

  async getRecommendations(runId) {
    const result = await query(
      `SELECT * FROM recommendations 
       WHERE plan_run_id = $1 
       ORDER BY priority, confidence_score DESC`,
      [runId]
    );
    return result.rows;
  },

  async listByScenario(scenarioId) {
    const result = await query(
      `SELECT * FROM plan_runs 
       WHERE scenario_id = $1 
       ORDER BY queued_at DESC`,
      [scenarioId]
    );
    return result.rows;
  },
};
