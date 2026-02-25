/**
 * PDF Generator Service
 * 
 * Generates professional proposal PDFs using Puppeteer.
 * Incorporates Farther branding and value propositions.
 */

import puppeteer from 'puppeteer';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Backblaze S3-compatible client
const s3Client = new S3Client({
  endpoint: `https://${process.env.BACKBLAZE_ENDPOINT}`,
  region: process.env.BACKBLAZE_REGION,
  credentials: {
    accessKeyId: process.env.BACKBLAZE_KEY_ID,
    secretAccessKey: process.env.BACKBLAZE_APPLICATION_KEY,
  },
});

export class PDFGenerator {
  /**
   * Generate proposal PDF.
   */
  async generateProposal(proposal, template) {
    const html = this.buildHTML(proposal, template);

    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });

      // Generate PDF
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        printBackground: true,
        margin: {
          top: '0.5in',
          right: '0.5in',
          bottom: '0.5in',
          left: '0.5in',
        },
      });

      console.log(`[PDF] Generated ${pdfBuffer.length} bytes for proposal ${proposal.id}`);

      return pdfBuffer;

    } finally {
      await browser.close();
    }
  }

  /**
   * Upload PDF to Backblaze.
   */
  async uploadPDF(proposalId, pdfBuffer) {
    const key = `proposals/${proposalId}.pdf`;

    const command = new PutObjectCommand({
      Bucket: process.env.BACKBLAZE_BUCKET_NAME,
      Key: key,
      Body: pdfBuffer,
      ContentType: 'application/pdf',
    });

    await s3Client.send(command);

    const url = `https://${process.env.BACKBLAZE_BUCKET_NAME}.${process.env.BACKBLAZE_ENDPOINT}/${key}`;

    console.log(`[PDF] Uploaded to ${url}`);

    return url;
  }

  /**
   * Build HTML for proposal.
   */
  buildHTML(proposal, template) {
    const sections = template.template_data?.sections || [];

    const sectionHTML = sections.map(section => {
      switch (section) {
        case 'cover':
          return this.buildCoverPage(proposal);
        case 'introduction':
          return this.buildIntroduction(proposal);
        case 'value_proposition':
          return this.buildValueProposition(proposal);
        case 'fee_calculator':
          return this.buildFeeCalculator(proposal);
        case 'service_comparison':
          return this.buildServiceComparison();
        case 'investment_approach':
          return this.buildInvestmentApproach();
        case 'tax_alpha_explanation':
          return this.buildTaxAlphaExplanation(proposal);
        case 'value_roi':
          return this.buildValueROI(proposal);
        case 'next_steps':
          return this.buildNextSteps(proposal);
        case 'disclosures':
          return this.buildDisclosures();
        default:
          return '';
      }
    }).join('\n');

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          ${this.getCSS()}
        </style>
      </head>
      <body>
        ${sectionHTML}
      </body>
      </html>
    `;
  }

  /**
   * CSS Styles (Farther branding).
   */
  getCSS() {
    return `
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      body {
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        color: #333333;
        line-height: 1.6;
      }

      .page {
        page-break-after: always;
        padding: 40px;
      }

      .page:last-child {
        page-break-after: auto;
      }

      h1 {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 20px;
        color: #1a7a82;
      }

      h2 {
        font-size: 24px;
        font-weight: 600;
        margin-top: 30px;
        margin-bottom: 15px;
        color: #1a7a82;
      }

      h3 {
        font-size: 18px;
        font-weight: 600;
        margin-top: 20px;
        margin-bottom: 10px;
      }

      p {
        margin-bottom: 15px;
        font-size: 14px;
      }

      .cover {
        text-align: center;
        padding-top: 200px;
      }

      .cover h1 {
        font-size: 48px;
        margin-bottom: 30px;
      }

      .cover .tagline {
        font-size: 24px;
        color: #1a7a82;
        font-weight: 600;
        margin-bottom: 60px;
      }

      .cover .client-name {
        font-size: 28px;
        color: #333333;
        margin-bottom: 20px;
      }

      .highlight {
        background: #f0f9fa;
        padding: 20px;
        border-left: 4px solid #1a7a82;
        margin: 20px 0;
      }

      .fee-box {
        background: #ffffff;
        border: 2px solid #1a7a82;
        padding: 30px;
        margin: 20px 0;
        border-radius: 8px;
      }

      .fee-row {
        display: flex;
        justify-content: space-between;
        padding: 10px 0;
        border-bottom: 1px solid #e0e0e0;
      }

      .fee-row:last-child {
        border-bottom: none;
        font-weight: 700;
        font-size: 18px;
        padding-top: 20px;
      }

      .comparison-table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }

      .comparison-table th,
      .comparison-table td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #e0e0e0;
      }

      .comparison-table th {
        background: #1a7a82;
        color: white;
        font-weight: 600;
      }

      .comparison-table td {
        font-size: 14px;
      }

      .checkmark {
        color: #1a7a82;
        font-weight: 700;
      }

      .xmark {
        color: #999;
      }

      .footer {
        margin-top: 60px;
        padding-top: 20px;
        border-top: 2px solid #1a7a82;
        text-align: center;
        font-size: 12px;
        color: #666;
      }

      .logo {
        text-align: center;
        margin-bottom: 40px;
      }

      .logo h1 {
        font-size: 36px;
        color: #1a7a82;
        font-weight: 800;
      }
    `;
  }

  /**
   * Cover Page
   */
  buildCoverPage(proposal) {
    return `
      <div class="page cover">
        <div class="logo">
          <h1>FARTHER</h1>
        </div>
        <h1>Client Proposal</h1>
        <div class="tagline">Go Farther</div>
        <div class="client-name">Prepared for ${proposal.client_name}</div>
        <p style="color: #666; font-size: 16px;">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
      </div>
    `;
  }

  /**
   * Introduction
   */
  buildIntroduction(proposal) {
    return `
      <div class="page">
        <div class="logo">
          <h1>FARTHER</h1>
        </div>
        <h2>Welcome to Farther</h2>
        <p>
          Thank you for considering Farther as your wealth management partner. We're excited to show you
          how our unique approach can help you achieve your financial goals while preserving and growing
          your wealth.
        </p>
        <p>
          At Farther, we believe wealth management should be both sophisticated and personal. That's why
          we combine dedicated human advisors with institutional-quality technology to deliver an experience
          that's unmatched in the industry.
        </p>
        <div class="highlight">
          <h3>Our Philosophy</h3>
          <p>
            <strong>Preservation First:</strong> We prioritize protecting your wealth before seeking growth.
            Our portfolios are designed to weather market cycles and preserve capital.
          </p>
          <p>
            <strong>Human-Led, Tech-Amplified:</strong> You get a dedicated advisor who leads your strategy,
            supported by technology that handles execution, monitoring, and optimization faster than any
            traditional firm.
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Value Proposition
   */
  buildValueProposition(proposal) {
    return `
      <div class="page">
        <h2>Why Farther?</h2>
        <h3>1. Measurable Tax Alpha</h3>
        <p>
          Our proprietary technology continuously optimizes your portfolio for taxes, delivering 1-3% in
          annual tax alpha—often more than covering our advisory fee.
        </p>

        <h3>2. Access to Alternatives</h3>
        <p>
          Through our curated partner network and Farther Asset Management, you gain access to private equity,
          hedge funds, and other alternatives typically reserved for institutional investors.
        </p>

        <h3>3. Institutional-Quality Diversification</h3>
        <p>
          We build personalized portfolios (not model portfolios) that combine public and private markets
          for true diversification and risk management.
        </p>

        <h3>4. Active Oversight</h3>
        <p>
          Your advisor actively monitors your portfolio and makes adjustments based on market conditions,
          tax opportunities, and your evolving goals.
        </p>
      </div>
    `;
  }

  /**
   * Fee Calculator
   */
  buildFeeCalculator(proposal) {
    const feeAnnual = parseFloat(proposal.fee_annual) || 0;
    const portfolioSize = parseFloat(proposal.portfolio_size) || 0;
    const feePercentage = parseFloat(proposal.fee_percentage) || 0;

    return `
      <div class="page">
        <h2>Fee Structure</h2>
        <p>
          Transparent pricing with no hidden fees. You only pay for the value we deliver.
        </p>

        <div class="fee-box">
          <div class="fee-row">
            <span>Portfolio Size:</span>
            <span><strong>$${portfolioSize.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
          </div>
          <div class="fee-row">
            <span>Advisory Fee (${(feePercentage * 100).toFixed(2)}%):</span>
            <span><strong>$${feeAnnual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/year</strong></span>
          </div>
        </div>

        <div class="highlight">
          <h3>What's Included</h3>
          <ul style="margin-left: 20px;">
            <li>Dedicated financial advisor</li>
            <li>Comprehensive financial planning</li>
            <li>Tax optimization (1-3% annual alpha)</li>
            <li>Access to private markets</li>
            <li>Real-time portfolio monitoring</li>
            <li>Quarterly reviews and rebalancing</li>
            <li>Unlimited advisor access</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Service Comparison
   */
  buildServiceComparison() {
    return `
      <div class="page">
        <h2>How We Compare</h2>

        <table class="comparison-table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Farther</th>
              <th>Robo-Advisors</th>
              <th>Traditional RIAs</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Dedicated Advisor</td>
              <td class="checkmark">✓</td>
              <td class="xmark">✗</td>
              <td class="checkmark">✓</td>
            </tr>
            <tr>
              <td>Financial Planning</td>
              <td class="checkmark">✓ Comprehensive</td>
              <td>Limited</td>
              <td class="checkmark">✓</td>
            </tr>
            <tr>
              <td>Tax Optimization</td>
              <td class="checkmark">✓ 1-3% Alpha</td>
              <td class="xmark">✗</td>
              <td>Limited</td>
            </tr>
            <tr>
              <td>Private Markets Access</td>
              <td class="checkmark">✓</td>
              <td class="xmark">✗</td>
              <td>Limited</td>
            </tr>
            <tr>
              <td>Modern Technology</td>
              <td class="checkmark">✓ Best-in-class</td>
              <td class="checkmark">✓</td>
              <td class="xmark">✗</td>
            </tr>
            <tr>
              <td>Real-Time Monitoring</td>
              <td class="checkmark">✓</td>
              <td>Limited</td>
              <td class="xmark">✗</td>
            </tr>
            <tr>
              <td>Annual Fee</td>
              <td>1.0%</td>
              <td>0.25%</td>
              <td>1.0-1.5%</td>
            </tr>
          </tbody>
        </table>

        <p style="margin-top: 30px;">
          <strong>The Farther Advantage:</strong> You get the personal service of a traditional RIA
          combined with the technology of a robo-advisor, plus access to alternatives and measurable
          tax alpha that often exceeds our fee.
        </p>
      </div>
    `;
  }

  /**
   * Investment Approach
   */
  buildInvestmentApproach() {
    return `
      <div class="page">
        <h2>Our Investment Approach</h2>

        <h3>Preservation First</h3>
        <p>
          At Farther, we prioritize protecting your wealth before seeking growth. Our institutional-quality
          portfolios are designed to preserve capital across full market cycles.
        </p>

        <h3>Personalized Portfolios</h3>
        <p>
          We don't use model portfolios. Every client gets a customized allocation based on their goals,
          risk tolerance, tax situation, and time horizon.
        </p>

        <h3>Public + Private Markets</h3>
        <p>
          True diversification comes from combining public markets (stocks, bonds) with private markets
          (private equity, hedge funds, real assets). We give you access to both.
        </p>

        <h3>Active Tax Management</h3>
        <p>
          Our technology continuously monitors your portfolio for tax-loss harvesting opportunities,
          optimal withdrawal strategies, and Roth conversion timing. This generates 1-3% in annual
          tax alpha.
        </p>
      </div>
    `;
  }

  /**
   * Tax Alpha Explanation
   */
  buildTaxAlphaExplanation(proposal) {
    const taxAlphaAnnual = parseFloat(proposal.tax_alpha_annual) || 0;
    const taxAlphaPercentage = parseFloat(proposal.tax_alpha_percentage) || 0;

    return `
      <div class="page">
        <h2>Understanding Tax Alpha</h2>

        <p>
          Tax alpha is the additional return you earn through tax-efficient strategies. At Farther,
          our technology delivers measurable tax savings that often exceed our advisory fee.
        </p>

        <div class="fee-box">
          <h3 style="margin-top: 0;">Your Estimated Tax Alpha</h3>
          <div class="fee-row">
            <span>Portfolio Size:</span>
            <span><strong>$${(proposal.portfolio_size || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
          </div>
          <div class="fee-row">
            <span>Tax Alpha (${(taxAlphaPercentage * 100).toFixed(1)}% annually):</span>
            <span><strong>$${taxAlphaAnnual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}/year</strong></span>
          </div>
        </div>

        <h3>How We Generate Tax Alpha:</h3>
        <ul style="margin-left: 20px;">
          <li><strong>Tax-Loss Harvesting:</strong> Systematically capture losses to offset gains</li>
          <li><strong>Asset Location:</strong> Place assets in optimal account types (taxable, IRA, Roth)</li>
          <li><strong>Withdrawal Sequencing:</strong> Draw from accounts in the most tax-efficient order</li>
          <li><strong>Roth Conversions:</strong> Time conversions to minimize lifetime taxes</li>
          <li><strong>Dividend Management:</strong> Minimize high-tax dividend income</li>
        </ul>

        <p style="margin-top: 30px;">
          <em>Conservative estimate based on academic research and Farther client outcomes. Actual tax alpha
          may vary based on portfolio size, tax bracket, and market conditions.</em>
        </p>
      </div>
    `;
  }

  /**
   * Value ROI
   */
  buildValueROI(proposal) {
    const feeAnnual = parseFloat(proposal.fee_annual) || 0;
    const taxAlphaAnnual = parseFloat(proposal.tax_alpha_annual) || 0;
    const netValueAnnual = parseFloat(proposal.net_value_annual) || 0;
    const roiPercentage = parseFloat(proposal.roi_percentage) || 0;

    return `
      <div class="page">
        <h2>Your Return on Investment</h2>

        <p>
          At Farther, we believe our services should pay for themselves through measurable value.
          Here's how the math works for you:
        </p>

        <div class="fee-box">
          <h3 style="margin-top: 0;">Annual Value Calculation</h3>
          <div class="fee-row">
            <span>Tax Alpha (savings):</span>
            <span style="color: #1a7a82;"><strong>+$${taxAlphaAnnual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
          </div>
          <div class="fee-row">
            <span>Advisory Fee (cost):</span>
            <span style="color: #666;"><strong>-$${feeAnnual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
          </div>
          <div class="fee-row">
            <span>Net Annual Value:</span>
            <span style="color: ${netValueAnnual >= 0 ? '#1a7a82' : '#999'};"><strong>${netValueAnnual >= 0 ? '+' : ''}$${netValueAnnual.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</strong></span>
          </div>
          <div class="fee-row" style="margin-top: 20px;">
            <span>ROI:</span>
            <span style="color: #1a7a82; font-size: 24px;"><strong>${roiPercentage.toFixed(0)}%</strong></span>
          </div>
        </div>

        <div class="highlight">
          <h3>Beyond Tax Alpha</h3>
          <p>
            This calculation only includes tax savings. The full value of Farther also includes:
          </p>
          <ul style="margin-left: 20px;">
            <li>Better risk-adjusted returns through institutional diversification</li>
            <li>Time saved (150+ hours/year) from automated technology</li>
            <li>Access to private markets (typically 2-4% outperformance)</li>
            <li>Peace of mind from professional oversight</li>
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Next Steps
   */
  buildNextSteps(proposal) {
    return `
      <div class="page">
        <h2>Next Steps</h2>

        <p>
          We're excited to partner with you on your wealth management journey. Here's how to get started:
        </p>

        <h3>Step 1: Review This Proposal</h3>
        <p>
          Take your time reviewing the fee structure, value proposition, and investment approach.
          If you have any questions, we're here to help.
        </p>

        <h3>Step 2: Schedule a Follow-Up Call</h3>
        <p>
          Let's discuss any questions you have and dive deeper into how we'll work together.
          We can customize this proposal based on your specific needs.
        </p>

        <h3>Step 3: Complete Onboarding</h3>
        <p>
          Once you're ready to move forward, we'll guide you through a simple onboarding process:
        </p>
        <ul style="margin-left: 20px;">
          <li>Account setup and paperwork</li>
          <li>Transfer existing accounts (we handle the details)</li>
          <li>Initial portfolio construction</li>
          <li>First advisor meeting and planning session</li>
        </ul>

        <h3>Step 4: Go Farther</h3>
        <p>
          Within 2-3 weeks, your portfolio will be live and actively managed. You'll have access to
          our technology platform, your dedicated advisor, and the full Farther experience.
        </p>

        <div class="highlight">
          <h3>Questions?</h3>
          <p>
            Contact us anytime at:
          </p>
          <p>
            <strong>Email:</strong> hello@farther.com<br>
            <strong>Phone:</strong> (555) 123-4567<br>
            <strong>Web:</strong> farther.com
          </p>
        </div>
      </div>
    `;
  }

  /**
   * Disclosures
   */
  buildDisclosures() {
    return `
      <div class="page">
        <h2>Important Disclosures</h2>

        <p style="font-size: 12px; line-height: 1.5;">
          Farther Advisors LLC is a registered investment advisor. Advisory services are only offered
          to clients or prospective clients where Farther and its representatives are properly licensed
          or exempt from licensure.
        </p>

        <p style="font-size: 12px; line-height: 1.5;">
          This proposal is for informational purposes only and does not constitute an offer to sell or
          a solicitation of an offer to buy any securities or investment products. Past performance is
          not indicative of future results.
        </p>

        <p style="font-size: 12px; line-height: 1.5;">
          Tax alpha estimates are based on academic research and Farther client outcomes. Actual tax
          savings will vary based on portfolio size, tax bracket, account types, and market conditions.
          Consult with a tax professional regarding your specific situation.
        </p>

        <p style="font-size: 12px; line-height: 1.5;">
          Access to alternative investments is subject to eligibility requirements and may not be
          suitable for all investors. Alternatives carry additional risks including illiquidity,
          complexity, and lack of transparency.
        </p>

        <p style="font-size: 12px; line-height: 1.5;">
          All investments carry risk, including the loss of principal. There is no guarantee that
          any investment strategy will achieve its objectives.
        </p>

        <div class="footer">
          <p>
            Farther Advisors LLC | Registered Investment Advisor<br>
            123 Financial District, San Francisco, CA 94105<br>
            © ${new Date().getFullYear()} Farther. All rights reserved.
          </p>
        </div>
      </div>
    `;
  }
}

export default PDFGenerator;
