/**
 * Statement Upload & Parsing Routes
 * 
 * POST   /api/v1/statements/upload     - Upload and parse statement
 * GET    /api/v1/statements/custodians - List supported custodians
 * POST   /api/v1/statements/reconcile  - Reconcile imported data
 */

import express from 'express';
import multer from 'multer';
import { StatementIngestionService } from '../services/statement-ingestion-service.js';

const router = express.Router();
const ingestionService = new StatementIngestionService();

// Configure multer for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    // Allow PDF and CSV files
    const allowedTypes = ['application/pdf', 'text/csv', 'application/vnd.ms-excel'];
    if (allowedTypes.includes(file.mimetype) || 
        file.originalname.match(/\.(pdf|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and CSV files are allowed'));
    }
  },
});

/**
 * Upload and parse a statement.
 */
router.post('/upload', upload.single('statement'), async (req, res) => {
  try {
    const { householdId } = req.body;
    
    if (!householdId) {
      return res.status(400).json({ error: 'householdId is required' });
    }
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    console.log(`[API] Statement upload: ${req.file.originalname} (${req.file.size} bytes)`);
    
    // Ingest the statement
    const result = await ingestionService.ingestStatement(householdId, {
      buffer: req.file.buffer,
      filename: req.file.originalname,
      mimeType: req.file.mimetype,
    });
    
    res.json(result);
    
  } catch (error) {
    console.error('[Statement Upload Error]', error.message);
    res.status(500).json({
      error: 'Statement parsing failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
});

/**
 * Get list of supported custodians.
 */
router.get('/custodians', (req, res) => {
  const custodians = ingestionService.getSupportedCustodians();
  res.json({
    supported: custodians,
    count: custodians.length,
  });
});

/**
 * Reconcile imported positions with existing data.
 */
router.post('/reconcile', async (req, res) => {
  try {
    const { householdId } = req.body;
    
    if (!householdId) {
      return res.status(400).json({ error: 'householdId is required' });
    }
    
    const result = await ingestionService.reconcilePositions(householdId);
    res.json(result);
    
  } catch (error) {
    console.error('[Reconciliation Error]', error.message);
    res.status(500).json({ error: 'Reconciliation failed', message: error.message });
  }
});

export default router;
