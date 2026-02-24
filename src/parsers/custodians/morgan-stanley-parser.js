/**
 * Morgan Stanley Statement Parser
 * 
 * Supports Morgan Stanley Wealth Management and E*TRADE by Morgan Stanley
 * High-net-worth and institutional clients
 */

import { BaseStatementParser } from '../base-parser.js';

export class MorganStanleyParser extends BaseStatementParser {
  constructor() {
    super('Morgan Stanley');
  }

  async detect(document) {
    const { filename, text, buffer } = document;
    
    if (filename && (filename.toLowerCase().includes('morgan') || filename.toLowerCase().includes('morganstanley') || filename.toLowerCase().includes('ms wealth'))) {
      return { canParse: true, confidence: 0.9 };
    }
    
    if (text) {
      const lower = text.toLowerCase();
      if (lower.includes('morgan stanley') || lower.includes('morganstanley.com') || lower.includes('ms wealth management')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      // Morgan Stanley often uses "Account #" and "Security"
      if ((csvText.includes('Account') || csvText.includes('Portfolio')) && 
          csvText.includes('Security') && 
          csvText.includes('Market Value')) {
        return { canParse: true, confidence: 0.75 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(document.buffer);
    }
    return [{ accountNumber: 'PENDING', accountName: 'Morgan Stanley Account', accountType: 'taxable_individual', custodian: 'Morgan Stanley', taxTreatment: 'taxable', currentValue: 0, asOfDate: new Date() }];
  }

  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account'] || row['Account #'] || row['Portfolio'] || row['Account Number'];
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = row['Account Name'] || row['Portfolio Name'] || `Morgan Stanley ${accountNumber}`;
        const type = this.deriveAccountType(accountName, accountNumber);
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType: type,
          custodian: 'Morgan Stanley',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['As of'] || row['Date'] || row['Report Date']),
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
      return symbol && !symbol.toLowerCase().includes('cash') && !symbol.toLowerCase().includes('money market');
    }).map(row => ({
      accountNumber: row['Account'] || row['Account #'] || row['Portfolio'],
      symbol: row['Symbol'] || row['Ticker'] || row['Security'],
      description: row['Description'] || row['Security Description'] || row['Security Name'] || '',
      assetClass: this.classifyAssetClass(row['Symbol'] || row['Ticker'], row['Description'] || ''),
      quantity: parseFloat(row['Quantity'] || row['Shares'] || row['Units'] || 0),
      costBasis: this.parseCurrency(row['Cost Basis'] || row['Original Cost'] || row['Total Cost']),
      acquisitionDate: this.parseDate(row['Acquired'] || row['Purchase Date'] || row['Date Acquired']),
      currentPrice: this.parseCurrency(row['Price'] || row['Last Price'] || row['Unit Price']),
      marketValue: this.parseCurrency(row['Market Value'] || row['Total Value'] || row['Value']),
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

export default MorganStanleyParser;
