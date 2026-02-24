/**
 * Farther Prism - Base Statement Parser
 * 
 * Abstract base class for custodian-specific parsers.
 * All parsers must implement: detect(), parseAccounts(), parsePositions(), parseTransactions()
 */

export class BaseStatementParser {
  constructor(custodianName) {
    this.custodianName = custodianName;
  }

  /**
   * Detect if this parser can handle the given document.
   * @param {Object} document - { buffer: Buffer, filename: string, mimeType: string, text?: string }
   * @returns {Promise<{canParse: boolean, confidence: number}>}
   */
  async detect(document) {
    throw new Error('detect() must be implemented by subclass');
  }

  /**
   * Parse account information from statement.
   * @param {Object} document - Parsed document data
   * @returns {Promise<Array<Account>>}
   * 
   * Account schema:
   * {
   *   accountNumber: string (encrypted later),
   *   accountName: string,
   *   accountType: string (ira_traditional, 401k, taxable_individual, etc.),
   *   custodian: string,
   *   taxTreatment: string (tax_deferred, tax_free, taxable),
   *   currentValue: number,
   *   asOfDate: Date,
   * }
   */
  async parseAccounts(document) {
    throw new Error('parseAccounts() must be implemented by subclass');
  }

  /**
   * Parse holdings (positions/lots) from statement.
   * @param {Object} document - Parsed document data
   * @returns {Promise<Array<Position>>}
   * 
   * Position schema:
   * {
   *   accountNumber: string (to link to account),
   *   symbol: string,
   *   description: string,
   *   assetClass: string (us_equity, bonds, cash, etc.),
   *   quantity: number,
   *   costBasis: number,
   *   acquisitionDate: Date,
   *   currentPrice: number,
   *   marketValue: number,
   * }
   */
  async parsePositions(document) {
    throw new Error('parsePositions() must be implemented by subclass');
  }

  /**
   * Parse transactions from statement (optional - for detailed analysis).
   * @param {Object} document - Parsed document data
   * @returns {Promise<Array<Transaction>>}
   */
  async parseTransactions(document) {
    // Default: return empty array (transactions are optional)
    return [];
  }

  /**
   * Full parse: accounts + positions + transactions.
   * @param {Object} document - { buffer, filename, mimeType, text }
   * @returns {Promise<{accounts, positions, transactions}>}
   */
  async parse(document) {
    const [accounts, positions, transactions] = await Promise.all([
      this.parseAccounts(document),
      this.parsePositions(document),
      this.parseTransactions(document).catch(() => []), // Transactions optional
    ]);

    return {
      custodian: this.custodianName,
      accounts,
      positions,
      transactions,
      metadata: {
        filename: document.filename,
        parsedAt: new Date().toISOString(),
        parser: this.constructor.name,
      },
    };
  }

  /**
   * Helper: Extract text from PDF buffer (requires pdf-parse or similar).
   */
  async extractTextFromPDF(buffer) {
    // TODO: Implement with pdf-parse npm package
    throw new Error('PDF parsing not yet implemented - need pdf-parse package');
  }

  /**
   * Helper: Parse CSV buffer to array of objects.
   */
  parseCSV(buffer, options = {}) {
    const csvText = buffer.toString('utf-8');
    const lines = csvText.trim().split('\n');
    
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const rows = lines.slice(1).map(line => {
      const values = this.parseCSVLine(line);
      const row = {};
      headers.forEach((header, i) => {
        row[header] = values[i] || '';
      });
      return row;
    });
    
    return rows;
  }

  /**
   * Helper: Parse a single CSV line (handles quoted fields).
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Helper: Clean currency strings to numbers.
   * "$1,234.56" → 1234.56
   */
  parseCurrency(value) {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    const cleaned = String(value)
      .replace(/[$,]/g, '')
      .replace(/[()]/g, '-')  // Handle (123.45) as -123.45
      .trim();
    
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Helper: Parse dates in common formats.
   */
  parseDate(value) {
    if (value instanceof Date) return value;
    if (!value) return null;
    
    // Try common formats
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Helper: Classify asset class from symbol/description.
   */
  classifyAssetClass(symbol, description) {
    const desc = (description || '').toLowerCase();
    const sym = (symbol || '').toUpperCase();
    
    // Cash equivalents
    if (sym === 'CASH' || desc.includes('money market') || desc.includes('sweep')) {
      return 'cash';
    }
    
    // Bonds
    if (desc.includes('bond') || desc.includes('treasury') || desc.includes('corporate debt')) {
      return 'bonds';
    }
    
    // Real estate
    if (desc.includes('reit') || desc.includes('real estate')) {
      return 'real_estate';
    }
    
    // International
    if (desc.includes('international') || desc.includes('foreign') || desc.includes('emerging')) {
      return 'international_equity';
    }
    
    // Default to US equity for stocks/ETFs
    if (sym.match(/^[A-Z]{1,5}$/) || desc.includes('fund') || desc.includes('etf')) {
      return 'us_equity';
    }
    
    return 'other';
  }

  /**
   * Helper: Derive account type from account name/description.
   */
  deriveAccountType(accountName, accountNumber) {
    const name = (accountName || '').toLowerCase();
    const num = (accountNumber || '').toLowerCase();
    
    if (name.includes('roth ira') || num.includes('roth')) return 'ira_roth';
    if (name.includes('traditional ira') || name.includes('ira')) return 'ira_traditional';
    if (name.includes('401(k)') || name.includes('401k')) return '401k';
    if (name.includes('403(b)') || name.includes('403b')) return '403b';
    if (name.includes('sep ira')) return 'sep_ira';
    if (name.includes('simple ira')) return 'simple_ira';
    if (name.includes('hsa') || name.includes('health savings')) return 'hsa';
    if (name.includes('529') || name.includes('college savings')) return '529';
    if (name.includes('trust')) return 'trust';
    if (name.includes('joint')) return 'taxable_joint';
    
    // Default: individual taxable
    return 'taxable_individual';
  }
}

export default BaseStatementParser;
