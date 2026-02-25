/**
 * Beyond API Routes - Alternative Investments
 */

import express from 'express';
import { BeyondService } from '../services/beyond-service.js';

const router = express.Router();
const beyondService = new BeyondService();

router.get('/investments', async (req, res) => {
  try {
    const investments = await beyondService.listInvestments(req.query);
    res.json({ success: true, investments });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/investments/:id', async (req, res) => {
  try {
    const investment = await beyondService.getInvestment(req.params.id);
    res.json({ success: true, investment });
  } catch (error) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const categories = await beyondService.getCategories();
    res.json({ success: true, categories });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/allocate', async (req, res) => {
  try {
    const { householdId, investmentId, amount } = req.body;
    const allocation = await beyondService.allocate(householdId, investmentId, amount);
    res.json({ success: true, allocation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/household/:householdId/allocations', async (req, res) => {
  try {
    const allocations = await beyondService.getHouseholdAllocations(req.params.householdId);
    res.json({ success: true, allocations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/suitability/:householdId/:investmentId', async (req, res) => {
  try {
    const result = await beyondService.getSuitabilityCheck(req.params.householdId, req.params.investmentId);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
