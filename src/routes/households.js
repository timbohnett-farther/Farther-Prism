/**
 * Farther Prism - Household API Routes
 * 
 * RESTful endpoints for the Planning Graph:
 * - POST   /api/v1/households              - Create household
 * - GET    /api/v1/households              - List households
 * - GET    /api/v1/households/:id          - Get household
 * - GET    /api/v1/households/:id/graph    - Get full household graph
 * - PATCH  /api/v1/households/:id          - Update household
 * - DELETE /api/v1/households/:id          - Archive household
 * 
 * - POST   /api/v1/households/:id/people           - Add person
 * - GET    /api/v1/households/:id/people            - List people
 * - PATCH  /api/v1/households/:id/people/:pid       - Update person
 * - DELETE /api/v1/households/:id/people/:pid       - Deactivate person
 * 
 * - POST   /api/v1/households/:id/entities          - Add entity
 * - GET    /api/v1/households/:id/entities           - List entities
 * - PATCH  /api/v1/households/:id/entities/:eid      - Update entity
 * - DELETE /api/v1/households/:id/entities/:eid       - Delete entity
 * 
 * - POST   /api/v1/households/:id/relationships      - Add relationship
 * - GET    /api/v1/households/:id/relationships       - List relationships
 * - DELETE /api/v1/households/:id/relationships/:rid  - Delete relationship
 * 
 * - POST   /api/v1/households/:id/accounts            - Add account
 * - GET    /api/v1/households/:id/accounts             - List accounts
 * - PATCH  /api/v1/households/:id/accounts/:aid        - Update account
 * 
 * - POST   /api/v1/households/:id/income-streams      - Add income stream
 * - GET    /api/v1/households/:id/income-streams       - List income streams
 * 
 * - POST   /api/v1/households/:id/expense-streams     - Add expense stream
 * - GET    /api/v1/households/:id/expense-streams      - List expense streams
 * 
 * - POST   /api/v1/households/:id/goals               - Add goal
 * - GET    /api/v1/households/:id/goals                - List goals
 */

import { Router } from 'express';
import {
  households,
  people,
  entities,
  relationships,
  accounts,
  incomeStreams,
  expenseStreams,
  goals,
} from '../services/household-service.js';

const router = Router();

// ============================================================================
// MIDDLEWARE: Validate UUID format
// ============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateUUID(param) {
  return (req, res, next) => {
    if (!UUID_REGEX.test(req.params[param])) {
      return res.status(400).json({ error: `Invalid UUID format for ${param}` });
    }
    next();
  };
}

// Async error wrapper
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ============================================================================
// HOUSEHOLDS
// ============================================================================

// Create household
router.post('/', wrap(async (req, res) => {
  const { name, primaryAdvisorId, serviceTier, tags, notes } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'name is required' });
  }

  const household = await households.create({ name, primaryAdvisorId, serviceTier, tags, notes });
  res.status(201).json(household);
}));

// List households
router.get('/', wrap(async (req, res) => {
  const { status, limit, offset, search } = req.query;
  const result = await households.list({
    status,
    limit: parseInt(limit) || 50,
    offset: parseInt(offset) || 0,
    search,
  });
  res.json(result);
}));

// Get household by ID
router.get('/:id', validateUUID('id'), wrap(async (req, res) => {
  const household = await households.getById(req.params.id);
  if (!household) return res.status(404).json({ error: 'Household not found' });
  res.json(household);
}));

// Get full household graph
router.get('/:id/graph', validateUUID('id'), wrap(async (req, res) => {
  const graph = await households.getFullGraph(req.params.id);
  if (!graph) return res.status(404).json({ error: 'Household not found' });
  res.json(graph);
}));

// Update household
router.patch('/:id', validateUUID('id'), wrap(async (req, res) => {
  const household = await households.update(req.params.id, req.body);
  if (!household) return res.status(404).json({ error: 'Household not found' });
  res.json(household);
}));

// Archive household
router.delete('/:id', validateUUID('id'), wrap(async (req, res) => {
  const household = await households.archive(req.params.id);
  if (!household) return res.status(404).json({ error: 'Household not found' });
  res.json({ message: 'Household archived', household });
}));

// ============================================================================
// PEOPLE
// ============================================================================

router.post('/:id/people', validateUUID('id'), wrap(async (req, res) => {
  const { firstName, lastName, dob, stateResidence } = req.body;
  if (!firstName || !lastName || !dob || !stateResidence) {
    return res.status(400).json({ error: 'firstName, lastName, dob, and stateResidence are required' });
  }
  const person = await people.create(req.params.id, req.body);
  res.status(201).json(person);
}));

router.get('/:id/people', validateUUID('id'), wrap(async (req, res) => {
  const result = await people.listByHousehold(req.params.id);
  res.json(result);
}));

router.patch('/:id/people/:pid', validateUUID('id'), validateUUID('pid'), wrap(async (req, res) => {
  const person = await people.update(req.params.pid, req.body);
  if (!person) return res.status(404).json({ error: 'Person not found' });
  res.json(person);
}));

router.delete('/:id/people/:pid', validateUUID('id'), validateUUID('pid'), wrap(async (req, res) => {
  const person = await people.deactivate(req.params.pid);
  if (!person) return res.status(404).json({ error: 'Person not found' });
  res.json({ message: 'Person deactivated', person });
}));

// ============================================================================
// ENTITIES
// ============================================================================

