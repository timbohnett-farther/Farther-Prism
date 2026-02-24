/**
 * Charles Schwab Statement Parser
 * 
 * Supports:
 * - PDF statements (monthly/quarterly)
 * - CSV position exports
 * - Account summaries
 * - Holdings with cost basis
 */

import { BaseStatementParser } from '../base-parser.js';

export class SchwabParser extends BaseStatementParser {
  constructor() {
    super('Charles Schwab');
  }

  /**
   * Detect if this is a Schwab statement.
   */
  async detect(document) {
    const { filename, text, buffer } = document;
    
    // Check filename patterns
    if (filename && filename.toLowerCase().includes('schwab')) {
      return { canParse: true, confidence: 0.9 };
    }
    
    // Check text content (if extracted)
    if (text) {
      const lowerText = text.toLowerCase();
      
      if (lowerText.includes('charles schwab') || 
          lowerText.includes('schwab.com') ||
          lowerText.includes('schwab brokerage')) {
        return { canParse: true, confidence: 0.95 };
      }
    }
    
    // Check CSV headers (Schwab-specific)
    if (document.mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      const csvText = buffer.toString('utf-8');
      if (csvText.includes('Account Number') && 
          csvText.includes('Symbol') && 
          csvText.includes('Quantity')) {
        return { canParse: true, confidence: 0.85 };
      }
    }
    
    return { canParse: false, confidence: 0 };
  }

  /**
   * Parse accounts from Schwab statement.
   */
  async parseAccounts(document) {
    const { mimeType, buffer, filename } = document;
    
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      return this.parseAccountsFromCSV(buffer);
    } else if (mimeType === 'application/pdf' || filename?.endsWith('.pdf')) {
      return this.parseAccountsFromPDF(buffer);
    }
    
    throw new Error('Unsupported file type for Schwab parser');
  }

  /**
   * Parse accounts from Schwab CSV export.
   */
  parseAccountsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    
    if (rows.length === 0) return [];
    
    // Group by account number
    const accountsMap = new Map();
    
    for (const row of rows) {
      const accountNumber = row['Account Number'] || row['Account'];
      if (!accountNumber) continue;
      
      if (!accountsMap.has(accountNumber)) {
        const accountName = row['Account Type'] || row['Account Name'] || `Schwab ${accountNumber}`;
        const accountType = this.deriveAccountType(accountName, accountNumber);
        
        accountsMap.set(accountNumber, {
          accountNumber,
          accountName,
          accountType,
          custodian: 'Charles Schwab',
          taxTreatment: this.deriveTaxTreatment(accountType),
          currentValue: 0, // Will sum from positions
          asOfDate: this.parseDate(row['As of Date'] || row['Date']),
        });
      }
      
      // Accumulate market value
      const marketValue = this.parseCurrency(row['Market Value'] || row['Value']);
      accountsMap.get(accountNumber).currentValue += marketValue;
    }
    
    return Array.from(accountsMap.values());
  }

  /**
   * Parse accounts from Schwab PDF statement.
   * TODO: Implement when pdf-parse is available.
   */
  async parseAccountsFromPDF(buffer) {
    // For now, return placeholder
    // In production, use pdf-parse to extract text, then parse sections
    return [{
      accountNumber: 'PENDING_PDF_PARSE',
      accountName: 'Schwab Account (PDF)',
      accountType: 'taxable_individual',
      custodian: 'Charles Schwab',
      taxTreatment: 'taxable',
      currentValue: 0,
      asOfDate: new Date(),
    }];
  }

  /**
   * Parse positions from Schwab statement.
   */
  async parsePositions(document) {
    const { mimeType, buffer, filename } = document;
    
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      return this.parsePositionsFromCSV(buffer);
    } else if (mimeType === 'application/pdf' || filename?.endsWith('.pdf')) {
      return this.parsePositionsFromPDF(buffer);
    }
    
    throw new Error('Unsupported file type for Schwab parser');
  }

  /**
   * Parse positions from Schwab CSV export.
   */
  parsePositionsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const positions = [];
    
    for (const row of rows) {
      const symbol = row['Symbol'] || row['Ticker'];
      if (!symbol || symbol === 'Cash' || symbol === 'CASH') continue; // Skip cash rows
      
      const accountNumber = row['Account Number'] || row['Account'];
      const description = row['Description'] || row['Security Description'] || '';
      const quantity = parseFloat(row['Quantity'] || row['Shares'] || 0);
      const price = this.parseCurrency(row['Price'] || row['Last Price'] || row['Current Price']);
      const marketValue = this.parseCurrency(row['Market Value'] || row['Value']);
      const costBasis = this.parseCurrency(row['Cost Basis'] || row['Total Cost']);
      const acquisitionDate = this.parseDate(row['Acquisition Date'] || row['Date Acquired']);
      
      if (quantity === 0) continue; // Skip zero-quantity positions
      
      positions.push({
        accountNumber,
        symbol,
        description,
        assetClass: this.classifyAssetClass(symbol, description),
        quantity,
        costBasis: costBasis || (price * quantity), // Estimate if not provided
        acquisitionDate,
        currentPrice: price,
        marketValue: marketValue || (price * quantity),
      });
    }
    
    return positions;
  }

  /**
   * Parse positions from Schwab PDF statement.
   * TODO: Implement when pdf-parse is available.
   */
  async parsePositionsFromPDF(buffer) {
    // Placeholder for PDF parsing
    return [];
  }

  /**
   * Parse transactions from Schwab statement (optional).
   */
  async parseTransactions(document) {
    const { mimeType, buffer, filename } = document;
    
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) {
      return this.parseTransactionsFromCSV(buffer);
    }
    
    return []; // PDF transaction parsing not implemented yet
  }

  /**
   * Parse transactions from Schwab CSV.
   */
  parseTransactionsFromCSV(buffer) {
    const rows = this.parseCSV(buffer);
    const transactions = [];
    
    for (const row of rows) {
      const date = this.parseDate(row['Date'] || row['Trade Date']);
      const action = row['Action'] || row['Transaction Type'];
      const symbol = row['Symbol'];
      const quantity = parseFloat(row['Quantity'] || row['Shares'] || 0);
      const price = this.parseCurrency(row['Price']);
      const amount = this.parseCurrency(row['Amount']);
      
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
   * Helper: Normalize Schwab transaction types to standard types.
   */
  normalizeTransactionType(schwabType) {
    const type = (schwabType || '').toLowerCase();
    
    if (type.includes('buy') || type.includes('purchase')) return 'BUY';
    if (type.includes('sell') || type.includes('sale')) return 'SELL';
    if (type.includes('dividend')) return 'DIVIDEND';
    if (type.includes('interest')) return 'INTEREST';
    if (type.includes('deposit') || type.includes('contribution')) return 'DEPOSIT';
    if (type.includes('withdrawal') || type.includes('distribution')) return 'WITHDRAWAL';
    if (type.includes('transfer in')) return 'TRANSFER_IN';
    if (type.includes('transfer out')) return 'TRANSFER_OUT';
    if (type.includes('fee')) return 'FEE';
    
    return 'OTHER';
  }

  /**
   * Helper: Derive tax treatment from account type.
   */
  deriveTaxTreatment(accountType) {
    if (accountType.includes('roth') || accountType === 'hsa') return 'tax_free';
    if (accountType.includes('ira') || accountType.includes('401k') || accountType.includes('403b')) {
      return 'tax_deferred';
    }
    return 'taxable';
  }
}

export default SchwabParser;
