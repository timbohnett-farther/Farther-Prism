/**
 * Presenter Service - Client Presentation Engine
 * 
 * Creates slide-based presentations for client meetings.
 * Auto-populates with portfolio data and Farther messaging.
 */

import pool from '../db/pool.js';
import { FocusService } from './focus-service.js';

const focusService = new FocusService();

export class PresenterService {

  async createPresentation(data) {
    const { householdId, title, presentationType, templateId } = data;

    // Auto-generate slides from portfolio data
    const slides = await this.generateSlides(householdId, presentationType);

    const result = await pool.query(`
      INSERT INTO presentations (household_id, title, presentation_type, slides)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [householdId, title, presentationType, JSON.stringify(slides)]);

    return result.rows[0];
  }

  async generateSlides(householdId, presentationType) {
    const slides = [];

    try {
      const overview = await focusService.getOverview(householdId);
      const performance = await focusService.getPerformance(householdId);

      const fmt = (n) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
      const pct = (n) => ((n || 0) * 100).toFixed(1) + '%';

      // Title slide
      slides.push({
        type: 'title',
        title: presentationType === 'onboarding' ? 'Welcome to Farther' : 'Portfolio Review',
        subtitle: 'Go Farther',
        date: new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      });

      if (presentationType === 'onboarding') {
        slides.push({
          type: 'content',
          title: 'About Farther',
          bullets: [
            'Human-led, technology-amplified wealth management',
            'Preservation-first investment philosophy',
            'Measurable 1-3% annual tax alpha',
            'Access to private markets and alternatives',
            'Institutional-quality diversification for every client',
          ],
        });

        slides.push({
          type: 'content',
          title: 'Our Investment Philosophy',
          bullets: [
            'Preservation First — protect wealth before seeking growth',
            'Personalized Portfolios — no model portfolios',
            'Tax Intelligence — systematic optimization',
            'Public + Private Markets — true diversification',
            'Active Oversight — your advisor monitors continuously',
          ],
        });
      }

      // Portfolio summary
      slides.push({
        type: 'metrics',
        title: 'Portfolio Summary',
        metrics: [
          { label: 'Total Value', value: `$${fmt(overview.totalValue)}` },
          { label: 'Total Gain/Loss', value: `$${fmt(overview.totalGainLoss)}`, positive: overview.totalGainLoss >= 0 },
          { label: 'Return', value: pct(overview.returnPct), positive: overview.returnPct >= 0 },
          { label: 'Accounts', value: String(overview.accountCount) },
        ],
      });

      // Allocation
      if (overview.allocation && Object.keys(overview.allocation).length > 0) {
        const LABELS = {
          us_stocks: 'US Stocks', intl_stocks: 'International', bonds: 'Bonds',
          real_estate: 'Real Estate', commodities: 'Commodities', cash: 'Cash', other: 'Other',
        };
        slides.push({
          type: 'allocation',
          title: 'Asset Allocation',
          data: Object.entries(overview.allocation).map(([cls, d]) => ({
            label: LABELS[cls] || cls,
            percentage: d.percentage,
            value: d.value,
          })),
        });
      }

      // Performance
      if (performance.topPerformers?.length > 0) {
        slides.push({
          type: 'table',
          title: 'Top Performers',
          headers: ['Symbol', 'Value', 'Return'],
          rows: performance.topPerformers.slice(0, 5).map(p => [
            p.symbol,
            `$${fmt(p.value)}`,
            pct(p.returnPct),
          ]),
        });
      }

      // Tax efficiency (for review/planning types)
      if (presentationType !== 'onboarding') {
        slides.push({
          type: 'content',
          title: 'Tax Efficiency',
          bullets: [
            `Tax-loss harvesting opportunities: ${overview.tlhOpportunities}`,
            'Continuous tax optimization via Farther technology',
            '1-3% annual tax alpha target',
            'Strategic withdrawal sequencing',
            'Roth conversion timing optimization',
          ],
        });
      }

      // Action items
      slides.push({
        type: 'content',
        title: presentationType === 'onboarding' ? 'Next Steps' : 'Action Items',
        bullets: presentationType === 'onboarding' ? [
          'Complete account setup and paperwork',
          'Transfer existing accounts (we handle everything)',
          'Initial portfolio construction',
          'First planning session with your advisor',
          'You\'re live within 2-3 weeks',
        ] : [
          'Review allocation and rebalancing recommendations',
          'Execute pending tax-loss harvests',
          'Update financial plan with any life changes',
          'Schedule next quarterly review',
          'Questions? Contact your advisor anytime',
        ],
      });

      // Closing
      slides.push({
        type: 'title',
        title: 'Thank You',
        subtitle: 'Go Farther Together',
      });

    } catch (error) {
      console.error('[Presenter] Error generating slides:', error.message);
      slides.push({ type: 'content', title: 'Error', bullets: [`Failed to load portfolio data: ${error.message}`] });
    }

    return slides;
  }

  async getPresentation(presentationId) {
    const result = await pool.query('SELECT * FROM presentations WHERE id = $1', [presentationId]);
    if (result.rows.length === 0) throw new Error(`Presentation ${presentationId} not found`);
    return result.rows[0];
  }

  async listPresentations(householdId) {
    const result = await pool.query(
      'SELECT * FROM presentations WHERE household_id = $1 ORDER BY created_at DESC',
      [householdId]
    );
    return result.rows;
  }

  async listTemplates(presentationType = null) {
    const query = presentationType
      ? 'SELECT * FROM presentation_templates WHERE presentation_type = $1 AND is_active = TRUE'
      : 'SELECT * FROM presentation_templates WHERE is_active = TRUE ORDER BY presentation_type';
    const params = presentationType ? [presentationType] : [];
    return (await pool.query(query, params)).rows;
  }
}

export default PresenterService;
