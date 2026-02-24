/**
 * UBS Statement Parser
 * 
 * UBS Wealth Management - Swiss bank, UHNW clients
 * Supports CSV exports and PDF statements
 */

import { BaseStatementParser } from '../base-parser.js';

export class UBSParser extends BaseStatementParser {
  constructor() {
    super('UBS');
  }

  async detect(document) {
    const { filename, text, buffer } = document;
    
    if (filename && filename.toLowerCase().includes('ubs')) {
      return { canParse: true, confidence: 0.9 };
    }
    
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('ubs wealth') || lower.includes('ubs.com') || lower.includes('ubs financial') || lower.includes('union bank of switzerland')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      if (csvText.includes('Account') && csvText.includes('Security') && csvText.includes('Position')) {
        return { canParse: true, confidence: 0.7 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(document.buffer);
    }
    return [{ accountNumber: 'PENDING', accountName: 'UBS Account', accountType: 'taxable_individual', custodian: 'UBS', taxTreatment: 'taxable', currentValue: 0, asOfDate: new Date() }];
  }

  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account Number'] || row['Account'] || row['Portfolio'];
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = row['Account Name'] || row['Account Description'] || `UBS ${accountNumber}`;
        const type = this.deriveAccountType(accountName, accountNumber);
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType: type,
          custodian: 'UBS',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['Valuation Date'] || row['Date'] || row['As of']),
        });
      }
      
      accountsMap.get(accountNumber).currentValue += this.parseCurrency(row['Market Value'] || row['Value'] || row['Position Value']);
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
      const symbol = row['Symbol'] || row['Security ID'] || row['Ticker'];
      return symbol && !symbol.toLowerCase().includes('cash');
    }).map(row => ({
      accountNumber: row['Account Number'] || row['Account'] || row['Portfolio'],
      symbol: row['Symbol'] || row['Security ID'] || row['Ticker'] || 'UNKNOWN',
      description: row['Security Name'] || row['Description'] || row['Security Description'] || '',
      assetClass: this.classifyAssetClass(row['Symbol'] || '', row['Security Name'] || row['Description'] || ''),
      quantity: parseFloat(row['Quantity'] || row['Position'] || row['Units'] || 0),
      costBasis: this.parseCurrency(row['Cost Basis'] || row['Book Value'] || row['Acquisition Cost']),
      acquisitionDate: this.parseDate(row['Acquisition Date'] || row['Purchase Date']),
      currentPrice: this.parseCurrency(row['Price'] || row['Market Price'] || row['Unit Price']),
      marketValue: this.parseCurrency(row['Market Value'] || row['Value'] || row['Position Value']),
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

export default UBSParser;
