/**
 * Focus API Routes - Portfolio Analytics & Optimization
 */

import express from 'express';
import { FocusService } from '../services/focus-service.js';

const router = express.Router();
const focusService = new FocusService();

// Portfolio overview
router.get('/:householdId/overview', async (req, res) => {
  try {
    const result = await focusService.getOverview(req.params.householdId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Performance attribution
router.get('/:householdId/performance', async (req, res) => {
  try {
    const result = await focusService.getPerformance(req.params.householdId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Allocation drift analysis
router.get('/:householdId/allocation', async (req, res) => {
  try {
    const result = await focusService.getAllocationDrift(req.params.householdId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Set allocation targets
router.post('/:householdId/allocation', async (req, res) => {
  try {
    await focusService.setAllocationTargets(req.params.householdId, req.body.targets);
    res.json({ success: true, message: 'Allocation targets updated' });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Tax-loss harvesting opportunities
router.get('/:householdId/tax-loss', async (req, res) => {
  try {
    const marginalRate = parseFloat(req.query.taxRate) || 0.37;
    const result = await focusService.scanTaxLossOpportunities(req.params.householdId, marginalRate);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Rebalancing recommendations
router.get('/:householdId/rebalance', async (req, res) => {
  try {
    const result = await focusService.generateRebalanceRecommendation(req.params.householdId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Fee analysis
router.get('/:householdId/fees', async (req, res) => {
  try {
    const result = await focusService.analyzeFees(req.params.householdId);
    res.json({ success: true, ...result });
  } catch (error) {
    console.error('[Focus API Error]', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;
