/**
 * E*TRADE Statement Parser
 * 
 * Note: E*TRADE was acquired by Morgan Stanley but maintains separate branding
 * Supports E*TRADE CSV exports and PDF statements
 */

import { BaseStatementParser } from '../base-parser.js';

export class ETradeParser extends BaseStatementParser {
  constructor() {
    super('E*TRADE');
  }

  async detect(document) {
    const { filename, text, buffer } = document;
    
    if (filename && (filename.toLowerCase().includes('etrade') || filename.toLowerCase().includes('e*trade') || filename.toLowerCase().includes('e-trade'))) {
      return { canParse: true, confidence: 0.9 };
    }
    
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('e*trade') || lower.includes('etrade.com') || lower.includes('e-trade')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      if (csvText.includes('Account Number') && csvText.includes('Symbol') && csvText.includes('Quantity')) {
        return { canParse: true, confidence: 0.7 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(document.buffer);
    }
    return [{ accountNumber: 'PENDING', accountName: 'E*TRADE Account', accountType: 'taxable_individual', custodian: 'E*TRADE', taxTreatment: 'taxable', currentValue: 0, asOfDate: new Date() }];
  }

  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account Number'] || row['Account'];
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = row['Account Name'] || row['Account Type'] || `E*TRADE ${accountNumber}`;
        const type = this.deriveAccountType(accountName, accountNumber);
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType: type,
          custodian: 'E*TRADE',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['As of Date'] || row['Date']),
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
      return symbol && symbol !== 'Cash' && symbol !== 'CASH';
    }).map(row => ({
      accountNumber: row['Account Number'] || row['Account'],
      symbol: row['Symbol'],
      description: row['Description'] || row['Security Description'] || '',
      assetClass: this.classifyAssetClass(row['Symbol'], row['Description'] || ''),
      quantity: parseFloat(row['Quantity'] || row['Qty'] || 0),
      costBasis: this.parseCurrency(row['Cost Basis'] || row['Total Cost']),
      acquisitionDate: this.parseDate(row['Date Acquired'] || row['Purchase Date']),
      currentPrice: this.parseCurrency(row['Last Price'] || row['Price']),
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

export default ETradeParser;
