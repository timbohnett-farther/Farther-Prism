/**
 * Generic Statement Parser
 * 
 * Fallback parser for unknown custodians
 * Uses heuristics and fuzzy column matching to parse common CSV formats
 * Should be registered LAST in parser list (lowest priority)
 */

import { BaseStatementParser } from '../base-parser.js';

export class GenericParser extends BaseStatementParser {
  constructor() {
    super('Unknown Custodian');
  }

  /**
   * Generic parser accepts any CSV with position-like data.
   * Lower confidence (0.4) so specific parsers always win.
   */
  async detect(document) {
    const { mimeType, buffer, filename } = document;
    
    // Only handle CSVs
    if (mimeType !== 'text/csv' && !filename?.endsWith('.csv')) {
      return { canParse: false, confidence: 0 };
    }
    
    try {
      const csvText = buffer.toString('utf-8');
      const lines = csvText.trim().split('\n');
      
      if (lines.length < 2) {
        return { canParse: false, confidence: 0 };
      }
      
      const headers = lines[0].toLowerCase();
      
      // Must have at least a symbol/ticker and some value column
      const hasSymbol = headers.includes('symbol') || headers.includes('ticker') || headers.includes('security');
      const hasValue = headers.includes('value') || headers.includes('market') || headers.includes('price') || headers.includes('amount');
      
      if (hasSymbol && hasValue) {
        return { 
          canParse: true, 
          confidence: 0.4, // Lower than any specific parser
          note: 'Generic CSV parser - custodian unknown'
        };
      }
    } catch (err) {
      // Ignore parse errors
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    return this.parseAccountsFromCSV(document.buffer);
  }

  /**
   * Extract accounts using fuzzy column matching.
   */
  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    if (rows.length === 0) return [];
    
    // Find account number column (fuzzy match)
    const accountCol = this.findColumn(rows[0], ['account number', 'account', 'account #', 'acct', 'portfolio']);
    const accountNameCol = this.findColumn(rows[0], ['account name', 'account type', 'account description']);
    const valueCol = this.findColumn(rows[0], ['market value', 'value', 'total value', 'current value', 'amount']);
    const dateCol = this.findColumn(rows[0], ['date', 'as of', 'as of date', 'statement date', 'valuation date']);
    
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = accountCol ? row[accountCol] : 'UNKNOWN';
      if (!accountNumber || accountNumber === 'UNKNOWN') continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = accountNameCol ? row[accountNameCol] : `Account ${accountNumber}`;
        const type = this.deriveAccountType(accountName, accountNumber);
        
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName: accountName || `Unknown ${accountNumber}`,
          accountType: type,
          custodian: 'Unknown Custodian (Manual Review Needed)',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: dateCol ? this.parseDate(row[dateCol]) : new Date(),
        });
      }
      
      if (valueCol) {
        const value = this.parseCurrency(row[valueCol]);
        accountsMap.get(accountNumber).currentValue += value;
      }
    }
    
    return Array.from(accountsMap.values());
  }

  async parsePositions(document) {
    return this.parsePositionsFromCSV(document.buffer);
  }

  /**
   * Extract positions using fuzzy column matching.
   */
  parsePositionsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    if (rows.length === 0) return [];
    
    // Find position columns (fuzzy match)
    const symbolCol = this.findColumn(rows[0], ['symbol', 'ticker', 'security', 'security id']);
    const descCol = this.findColumn(rows[0], ['description', 'security description', 'security name', 'name']);
    const qtyCol = this.findColumn(rows[0], ['quantity', 'shares', 'qty', 'units', 'position']);
    const priceCol = this.findColumn(rows[0], ['price', 'last price', 'current price', 'unit price', 'market price']);
    const valueCol = this.findColumn(rows[0], ['market value', 'value', 'total value', 'current value', 'position value']);
    const costCol = this.findColumn(rows[0], ['cost basis', 'cost', 'total cost', 'book value', 'adjusted cost']);
    const acqDateCol = this.findColumn(rows[0], ['date acquired', 'acquisition date', 'purchase date', 'acquired']);
    const accountCol = this.findColumn(rows[0], ['account number', 'account', 'account #', 'acct']);
    
    if (!symbolCol) {
      console.warn('[GenericParser] No symbol column found - cannot parse positions');
      return [];
    }
    
    const positions = [];
    
    for (const row of rows) {
      const symbol = row[symbolCol];
      if (!symbol || symbol.toLowerCase().includes('cash')) continue;
      
      const quantity = qtyCol ? parseFloat(row[qtyCol] || 0) : 0;
      if (quantity === 0) continue;
      
      const price = priceCol ? this.parseCurrency(row[priceCol]) : 0;
      const marketValue = valueCol ? this.parseCurrency(row[valueCol]) : (price * quantity);
      const costBasis = costCol ? this.parseCurrency(row[costCol]) : null;
      
      positions.push({
        accountNumber: accountCol ? row[accountCol] : 'UNKNOWN',
        symbol,
        description: descCol ? row[descCol] : '',
        assetClass: this.classifyAssetClass(symbol, descCol ? row[descCol] : ''),
        quantity,
        costBasis: costBasis || (price * quantity), // Estimate if not provided
        acquisitionDate: acqDateCol ? this.parseDate(row[acqDateCol]) : null,
        currentPrice: price,
        marketValue,
      });
    }
    
    return positions;
  }

  async parseTransactions(document) {
    // Transactions too variable to parse generically
    return [];
  }

  /**
   * Fuzzy column name matching.
   * Returns the first matching column name (case-insensitive, partial match).
   */
  findColumn(row, possibleNames) {
    const headers = Object.keys(row);
    
    for (const name of possibleNames) {
      const found = headers.find(h => 
        h.toLowerCase().includes(name.toLowerCase()) ||
        name.toLowerCase().includes(h.toLowerCase())
      );
      if (found) return found;
    }
    
    return null;
  }

  deriveTaxTreatment(accountType) {
    if (accountType.includes('roth')) return 'tax_free';
    if (accountType.includes('ira') || accountType.includes('401k')) return 'tax_deferred';
    return 'taxable';
  }
}

export default GenericParser;
