/**
 * Proposify Service
 * 
 * Handles proposal creation, fee calculations, and value ROI.
 * Incorporates Farther's value propositions and competitive positioning.
 */

import pool from '../db/pool.js';
import { PDFGenerator } from './pdf-generator.js';

const pdfGenerator = new PDFGenerator();

export class ProposifyService {
  /**
   * Create a new proposal.
   */
  async createProposal(data) {
    const {
      householdId,
      templateId,
      clientName,
      clientEmail,
      portfolioSize,
      feeType = 'aum',
      feePercentage,
      feeFlat,
      taxAlphaPercentage = 0.02, // Default 2% (Farther's advantage)
      customSections = [],
      branding = {},
    } = data;

    // Calculate fees and value
    const calculations = this.calculateValue({
      portfolioSize,
      feeType,
      feePercentage,
      feeFlat,
      taxAlphaPercentage,
    });

    const client = await pool.connect();

    try {
      const result = await client.query(`
        INSERT INTO proposals (
          household_id, template_id, status, client_name, client_email,
          portfolio_size, fee_type, fee_percentage, fee_flat, fee_annual,
          tax_alpha_percentage, tax_alpha_annual, net_value_annual, roi_percentage,
          custom_sections, branding
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        RETURNING *
      `, [
        householdId, templateId, 'draft', clientName, clientEmail,
        portfolioSize, feeType, feePercentage, feeFlat, calculations.feeAnnual,
        taxAlphaPercentage, calculations.taxAlphaAnnual, calculations.netValueAnnual, calculations.roiPercentage,
        JSON.stringify(customSections), JSON.stringify(branding),
      ]);

      console.log(`[Proposify] Created proposal ${result.rows[0].id} for ${clientName}`);

      return result.rows[0];

    } finally {
      client.release();
    }
  }

  /**
   * Calculate fee and value (ROI).
   */
  calculateValue(params) {
    const {
      portfolioSize,
      feeType,
      feePercentage,
      feeFlat,
      taxAlphaPercentage,
    } = params;

    let feeAnnual = 0;

    // Calculate fee based on type
    if (feeType === 'aum') {
      feeAnnual = portfolioSize * feePercentage;
    } else if (feeType === 'flat') {
      feeAnnual = feeFlat;
    } else if (feeType === 'hybrid') {
      feeAnnual = (portfolioSize * feePercentage) + feeFlat;
    }

    // Calculate tax alpha (Farther's advantage)
    const taxAlphaAnnual = portfolioSize * taxAlphaPercentage;

    // Net value (tax alpha - fee)
    const netValueAnnual = taxAlphaAnnual - feeAnnual;

    // ROI percentage
    const roiPercentage = feeAnnual > 0 ? (taxAlphaAnnual / feeAnnual) * 100 : 0;

    return {
      feeAnnual,
      taxAlphaAnnual,
      netValueAnnual,
      roiPercentage,
    };
  }

