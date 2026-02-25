/**
 * Proposify API Routes
 * 
 * POST   /api/v1/proposify              - Create proposal
 * GET    /api/v1/proposify/:id          - Get proposal
 * PUT    /api/v1/proposify/:id          - Update proposal
 * DELETE /api/v1/proposify/:id          - Delete proposal
 * POST   /api/v1/proposify/:id/send     - Mark as sent
 * POST   /api/v1/proposify/:id/view     - Mark as viewed (tracking)
 * POST   /api/v1/proposify/:id/sign     - Mark as signed
 * GET    /api/v1/proposify/:id/events   - Get tracking events
 * POST   /api/v1/proposify/:id/calculate - Recalculate fees/value
 * GET    /api/v1/proposify-templates    - List templates
 */

import express from 'express';
import { ProposifyService } from '../services/proposify-service.js';
import pool from '../db/pool.js';

const router = express.Router();
const proposifyService = new ProposifyService();

/**
 * Create a new proposal.
 */
router.post('/', async (req, res) => {
  try {
    const proposal = await proposifyService.createProposal(req.body);

    res.json({
      success: true,
      proposal,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({
      error: 'Failed to create proposal',
      message: error.message,
    });
  }
});

/**
 * Get proposal by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const proposal = await proposifyService.getProposal(req.params.id);

    res.json({
      success: true,
      proposal,
    });

  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: 'Failed to get proposal', message: error.message });
  }
});

/**
 * Update proposal.
 */
router.put('/:id', async (req, res) => {
  try {
    const proposal = await proposifyService.updateProposal(req.params.id, req.body);

    res.json({
      success: true,
      proposal,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to update proposal', message: error.message });
  }
});

/**
 * Delete proposal.
 */
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM proposals WHERE id = $1', [req.params.id]);

    res.json({
      success: true,
      message: 'Proposal deleted',
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to delete proposal', message: error.message });
  }
});

/**
 * Mark proposal as sent.
 */
router.post('/:id/send', async (req, res) => {
  try {
    const proposal = await proposifyService.markAsSent(req.params.id);

    res.json({
      success: true,
      proposal,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to mark as sent', message: error.message });
  }
});

/**
 * Mark proposal as viewed (tracking endpoint).
 */
router.post('/:id/view', async (req, res) => {
  try {
    const proposal = await proposifyService.markAsViewed(req.params.id);

    res.json({
      success: true,
      proposal,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to mark as viewed', message: error.message });
  }
});

/**
 * Mark proposal as signed.
 */
router.post('/:id/sign', async (req, res) => {
  try {
    const proposal = await proposifyService.markAsSigned(req.params.id);

    res.json({
      success: true,
      proposal,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to mark as signed', message: error.message });
  }
});

/**
 * Generate PDF for proposal.
 */
router.post('/:id/pdf', async (req, res) => {
  try {
    const result = await proposifyService.generatePDF(req.params.id);

    res.json({
      success: true,
      pdfUrl: result.pdfUrl,
      size: result.size,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'PDF generation failed', message: error.message });
  }
});

/**
 * Get proposal tracking events.
 */
router.get('/:id/events', async (req, res) => {
  try {
    const events = await proposifyService.getEvents(req.params.id);

    res.json({
      success: true,
      events,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to get events', message: error.message });
  }
});

/**
 * Calculate fees and value (utility endpoint).
 */
router.post('/:id/calculate', async (req, res) => {
  try {
    const {
      portfolioSize,
      feeType,
      feePercentage,
      feeFlat,
      taxAlphaPercentage,
    } = req.body;

    const calculations = proposifyService.calculateValue({
      portfolioSize,
      feeType,
      feePercentage,
      feeFlat,
      taxAlphaPercentage,
    });

    res.json({
      success: true,
      calculations,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Calculation failed', message: error.message });
  }
});

/**
 * List proposal templates.
 */
router.get('/templates/list', async (req, res) => {
  try {
    const { category } = req.query;
    const templates = await proposifyService.listTemplates(category);

    res.json({
      success: true,
      templates,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to list templates', message: error.message });
  }
});

/**
 * List all proposals (with filters).
 */
router.get('/', async (req, res) => {
  try {
    const filters = {
      householdId: req.query.householdId,
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50,
      offset: parseInt(req.query.offset) || 0,
    };

    const proposals = await proposifyService.listProposals(filters);

    res.json({
      success: true,
      proposals,
      count: proposals.length,
    });

  } catch (error) {
    console.error('[Proposify API Error]', error.message);
    res.status(500).json({ error: 'Failed to list proposals', message: error.message });
  }
});

export default router;
