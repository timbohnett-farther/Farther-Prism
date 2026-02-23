/**
 * Farther Prism - Planning API Routes
 * 
 * Plans, Scenarios, Assumptions, Runs, and Results endpoints.
 */

import { Router } from 'express';
import {
  plans, scenarios, assumptionSets, returnModels,
  taxRuleSets, planRuns,
} from '../services/planning-service.js';

const router = Router();

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const validateUUID = (param) => (req, res, next) => {
  if (!UUID_REGEX.test(req.params[param])) return res.status(400).json({ error: `Invalid UUID: ${param}` });
  next();
};
const wrap = (fn) => (req, res, next) => fn(req, res, next).catch(next);

// ============================================================================
// PLANS
// ============================================================================

router.post('/', wrap(async (req, res) => {
  const { householdId, planName } = req.body;
  if (!householdId || !planName) return res.status(400).json({ error: 'householdId and planName required' });
  res.status(201).json(await plans.create(householdId, req.body));
}));

router.get('/household/:hid', validateUUID('hid'), wrap(async (req, res) => {
  res.json(await plans.listByHousehold(req.params.hid, req.query));
}));

router.get('/:id', validateUUID('id'), wrap(async (req, res) => {
  const plan = await plans.getById(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
}));

router.patch('/:id', validateUUID('id'), wrap(async (req, res) => {
  const plan = await plans.update(req.params.id, req.body);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json(plan);
}));

router.delete('/:id', validateUUID('id'), wrap(async (req, res) => {
  const plan = await plans.archive(req.params.id);
  if (!plan) return res.status(404).json({ error: 'Plan not found' });
  res.json({ message: 'Plan archived', plan });
}));

// ============================================================================
// SCENARIOS
// ============================================================================

router.post('/:id/scenarios', validateUUID('id'), wrap(async (req, res) => {
  const { scenarioName } = req.body;
  if (!scenarioName) return res.status(400).json({ error: 'scenarioName required' });
  res.status(201).json(await scenarios.create(req.params.id, req.body));
}));

router.get('/:id/scenarios', validateUUID('id'), wrap(async (req, res) => {
  res.json(await scenarios.listByPlan(req.params.id));
}));

// ============================================================================
// ASSUMPTION SETS
// ============================================================================

router.post('/scenarios/:sid/assumption-sets', validateUUID('sid'), wrap(async (req, res) => {
  const { valuationAsOfDate, inflationCpi, healthcareInflation, returnModelId, taxRuleSetFederalId } = req.body;
  if (!valuationAsOfDate || !inflationCpi || !healthcareInflation || !returnModelId || !taxRuleSetFederalId) {
    return res.status(400).json({ error: 'valuationAsOfDate, inflationCpi, healthcareInflation, returnModelId, taxRuleSetFederalId required' });
  }
  res.status(201).json(await assumptionSets.create(req.params.sid, req.body));
}));

router.get('/scenarios/:sid/assumption-sets', validateUUID('sid'), wrap(async (req, res) => {
  res.json(await assumptionSets.listByScenario(req.params.sid));
}));

router.get('/assumption-sets/:id', validateUUID('id'), wrap(async (req, res) => {
  const as = await assumptionSets.getById(req.params.id);
  if (!as) return res.status(404).json({ error: 'Assumption set not found' });
  res.json(as);
}));

// ============================================================================
// PLAN RUNS
// ============================================================================

router.post('/scenarios/:sid/runs', validateUUID('sid'), wrap(async (req, res) => {
  const { assumptionSetId, runType, horizonYears } = req.body;
  if (!assumptionSetId || !runType || !horizonYears) {
    return res.status(400).json({ error: 'assumptionSetId, runType, horizonYears required' });
  }
  const run = await planRuns.create(req.params.sid, assumptionSetId, req.body);
  // TODO: Queue run for execution via BullMQ
  res.status(201).json(run);
}));

router.get('/runs/:id', validateUUID('id'), wrap(async (req, res) => {
  const run = await planRuns.getById(req.params.id);
  if (!run) return res.status(404).json({ error: 'Run not found' });
  res.json(run);
}));

router.get('/runs/:id/status', validateUUID('id'), wrap(async (req, res) => {
  const status = await planRuns.getStatus(req.params.id);
  if (!status) return res.status(404).json({ error: 'Run not found' });
  res.json(status);
}));

router.get('/runs/:id/summary', validateUUID('id'), wrap(async (req, res) => {
  const summary = await planRuns.getSummary(req.params.id);
  if (!summary) return res.status(404).json({ error: 'Run not found' });
  res.json(summary);
}));

router.get('/runs/:id/timeseries', validateUUID('id'), wrap(async (req, res) => {
  const { dimension, percentile, limit, offset } = req.query;
  const ts = await planRuns.getTimeseries(req.params.id, {
    dimension,
    percentile: percentile !== undefined ? parseInt(percentile) : undefined,
    limit: parseInt(limit) || 500,
    offset: parseInt(offset) || 0,
  });
  res.json(ts);
}));

router.get('/runs/:id/recommendations', validateUUID('id'), wrap(async (req, res) => {
  res.json(await planRuns.getRecommendations(req.params.id));
}));

// ============================================================================
// REFERENCE DATA (Return Models & Tax Rule Sets)
// ============================================================================

router.get('/return-models', wrap(async (req, res) => {
  res.json(await returnModels.list());
}));

router.get('/return-models/:id', validateUUID('id'), wrap(async (req, res) => {
  const rm = await returnModels.getById(req.params.id);
  if (!rm) return res.status(404).json({ error: 'Return model not found' });
  res.json(rm);
}));

router.get('/tax-rule-sets', wrap(async (req, res) => {
  res.json(await taxRuleSets.list(req.query));
}));

router.get('/tax-rule-sets/:id', validateUUID('id'), wrap(async (req, res) => {
  const trs = await taxRuleSets.getById(req.params.id);
  if (!trs) return res.status(404).json({ error: 'Tax rule set not found' });
  res.json(trs);
}));

// ============================================================================
// ERROR HANDLER
// ============================================================================

router.use((err, req, res, next) => {
  console.error(`[Planning API Error] ${req.method} ${req.path}:`, err.message);
  if (err.code === '23505') return res.status(409).json({ error: 'Duplicate entry', detail: err.detail });
  if (err.code === '23503') return res.status(400).json({ error: 'Referenced entity not found', detail: err.detail });
  if (err.code === '23514') return res.status(400).json({ error: 'Constraint violation', detail: err.detail });
  res.status(500).json({ error: 'Internal server error' });
});

export default router;
