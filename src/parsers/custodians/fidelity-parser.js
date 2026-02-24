/**
 * Fidelity Investments Statement Parser
 * 
 * Supports:
 * - CSV position exports
 * - PDF statements (placeholder)
 * - Account summaries
 * - Holdings with cost basis
 */

import { BaseStatementParser } from '../base-parser.js';

export class FidelityParser extends BaseStatementParser {
  constructor() {
    super('Fidelity Investments');
  }

  /**
   * Detect if this is a Fidelity statement.
   */
  async detect(document) {
    const { filename, text, buffer } = document;
    
    // Check filename patterns
    if (filename && filename.toLowerCase().includes('fidelity')) {
      return { canParse: true, confidence: 0.9 };
    }
    
    // Check text content
    if (text) {
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('fidelity investments') || 
          lowerText.includes('fidelity.com') ||
          lowerText.includes('fidelity brokerage')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    // Check CSV headers (Fidelity-specific)
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      // Fidelity often uses "Account Name" and "Current Value" headers
      if ((csvText.includes('Account Name') || csvText.includes('Account Number')) && 
          (csvText.includes('Current Value') || csvText.includes('Market Value')) &&
          csvText.includes('Symbol')) {
        return { canParse: true, confidence: 0.8 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  /**
   * Parse accounts from Fidelity statement.
   */
  async parseAccounts(document) {
    const { mimeType, buffer, filename } = document;
    
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(buffer);
    } else if (mimeType === 'application/pdf' || filename?.endsWith('.pdf')) {
      return this.parseAccountsFromPDF(buffer);
    }
    
    throw new Error('Unsupported file type for Fidelity parser');
  }

  /**
   * Parse accounts from Fidelity CSV export.
   */
  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    
    if (rows.length === 0) return [];
    
    // Group by account number/name
    const accountsMap = new Map();
    
    for (const row of rows) {
      // Fidelity uses various column names
      const accountNumber = row['Account Number'] || row['Account'] || row['Account #'];
      const accountName = row['Account Name'] || row['Account Type'] || row['Account Description'];
      
      if (!accountNumber && !accountName) continue;
      
      const accountKey = accountNumber || accountName;
      
      if (!accountsMap.has(accountKey)) {
        const type = this.deriveAccountType(accountName, accountNumber);
        
        accountsMap.set(accountKey, {
          accountNumber: accountNumber || accountName, // Use name as fallback
          accountName: accountName || `Fidelity ${accountNumber}`,
          accountType: type,
          custodian: 'Fidelity Investments',
          taxTreatment: this.deriveTaxTreatment(type),
          currentValue: 0,
          asOfDate: this.parseDate(row['As of Date'] || row['Date'] || row['Run Date']),
        });
      }
      
      // Accumulate market value
      const marketValue = this.parseCurrency(
        row['Current Value'] || row['Market Value'] || row['Value']
      );
      accountsMap.get(accountKey).currentValue += marketValue;
    }
    
    return Array.from(accountsMap.values());
  }

  /**
   * Parse accounts from Fidelity PDF.
   * TODO: Implement with pdf-parse.
   */
  async parseAccountsFromPDF(buffer) {
    return [{
      accountNumber: 'PENDING_PDF_PARSE',
      accountName: 'Fidelity Account (PDF)',
      accountType: 'taxable_individual',
      custodian: 'Fidelity Investments',
      taxTreatment: 'taxable',
      currentValue: 0,
      asOfDate: new Date(),
    }];
  }

  /**
   * Parse positions from Fidelity statement.
   */
  async parsePositions(document) {
    const { mimeType, buffer, filename } = document;
    
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      return this.parsePositionsFromCSV(buffer);
    } else if (mimeType === 'application/pdf' || filename?.endsWith('.pdf')) {
      return this.parsePositionsFromPDF(buffer);
    }
    
    throw new Error('Unsupported file type for Fidelity parser');
  }

  /**
   * Parse positions from Fidelity CSV.
   */
  parsePositionsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const positions = [];
    
    for (const row of rows) {
      const symbol = row['Symbol'] || row['Ticker'];
      
      // Skip cash, money market, and empty rows
      if (!symbol || 
          symbol.toUpperCase() === 'CASH' || 
          symbol.includes('SPAXX') ||  // Fidelity cash sweep
          symbol.includes('FDRXX')) {   // Fidelity money market
        continue;
      }
      
      const accountNumber = row['Account Number'] || row['Account'] || row['Account Name'];
      const description = row['Description'] || row['Security Description'] || row['Security Name'] || '';
      const quantity = parseFloat(row['Quantity'] || row['Shares'] || 0);
      
      if (quantity === 0) continue;
      
      // Fidelity column variations
      const price = this.parseCurrency(
        row['Last Price'] || row['Price'] || row['Current Price'] || row['Last Price ($)']
      );
      const marketValue = this.parseCurrency(
        row['Current Value'] || row['Market Value'] || row['Value'] || row['Current Value ($)']
      );
      const costBasis = this.parseCurrency(
        row['Cost Basis Total'] || row['Cost Basis'] || row['Total Cost Basis']
      );
      const acquisitionDate = this.parseDate(
        row['Date Acquired'] || row['Acquisition Date'] || row['Open Date']
      );
      
      positions.push({
        accountNumber,
        symbol,
        description,
        assetClass: this.classifyAssetClass(symbol, description),
        quantity,
        costBasis: costBasis || (price * quantity),
        acquisitionDate,
        currentPrice: price,
        marketValue: marketValue || (price * quantity),
      });
    }
    
    return positions;
  }

