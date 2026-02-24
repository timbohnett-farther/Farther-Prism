/**
 * Farther Prism - Household Service (Planning Graph)
 * 
 * CRUD operations for the household identity graph:
 * - Households (root node)
 * - People (members)
 * - Entities (trusts, LLCs)
 * - Relationships (spouse, child, dependent)
 * - Ownership (who owns what)
 * - Accounts (financial accounts)
 * 
 * All mutations are audited via database triggers.
 */

import { query, withTransaction } from '../db/pool.js';

// ============================================================================
// HOUSEHOLDS
// ============================================================================

export const households = {
  /**
   * Create a new household.
   */
  async create({ name, householdName, primaryAdvisorId, serviceTier, tags, notes }) {
    const finalName = householdName || name; // Support both old and new param names
    const result = await query(
      `INSERT INTO households (household_name, primary_advisor_id, metadata)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [finalName, primaryAdvisorId, { serviceTier, tags, notes }]
    );
    return result.rows[0];
  },

  /**
   * Get household by ID with summary stats.
   */
  async getById(id) {
    const result = await query(
      `SELECT h.*,
        (SELECT COUNT(*) FROM people WHERE household_id = h.id AND status = 'active') AS people_count,
        (SELECT COUNT(*) FROM accounts WHERE household_id = h.id AND status = 'active') AS account_count,
        (SELECT COUNT(*) FROM plans WHERE household_id = h.id AND status != 'archived') AS plan_count
       FROM households h
       WHERE h.id = $1`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * List households with pagination and filtering.
   */
  async list({ status = 'active', limit = 50, offset = 0, search } = {}) {
    let sql = `
      SELECT h.*, 
        (SELECT COUNT(*) FROM people WHERE household_id = h.id AND status = 'active') AS people_count,
        (SELECT COUNT(*) FROM accounts WHERE household_id = h.id AND status = 'active') AS account_count
      FROM households h
      WHERE 1=1
    `;
    const params = [];
    let paramIdx = 1;

    if (status) {
      sql += ` AND h.status = $${paramIdx++}`;
      params.push(status);
    }

    if (search) {
      sql += ` AND h.household_name ILIKE $${paramIdx++}`;
      params.push(`%${search}%`);
    }

    sql += ` ORDER BY h.updated_at DESC LIMIT $${paramIdx++} OFFSET $${paramIdx++}`;
    params.push(limit, offset);

    const result = await query(sql, params);
    return result.rows;
  },

  /**
   * Update household.
   */
  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    for (const [key, value] of Object.entries(updates)) {
      const column = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return this.getById(id);

    const result = await query(
      `UPDATE households SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  /**
   * Archive (soft delete) a household.
   */
  async archive(id) {
    const result = await query(
      `UPDATE households SET status = 'archived' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },

  /**
   * Get full household graph (people, entities, accounts, etc.)
   */
  async getFullGraph(id) {
    const [household, people, entities, relationships, accounts] = await Promise.all([
      this.getById(id),
      query('SELECT * FROM people WHERE household_id = $1 AND status = $2 ORDER BY is_primary DESC, last_name', [id, 'active']),
      query('SELECT * FROM entities WHERE household_id = $1 ORDER BY entity_name', [id]),
      query(`SELECT r.*, 
              p1.first_name || ' ' || p1.last_name AS person_name,
              p2.first_name || ' ' || p2.last_name AS related_person_name
             FROM relationships r
             JOIN people p1 ON r.person_id = p1.id
             JOIN people p2 ON r.related_person_id = p2.id
             WHERE r.household_id = $1`, [id]),
      query('SELECT * FROM accounts WHERE household_id = $1 AND status = $2 ORDER BY account_name', [id, 'active']),
    ]);

    if (!household) return null;

    return {
      ...household,
      people: people.rows,
      entities: entities.rows,
      relationships: relationships.rows,
      accounts: accounts.rows,
    };
  },
};

// ============================================================================
// PEOPLE
// ============================================================================

export const people = {
  /**
   * Add a person to a household.
   */
  async create(householdId, {
    firstName, middleName, lastName, legalName, preferredName,
    dob, ssnLast4, citizenship, stateResidence, taxDomicile,
    healthRating, smokerFlag, isPrimary,
  }) {
    const result = await query(
      `INSERT INTO people (
        household_id, first_name, middle_name, last_name, legal_name, preferred_name,
        dob, ssn_last4, citizenship, state_residence, tax_domicile,
        health_rating, smoker_flag, is_primary
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      RETURNING *`,
      [
        householdId, firstName, middleName, lastName, legalName, preferredName,
        dob, ssnLast4, citizenship || 'USA', stateResidence, taxDomicile,
        healthRating, smokerFlag || false, isPrimary || false,
      ]
    );
    return result.rows[0];
  },

  /**
   * Get person by ID.
   */
  async getById(id) {
    const result = await query('SELECT * FROM people WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  /**
   * List people in a household.
   */
  async listByHousehold(householdId) {
    const result = await query(
      `SELECT * FROM people WHERE household_id = $1 AND status = 'active' 
       ORDER BY is_primary DESC, last_name, first_name`,
      [householdId]
    );
    return result.rows;
  },

  /**
   * Update a person.
   */
  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    const columnMap = {
      firstName: 'first_name', middleName: 'middle_name', lastName: 'last_name',
      legalName: 'legal_name', preferredName: 'preferred_name', dob: 'dob',
      ssnLast4: 'ssn_last4', citizenship: 'citizenship', stateResidence: 'state_residence',
      taxDomicile: 'tax_domicile', healthRating: 'health_rating', smokerFlag: 'smoker_flag',
      isPrimary: 'is_primary', status: 'status',
    };

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key] || key;
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return this.getById(id);

    const result = await query(
      `UPDATE people SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  /**
   * Soft delete a person.
   */
  async deactivate(id) {
    const result = await query(
      `UPDATE people SET status = 'inactive' WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },
};

// ============================================================================
// ENTITIES
// ============================================================================

export const entities = {
  async create(householdId, { entityName, entityType, taxIdLast4, stateOfFormation, formationDate, passThrough }) {
    const result = await query(
      `INSERT INTO entities (household_id, entity_name, entity_type, tax_id_last4, state_of_formation, formation_date, pass_through)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [householdId, entityName, entityType, taxIdLast4, stateOfFormation, formationDate, passThrough ?? true]
    );
    return result.rows[0];
  },

  async getById(id) {
    const result = await query('SELECT * FROM entities WHERE id = $1', [id]);
    return result.rows[0] || null;
  },

  async listByHousehold(householdId) {
    const result = await query(
      'SELECT * FROM entities WHERE household_id = $1 ORDER BY entity_name',
      [householdId]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    const columnMap = {
      entityName: 'entity_name', entityType: 'entity_type', taxIdLast4: 'tax_id_last4',
      stateOfFormation: 'state_of_formation', formationDate: 'formation_date', passThrough: 'pass_through',
    };

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key] || key;
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return this.getById(id);

    const result = await query(
      `UPDATE entities SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async delete(id) {
    const result = await query('DELETE FROM entities WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  },
};

// ============================================================================
// RELATIONSHIPS
// ============================================================================

export const relationships = {
  async create(householdId, { personId, relatedPersonId, relationshipType, dependent, supportPercentage }) {
    const result = await query(
      `INSERT INTO relationships (household_id, person_id, related_person_id, relationship_type, dependent, support_percentage)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [householdId, personId, relatedPersonId, relationshipType, dependent || false, supportPercentage]
    );
    return result.rows[0];
  },

  async listByHousehold(householdId) {
    const result = await query(
      `SELECT r.*, 
        p1.first_name || ' ' || p1.last_name AS person_name,
        p2.first_name || ' ' || p2.last_name AS related_person_name
       FROM relationships r
       JOIN people p1 ON r.person_id = p1.id
       JOIN people p2 ON r.related_person_id = p2.id
       WHERE r.household_id = $1`,
      [householdId]
    );
    return result.rows;
  },

  async delete(id) {
    const result = await query('DELETE FROM relationships WHERE id = $1 RETURNING *', [id]);
    return result.rows[0] || null;
  },
};

// ============================================================================
// ACCOUNTS
// ============================================================================

export const accounts = {
  async create(householdId, {
    accountType, accountName, custodian, taxTreatment,
    registrationType, openedDate, dataSource, externalAccountId,
  }) {
    // Derive tax treatment from account type if not provided
    const derivedTaxTreatment = taxTreatment || deriveTaxTreatment(accountType);

    const result = await query(
      `INSERT INTO accounts (
        household_id, account_type, account_name, custodian, tax_treatment,
        registration_type, opened_date, data_source, external_account_id
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        householdId, accountType, accountName, custodian, derivedTaxTreatment,
        registrationType, openedDate, dataSource, externalAccountId,
      ]
    );
    return result.rows[0];
  },

  async getById(id) {
    const result = await query(
      `SELECT a.*,
        COALESCE(SUM(p.market_value), 0) AS total_value,
        COUNT(DISTINCT p.security_id) AS position_count
       FROM accounts a
       LEFT JOIN positions p ON a.id = p.account_id
       WHERE a.id = $1
       GROUP BY a.id`,
      [id]
    );
    return result.rows[0] || null;
  },

  async listByHousehold(householdId, { status = 'active' } = {}) {
    const result = await query(
      `SELECT a.*,
        COALESCE(SUM(p.market_value), 0) AS total_value,
        COUNT(DISTINCT p.security_id) AS position_count
       FROM accounts a
       LEFT JOIN positions p ON a.id = p.account_id
       WHERE a.household_id = $1 AND a.status = $2
       GROUP BY a.id
       ORDER BY a.account_name`,
      [householdId, status]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    const columnMap = {
      accountType: 'account_type', accountName: 'account_name', custodian: 'custodian',
      taxTreatment: 'tax_treatment', registrationType: 'registration_type',
      openedDate: 'opened_date', closedDate: 'closed_date',
      dataSource: 'data_source', externalAccountId: 'external_account_id', status: 'status',
    };

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key] || key;
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return this.getById(id);

    const result = await query(
      `UPDATE accounts SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async close(id) {
    const result = await query(
      `UPDATE accounts SET status = 'closed', closed_date = CURRENT_DATE WHERE id = $1 RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  },
};

// ============================================================================
// INCOME STREAMS
// ============================================================================

export const incomeStreams = {
  async create(householdId, {
    personId, entityId, incomeType, description, baseAmount,
    amountFrequency, growthRate, inflationIndexed, taxCharacter,
    startDate, endDate,
  }) {
    const result = await query(
      `INSERT INTO income_streams (
        household_id, person_id, entity_id, income_type, description,
        base_amount, amount_frequency, growth_rate, inflation_indexed,
        tax_character, start_date, end_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [
        householdId, personId, entityId, incomeType, description,
        baseAmount, amountFrequency, growthRate || 0, inflationIndexed || false,
        taxCharacter || 'ordinary', startDate, endDate,
      ]
    );
    return result.rows[0];
  },

  async listByHousehold(householdId) {
    const result = await query(
      `SELECT is2.*,
        p.first_name || ' ' || p.last_name AS person_name
       FROM income_streams is2
       LEFT JOIN people p ON is2.person_id = p.id
       WHERE is2.household_id = $1 AND is2.active = true
       ORDER BY is2.income_type, is2.base_amount DESC`,
      [householdId]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    const columnMap = {
      personId: 'person_id', entityId: 'entity_id', incomeType: 'income_type',
      description: 'description', baseAmount: 'base_amount',
      amountFrequency: 'amount_frequency', growthRate: 'growth_rate',
      inflationIndexed: 'inflation_indexed', taxCharacter: 'tax_character',
      startDate: 'start_date', endDate: 'end_date', active: 'active',
    };

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key] || key;
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return null;

    const result = await query(
      `UPDATE income_streams SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async deactivate(id) {
    return query('UPDATE income_streams SET active = false WHERE id = $1 RETURNING *', [id]).then(r => r.rows[0]);
  },
};

// ============================================================================
// EXPENSE STREAMS
// ============================================================================

export const expenseStreams = {
  async create(householdId, {
    expenseCategoryId, description, baseAmount, amountFrequency,
    inflationRate, isDiscretionary, taxDeductible, deductionPercentage,
    startDate, endDate,
  }) {
    const result = await query(
      `INSERT INTO expense_streams (
        household_id, expense_category_id, description, base_amount, amount_frequency,
        inflation_rate, is_discretionary, tax_deductible, deduction_percentage,
        start_date, end_date
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        householdId, expenseCategoryId, description, baseAmount, amountFrequency,
        inflationRate, isDiscretionary || false, taxDeductible || false,
        deductionPercentage, startDate, endDate,
      ]
    );
    return result.rows[0];
  },

  async listByHousehold(householdId) {
    const result = await query(
      `SELECT es.*, ec.category_name
       FROM expense_streams es
       LEFT JOIN expense_categories ec ON es.expense_category_id = ec.id
       WHERE es.household_id = $1 AND es.active = true
       ORDER BY es.is_discretionary, es.base_amount DESC`,
      [householdId]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    const columnMap = {
      expenseCategoryId: 'expense_category_id', description: 'description',
      baseAmount: 'base_amount', amountFrequency: 'amount_frequency',
      inflationRate: 'inflation_rate', isDiscretionary: 'is_discretionary',
      taxDeductible: 'tax_deductible', deductionPercentage: 'deduction_percentage',
      startDate: 'start_date', endDate: 'end_date', active: 'active',
    };

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key] || key;
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return null;

    const result = await query(
      `UPDATE expense_streams SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },

  async deactivate(id) {
    return query('UPDATE expense_streams SET active = false WHERE id = $1 RETURNING *', [id]).then(r => r.rows[0]);
  },
};

// ============================================================================
// GOALS
// ============================================================================

export const goals = {
  async create(householdId, {
    goalType, goalName, description, priority,
    targetAmount, targetDate, successMetric, successThreshold,
  }) {
    const result = await query(
      `INSERT INTO goals (
        household_id, goal_type, goal_name, description, priority,
        target_amount, target_date, success_metric, success_threshold
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [
        householdId, goalType, goalName, description, priority || 3,
        targetAmount, targetDate, successMetric || 'deterministic', successThreshold,
      ]
    );
    return result.rows[0];
  },

  async listByHousehold(householdId) {
    const result = await query(
      'SELECT * FROM goals WHERE household_id = $1 AND active = true ORDER BY priority, goal_name',
      [householdId]
    );
    return result.rows;
  },

  async update(id, updates) {
    const fields = [];
    const params = [id];
    let paramIdx = 2;

    const columnMap = {
      goalType: 'goal_type', goalName: 'goal_name', description: 'description',
      priority: 'priority', targetAmount: 'target_amount', targetDate: 'target_date',
      successMetric: 'success_metric', successThreshold: 'success_threshold', active: 'active',
    };

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key] || key;
      fields.push(`${column} = $${paramIdx++}`);
      params.push(value);
    }

    if (fields.length === 0) return null;

    const result = await query(
      `UPDATE goals SET ${fields.join(', ')} WHERE id = $1 RETURNING *`,
      params
    );
    return result.rows[0] || null;
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function deriveTaxTreatment(accountType) {
  const taxFreeTypes = ['ira_roth', '401k_roth', 'hsa'];
  const deferredTypes = ['ira_traditional', 'ira_sep', 'ira_simple', '401k_traditional', '403b', '457', 'pension', 'annuity'];
  
  if (taxFreeTypes.includes(accountType)) return 'free';
  if (deferredTypes.includes(accountType)) return 'deferred';
  return 'taxable';
}