  /**
   * Get proposal by ID.
   */
  async getProposal(proposalId) {
    const result = await pool.query(
      'SELECT * FROM proposals WHERE id = $1',
      [proposalId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Proposal ${proposalId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Update proposal.
   */
  async updateProposal(proposalId, updates) {
    const allowed = [
      'client_name', 'client_email', 'portfolio_size',
      'fee_type', 'fee_percentage', 'fee_flat',
      'tax_alpha_percentage', 'custom_sections', 'branding', 'notes',
    ];

    const sets = [];
    const values = [];
    let paramIndex = 1;

    Object.keys(updates).forEach(key => {
      if (allowed.includes(key)) {
        sets.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
        paramIndex++;
      }
    });

    if (sets.length === 0) {
      return this.getProposal(proposalId);
    }

    // Recalculate if fee/portfolio changed
    if (updates.portfolio_size || updates.fee_percentage || updates.fee_flat || updates.tax_alpha_percentage) {
      const current = await this.getProposal(proposalId);
      const calculations = this.calculateValue({
        portfolioSize: updates.portfolio_size || current.portfolio_size,
        feeType: updates.fee_type || current.fee_type,
        feePercentage: updates.fee_percentage || current.fee_percentage,
        feeFlat: updates.fee_flat || current.fee_flat,
        taxAlphaPercentage: updates.tax_alpha_percentage || current.tax_alpha_percentage,
      });

      sets.push(`fee_annual = $${paramIndex}`, `tax_alpha_annual = $${paramIndex + 1}`, `net_value_annual = $${paramIndex + 2}`, `roi_percentage = $${paramIndex + 3}`);
      values.push(calculations.feeAnnual, calculations.taxAlphaAnnual, calculations.netValueAnnual, calculations.roiPercentage);
      paramIndex += 4;
    }

    sets.push('updated_at = NOW()');
    values.push(proposalId);

    const result = await pool.query(`
      UPDATE proposals
      SET ${sets.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `, values);

    return result.rows[0];
  }

  /**
   * List proposals (with filters).
   */
  async listProposals(filters = {}) {
    const { householdId, status, limit = 50, offset = 0 } = filters;

    const conditions = [];
    const values = [];
    let paramIndex = 1;

    if (householdId) {
      conditions.push(`household_id = $${paramIndex}`);
      values.push(householdId);
      paramIndex++;
    }

    if (status) {
      conditions.push(`status = $${paramIndex}`);
      values.push(status);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT * FROM proposals
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `, [...values, limit, offset]);

    return result.rows;
  }

  /**
   * Mark proposal as sent.
   */
  async markAsSent(proposalId) {
    await pool.query(`
      UPDATE proposals
      SET status = 'sent', sent_at = NOW()
      WHERE id = $1
    `, [proposalId]);

    // Log event
    await this.logEvent(proposalId, 'sent', {});

    return this.getProposal(proposalId);
  }

  /**
   * Mark proposal as viewed.
   */
  async markAsViewed(proposalId) {
    const proposal = await this.getProposal(proposalId);

    if (!proposal.viewed_at) {
      await pool.query(`
        UPDATE proposals
        SET status = 'viewed', viewed_at = NOW()
        WHERE id = $1
      `, [proposalId]);
    }

    // Log event
    await this.logEvent(proposalId, 'opened', {});

    return this.getProposal(proposalId);
  }

  /**
   * Mark proposal as signed.
   */
  async markAsSigned(proposalId) {
    await pool.query(`
      UPDATE proposals
      SET status = 'signed', signed_at = NOW()
      WHERE id = $1
    `, [proposalId]);

    // Log event
    await this.logEvent(proposalId, 'signed', {});

    return this.getProposal(proposalId);
  }

  /**
   * Log tracking event.
   */
  async logEvent(proposalId, eventType, eventData = {}, metadata = {}) {
    await pool.query(`
      INSERT INTO proposal_events (proposal_id, event_type, event_data, user_agent, ip_address)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      proposalId,
      eventType,
      JSON.stringify(eventData),
      metadata.userAgent || null,
      metadata.ipAddress || null,
    ]);
  }

  /**
   * Get proposal events (tracking).
   */
  async getEvents(proposalId) {
    const result = await pool.query(`
      SELECT * FROM proposal_events
      WHERE proposal_id = $1
      ORDER BY created_at ASC
    `, [proposalId]);

    return result.rows;
  }

  /**
   * List templates.
   */
  async listTemplates(category = null) {
    const query = category
      ? 'SELECT * FROM proposal_templates WHERE category = $1 AND is_active = TRUE ORDER BY name'
      : 'SELECT * FROM proposal_templates WHERE is_active = TRUE ORDER BY category, name';

    const params = category ? [category] : [];
    const result = await pool.query(query, params);

    return result.rows;
  }

  /**
   * Get template by ID.
   */
  async getTemplate(templateId) {
    const result = await pool.query(
      'SELECT * FROM proposal_templates WHERE id = $1',
      [templateId]
    );

    if (result.rows.length === 0) {
      throw new Error(`Template ${templateId} not found`);
    }

    return result.rows[0];
  }

  /**
   * Generate PDF for proposal.
   */
  async generatePDF(proposalId) {
    const proposal = await this.getProposal(proposalId);
    const template = await this.getTemplate(proposal.template_id);

    console.log(`[Proposify] Generating PDF for proposal ${proposalId}...`);

    // Generate PDF
    const pdfBuffer = await pdfGenerator.generateProposal(proposal, template);

    // Upload to Backblaze
    const pdfUrl = await pdfGenerator.uploadPDF(proposalId, pdfBuffer);

    // Update proposal with PDF URL
    await pool.query(`
      UPDATE proposals
      SET pdf_url = $1, pdf_generated_at = NOW()
      WHERE id = $2
    `, [pdfUrl, proposalId]);

    console.log(`[Proposify] PDF generated and uploaded: ${pdfUrl}`);

    return {
      pdfUrl,
      size: pdfBuffer.length,
    };
  }
}

export default ProposifyService;
