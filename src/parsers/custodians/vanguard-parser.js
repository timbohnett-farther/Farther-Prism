/**
 * Vanguard Statement Parser
 * 
 * Supports Vanguard's CSV exports and PDF statements
 */

import { BaseStatementParser } from '../base-parser.js';

export class VanguardParser extends BaseStatementParser {
  constructor() {
    super('Vanguard');
  }

  async detect(document) {
    const { filename, text, buffer } = document;
    
    if (filename && filename.toLowerCase().includes('vanguard')) {
      return { canParse: true, confidence: 0.9 };
    }
    
    if (text && text.toLowerCase().includes('vanguard')) {
      return { canParse: true, confidence: 0.95 };
    }
    
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      if (csvText.includes('Account Number') && csvText.includes('Investment Name')) {
        return { canParse: true, confidence: 0.8 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  async parseAccounts(document) {
    if (document.mimeType === 'text/csv' || document.filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(document.buffer);
    }
    return [{ accountNumber: 'PENDING', accountName: 'Vanguard (PDF)', accountType: 'taxable_individual', custodian: 'Vanguard', taxTreatment: 'taxable', currentValue: 0, asOfDate: new Date() }];
  }

  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account Number'] || row['Account'];
      const accountName = row['Account Name'] || `Vanguard ${accountNumber}`;
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const type = this.deriveAccountType(accountName, accountNumber);
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType: type,
          custodian: 'Vanguard',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['As of'] || row['Date']),
        });
      }
      
      const marketValue = this.parseCurrency(row['Total Value'] || row['Market Value']);
      accountsMap.get(accountNumber).currentValue += marketValue;
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
    const positions = [];
    
    for (const row of rows) {
      const symbol = row['Symbol'] || row['Ticker'];
      if (!symbol || symbol === 'Cash' || symbol.includes('VMFXX')) continue;
      
      const quantity = parseFloat(row['Shares'] || row['Quantity'] || 0);
      if (quantity === 0) continue;
      
      positions.push({
        accountNumber: row['Account Number'] || row['Account'],
        symbol,
        description: row['Investment Name'] || row['Description'] || '',
        assetClass: this.classifyAssetClass(symbol, row['Investment Name'] || ''),
        quantity,
        costBasis: this.parseCurrency(row['Cost Basis'] || row['Total Cost']),
        acquisitionDate: this.parseDate(row['Date Acquired']),
        currentPrice: this.parseCurrency(row['Price'] || row['Share Price']),
        marketValue: this.parseCurrency(row['Total Value'] || row['Market Value']),
      });
    }
    
    return positions;
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

export default VanguardParser;