router.post('/:id/entities', validateUUID('id'), wrap(async (req, res) => {
  const { entityName, entityType } = req.body;
  if (!entityName || !entityType) {
    return res.status(400).json({ error: 'entityName and entityType are required' });
  }
  const entity = await entities.create(req.params.id, req.body);
  res.status(201).json(entity);
}));

router.get('/:id/entities', validateUUID('id'), wrap(async (req, res) => {
  const result = await entities.listByHousehold(req.params.id);
  res.json(result);
}));

router.patch('/:id/entities/:eid', validateUUID('id'), validateUUID('eid'), wrap(async (req, res) => {
  const entity = await entities.update(req.params.eid, req.body);
  if (!entity) return res.status(404).json({ error: 'Entity not found' });
  res.json(entity);
}));

router.delete('/:id/entities/:eid', validateUUID('id'), validateUUID('eid'), wrap(async (req, res) => {
  const entity = await entities.delete(req.params.eid);
  if (!entity) return res.status(404).json({ error: 'Entity not found' });
  res.json({ message: 'Entity deleted', entity });
}));

// ============================================================================
// RELATIONSHIPS
// ============================================================================

router.post('/:id/relationships', validateUUID('id'), wrap(async (req, res) => {
  const { personId, relatedPersonId, relationshipType } = req.body;
  if (!personId || !relatedPersonId || !relationshipType) {
    return res.status(400).json({ error: 'personId, relatedPersonId, and relationshipType are required' });
  }
  const relationship = await relationships.create(req.params.id, req.body);
  res.status(201).json(relationship);
}));

router.get('/:id/relationships', validateUUID('id'), wrap(async (req, res) => {
  const result = await relationships.listByHousehold(req.params.id);
  res.json(result);
}));

router.delete('/:id/relationships/:rid', validateUUID('id'), validateUUID('rid'), wrap(async (req, res) => {
  const relationship = await relationships.delete(req.params.rid);
  if (!relationship) return res.status(404).json({ error: 'Relationship not found' });
  res.json({ message: 'Relationship deleted', relationship });
}));

// ============================================================================
// ACCOUNTS
// ============================================================================

router.post('/:id/accounts', validateUUID('id'), wrap(async (req, res) => {
  const { accountType, accountName } = req.body;
  if (!accountType || !accountName) {
    return res.status(400).json({ error: 'accountType and accountName are required' });
  }
  const account = await accounts.create(req.params.id, req.body);
  res.status(201).json(account);
}));

router.get('/:id/accounts', validateUUID('id'), wrap(async (req, res) => {
  const result = await accounts.listByHousehold(req.params.id, req.query);
  res.json(result);
}));

router.patch('/:id/accounts/:aid', validateUUID('id'), validateUUID('aid'), wrap(async (req, res) => {
  const account = await accounts.update(req.params.aid, req.body);
  if (!account) return res.status(404).json({ error: 'Account not found' });
  res.json(account);
}));

// ============================================================================
// INCOME STREAMS
// ============================================================================

router.post('/:id/income-streams', validateUUID('id'), wrap(async (req, res) => {
  const { incomeType, description, baseAmount, amountFrequency, startDate } = req.body;
  if (!incomeType || !description || !baseAmount || !amountFrequency || !startDate) {
    return res.status(400).json({ error: 'incomeType, description, baseAmount, amountFrequency, startDate are required' });
  }
  const stream = await incomeStreams.create(req.params.id, req.body);
  res.status(201).json(stream);
}));

router.get('/:id/income-streams', validateUUID('id'), wrap(async (req, res) => {
  const result = await incomeStreams.listByHousehold(req.params.id);
  res.json(result);
}));

// ============================================================================
// EXPENSE STREAMS
// ============================================================================

router.post('/:id/expense-streams', validateUUID('id'), wrap(async (req, res) => {
  const { description, baseAmount, amountFrequency, startDate } = req.body;
  if (!description || !baseAmount || !amountFrequency || !startDate) {
    return res.status(400).json({ error: 'description, baseAmount, amountFrequency, startDate are required' });
  }
  const stream = await expenseStreams.create(req.params.id, req.body);
  res.status(201).json(stream);
}));

router.get('/:id/expense-streams', validateUUID('id'), wrap(async (req, res) => {
  const result = await expenseStreams.listByHousehold(req.params.id);
  res.json(result);
}));

// ============================================================================
// GOALS
// ============================================================================

router.post('/:id/goals', validateUUID('id'), wrap(async (req, res) => {
  const { goalType, goalName } = req.body;
  if (!goalType || !goalName) {
    return res.status(400).json({ error: 'goalType and goalName are required' });
  }
  const goal = await goals.create(req.params.id, req.body);
  res.status(201).json(goal);
}));

router.get('/:id/goals', validateUUID('id'), wrap(async (req, res) => {
  const result = await goals.listByHousehold(req.params.id);
  res.json(result);
}));

// ============================================================================
// ERROR HANDLER
// ============================================================================

router.use((err, req, res, next) => {
  console.error(`[Household API Error] ${req.method} ${req.path}:`, err.message);
  
  // PostgreSQL error codes
  if (err.code === '23505') {
    return res.status(409).json({ error: 'Duplicate entry', detail: err.detail });
  }
  if (err.code === '23503') {
    return res.status(400).json({ error: 'Referenced entity not found', detail: err.detail });
  }
  if (err.code === '23514') {
    return res.status(400).json({ error: 'Constraint violation', detail: err.detail });
  }
  if (err.code === '22P02') {
    return res.status(400).json({ error: 'Invalid enum value', detail: err.message });
  }

  res.status(500).json({ error: 'Internal server error' });
});

export default router;