  /**
   * Parse positions from Fidelity PDF.
   * TODO: Implement with pdf-parse.
   */
  async parsePositionsFromPDF(buffer) {
    return [];
  }

  /**
   * Parse transactions from Fidelity statement.
   */
  async parseTransactions(document) {
    const { mimeType, buffer, filename } = document;
    
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      return this.parseTransactionsFromCSV(buffer);
    }
    
    return [];
  }

  /**
   * Parse transactions from Fidelity CSV.
   */
  parseTransactionsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const transactions = [];
    
    for (const row of rows) {
      const date = this.parseDate(row['Run Date'] || row['Date'] || row['Trade Date']);
      const action = row['Action'] || row['Transaction Type'] || row['Type'];
      const symbol = row['Symbol'];
      const quantity = parseFloat(row['Quantity'] || row['Shares'] || 0);
      const price = this.parseCurrency(row['Price'] || row['Price ($)']);
      const amount = this.parseCurrency(row['Amount'] || row['Amount ($)']);
      
      if (!date || !action) continue;
      
      transactions.push({
        date,
        type: this.normalizeTransactionType(action),
        symbol,
        quantity,
        price,
        amount,
      });
    }
    
    return transactions;
  }

  /**
   * Normalize Fidelity transaction types.
   */
  normalizeTransactionType(fidelityType) {
    const type = (fidelityType || '').toLowerCase();
    
    if (type.includes('you bought') || type.includes('buy')) return 'BUY';
    if (type.includes('you sold') || type.includes('sell') || type.includes('sale')) return 'SELL';
    if (type.includes('dividend')) return 'DIVIDEND';
    if (type.includes('interest')) return 'INTEREST';
    if (type.includes('deposit') || type.includes('contribution') || type.includes('electronic funds transfer received')) return 'DEPOSIT';
    if (type.includes('withdrawal') || type.includes('check') || type.includes('electronic funds transfer paid')) return 'WITHDRAWAL';
    if (type.includes('transfer')) return type.includes('in') ? 'TRANSFER_IN' : 'TRANSFER_OUT';
    if (type.includes('fee') || type.includes('commission')) return 'FEE';
    if (type.includes('reinvest')) return 'REINVEST';
    
    return 'OTHER';
  }

  /**
   * Derive tax treatment from account type.
   */
  deriveTaxTreatment(accountType) {
    if (accountType.includes('roth') || accountType === 'hsa') return 'tax_free';
    if (accountType.includes('ira') || accountType.includes('401k') || accountType.includes('403b')) {
      return 'tax_deferred';
    }
    return 'taxable';
  }
}

export default FidelityParser;
