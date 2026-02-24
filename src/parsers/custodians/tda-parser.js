/**
 * TD Ameritrade Statement Parser
 * 
 * Note: TD Ameritrade merged with Schwab but legacy TDA accounts still exist
 * Supports TD Ameritrade CSV exports
 */

import { BaseStatementParser } from '../base-parser.js';

export class TDAParser extends BaseStatementParser {
  constructor() {
    super('TD Ameritrade');
  }

  async detect(document) {
    const { filename, text, buffer } = document;
    
    if (filename && (filename.toLowerCase().includes('tda') || filename.toLowerCase().includes('tdameritrade') || filename.toLowerCase().includes('td ameritrade'))) {
      return { canParse: true, confidence: 0.9 };
    }
    
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('td ameritrade') || lower.includes('tdameritrade.com') || lower.includes('thinkorswim')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(document.buffer);
    }
    return [{ accountNumber: 'PENDING', accountName: 'TD Ameritrade (PDF)', accountType: 'taxable_individual', custodian: 'TD Ameritrade', taxTreatment: 'taxable', currentValue: 0, asOfDate: new Date() }];
  }

  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account'] || row['Account #'];
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = row['Account Type'] || `TD Ameritrade ${accountNumber}`;
        const type = this.deriveAccountType(accountName, accountNumber);
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType: type,
          custodian: 'TD Ameritrade',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['Date']),
        });
      }
      
      accountsMap.get(accountNumber).currentValue += this.parseCurrency(row['Market Value'] || row['Value']);
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
      const symbol = row['Symbol'];
      return symbol && symbol !== 'Cash';
    }).map(row => ({
      accountNumber: row['Account'] || row['Account #'],
      symbol: row['Symbol'],
      description: row['Description'] || '',
      assetClass: this.classifyAssetClass(row['Symbol'], row['Description'] || ''),
      quantity: parseFloat(row['Qty'] || row['Quantity'] || 0),
      costBasis: this.parseCurrency(row['Cost'] || row['Cost Basis']),
      acquisitionDate: null,
      currentPrice: this.parseCurrency(row['Price'] || row['Last']),
      marketValue: this.parseCurrency(row['Market Value'] || row['Value']),
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

export default TDAParser;
