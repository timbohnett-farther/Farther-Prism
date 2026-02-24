/**
 * Goldman Sachs Statement Parser
 * 
 * Goldman Sachs Private Wealth Management
 * UHNW and institutional clients
 */

import { BaseStatementParser } from '../base-parser.js';

export class GoldmanParser extends BaseStatementParser {
  constructor() {
    super('Goldman Sachs');
  }

  async detect(document) {
    const { filename, text, buffer } = document;
    
    if (filename && (filename.toLowerCase().includes('goldman') || filename.toLowerCase().includes('gs wealth') || filename.toLowerCase().includes('goldmansachs'))) {
      return { canParse: true, confidence: 0.9 };
    }
    
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('goldman sachs') || 
          lower.includes('goldmansachs.com') || 
          lower.includes('gs private wealth') ||
          lower.includes('goldman sachs private wealth')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      if (csvText.includes('Account') && csvText.includes('Security') && csvText.includes('Holdings')) {
        return { canParse: true, confidence: 0.7 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(document.buffer);
    }
    return [{ accountNumber: 'PENDING', accountName: 'Goldman Sachs Account', accountType: 'taxable_individual', custodian: 'Goldman Sachs', taxTreatment: 'taxable', currentValue: 0, asOfDate: new Date() }];
  }

  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account Number'] || row['Account'] || row['Account ID'];
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = row['Account Name'] || row['Account Type'] || `Goldman Sachs ${accountNumber}`;
        const type = this.deriveAccountType(accountName, accountNumber);
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType: type,
          custodian: 'Goldman Sachs',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['Statement Date'] || row['Date'] || row['As Of']),
        });
      }
      
      accountsMap.get(accountNumber).currentValue += this.parseCurrency(row['Market Value'] || row['Total Value'] || row['Value']);
    }
    
    return Array.from(accountsMap.values());
  }

  async parsePositions(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parsePositionsFromCSV(document.buffer);
    }
    return [];
  }

  parsePositionsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    return rows.filter(row => {
      const symbol = row['Symbol'] || row['Ticker'] || row['Security'];
      return symbol && !symbol.toLowerCase().includes('cash') && !symbol.toLowerCase().includes('sweep');
    }).map(row => ({
      accountNumber: row['Account Number'] || row['Account'] || row['Account ID'],
      symbol: row['Symbol'] || row['Ticker'] || row['Security'] || 'UNKNOWN',
      description: row['Description'] || row['Security Description'] || row['Security Name'] || '',
      assetClass: this.classifyAssetClass(row['Symbol'] || row['Ticker'], row['Description'] || ''),
      quantity: parseFloat(row['Quantity'] || row['Shares'] || row['Units'] || 0),
      costBasis: this.parseCurrency(row['Cost Basis'] || row['Cost' ] || row['Adjusted Cost']),
      acquisitionDate: this.parseDate(row['Date Acquired'] || row['Purchase Date'] || row['Acquisition Date']),
      currentPrice: this.parseCurrency(row['Price'] || row['Current Price'] || row['Unit Price']),
      marketValue: this.parseCurrency(row['Market Value'] || row['Value'] || row['Current Value']),
    }));
  }

  async parseTransactions(document) {
    return [];
  }

  deriveTaxTreatment(accountType) {
    if (accountType.includes('roth')) return 'tax_free';
    if (accountType.includes('ira') || accountType.includes('401k')) return 'tax_deferred';
    return 'taxable';
  }
}

export default GoldmanParser;
