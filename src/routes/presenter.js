/**
 * Presenter API Routes
 */

import express from 'express';
import { PresenterService } from '../services/presenter-service.js';

const router = express.Router();
const presenterService = new PresenterService();

router.post('/', async (req, res) => {
  try {
    const presentation = await presenterService.createPresentation(req.body);
    res.json({ success: true, presentation });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const presentation = await presenterService.getPresentation(req.params.id);
    res.json({ success: true, presentation });
  } catch (error) {
    res.status(error.message.includes('not found') ? 404 : 500).json({ error: error.message });
  }
});

router.get('/household/:householdId', async (req, res) => {
  try {
    const presentations = await presenterService.listPresentations(req.params.householdId);
    res.json({ success: true, presentations });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/templates/list', async (req, res) => {
  try {
    const templates = await presenterService.listTemplates(req.query.type);
    res.json({ success: true, templates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
