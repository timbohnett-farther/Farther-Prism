/**
 * Portfolio Statement File Parser
 * 
 * Supports: CSV, Excel (XLSX), PDF
 * Extracts: Ticker, Name, Shares, Price, Value
 * 
 * @module file-parser
 */

import fs from 'fs';
import csv from 'papaparse';
import XLSX from 'xlsx';

/**
 * Parse uploaded portfolio statement file
 */
export async function parsePortfolioFile(filePath, fileType) {
  try {
    if (fileType === 'csv' || filePath.endsWith('.csv')) {
      return await parseCSV(filePath);
    } else if (fileType === 'xlsx' || fileType === 'xls' || filePath.endsWith('.xlsx') || filePath.endsWith('.xls')) {
      return await parseExcel(filePath);
    } else if (fileType === 'pdf' || filePath.endsWith('.pdf')) {
      throw new Error('PDF parsing coming soon. Please convert to CSV or Excel for now.');
    } else {
      throw new Error('Unsupported file type. Please upload CSV, Excel, or PDF.');
    }
  } catch (error) {
    console.error('File parsing error:', error);
    throw error;
  }
}

/**
 * Parse CSV file
 */
async function parseCSV(filePath) {
  const fileContent = fs.readFileSync(filePath, 'utf8');
  
  return new Promise((resolve, reject) => {
    csv.parse(fileContent, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        try {
          const holdings = extractHoldingsFromRows(results.data);
          resolve({
            success: true,
            holdings,
            source: 'csv',
            rowCount: results.data.length,
          });
        } catch (error) {
          reject(error);
        }
      },
      error: (error) => reject(error),
    });
  });
}

/**
 * Parse Excel file
 */
async function parseExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0]; // Use first sheet
  const sheet = workbook.Sheets[sheetName];
  
  // Convert to JSON
  const data = XLSX.utils.sheet_to_json(sheet);
  
  const holdings = extractHoldingsFromRows(data);
  
  return {
    success: true,
    holdings,
    source: 'excel',
    sheetName,
    rowCount: data.length,
  };
}

/**
 * Parse PDF file (more complex - uses pattern matching)
 */
async function parsePDF(filePath) {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfData = await pdfParse(dataBuffer);
  
  const text = pdfData.text;
  
  // Extract holdings from PDF text using pattern matching
  const holdings = extractHoldingsFromPDFText(text);
  
  return {
    success: true,
    holdings,
    source: 'pdf',
    pages: pdfData.numpages,
    rowCount: holdings.length,
  };
}

/**
 * Extract holdings from structured row data (CSV/Excel)
 */
function extractHoldingsFromRows(rows) {
  const holdings = [];
  
  // Common column name variations
  const tickerKeys = ['ticker', 'symbol', 'stock', 'security'];
  const nameKeys = ['name', 'description', 'security name', 'holding'];
  const sharesKeys = ['shares', 'quantity', 'units', 'qty'];
  const priceKeys = ['price', 'current price', 'market price', 'last price'];
  const valueKeys = ['value', 'market value', 'current value', 'total'];
  
  rows.forEach((row) => {
    // Normalize keys to lowercase for matching
    const normalizedRow = {};
    Object.keys(row).forEach(key => {
      normalizedRow[key.toLowerCase().trim()] = row[key];
    });
    
    // Find columns
    const ticker = findValue(normalizedRow, tickerKeys);
    const name = findValue(normalizedRow, nameKeys);
    const shares = findValue(normalizedRow, sharesKeys);
    const price = findValue(normalizedRow, priceKeys);
    const value = findValue(normalizedRow, valueKeys);
    
    // Must have at least ticker and either (shares & price) or value
    if (ticker && (shares || value)) {
      const holding = {
        ticker: cleanTicker(ticker),
        name: name || '',
        shares: parseNumber(shares) || 0,
        price: parseNumber(price) || 0,
      };
      
      // Calculate value if not provided
      if (value) {
        holding.value = parseNumber(value);
        // Derive price if missing
        if (!holding.price && holding.shares > 0) {
          holding.price = holding.value / holding.shares;
        }
      } else if (holding.shares && holding.price) {
        holding.value = holding.shares * holding.price;
      }
      
      // Only add if we have meaningful data
      if (holding.ticker && holding.value > 0) {
        holdings.push(holding);
      }
    }
  });
  
  return holdings;
}

/**
 * Extract holdings from PDF text (pattern matching)
 */
function extractHoldingsFromPDFText(text) {
  const holdings = [];
  
  // Common patterns in brokerage statements
  // Pattern: TICKER  Description  Shares  Price  Value
  const patterns = [
    // Pattern 1: AAPL  Apple Inc  100  $150.00  $15,000.00
    /([A-Z]{1,5})\s+([A-Za-z\s&.,]+?)\s+(\d+(?:,\d{3})*(?:\.\d+)?)\s+\$?(\d+(?:,\d{3})*\.\d{2})\s+\$?(\d+(?:,\d{3})*\.\d{2})/g,
    
    // Pattern 2: Table-like format
    /^([A-Z]{1,5})\s+(.+?)\s+(\d[\d,]*(?:\.\d+)?)\s+(\d[\d,]*\.\d{2})/gm,
  ];
  
  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      const [, ticker, name, shares, price, value] = match;
      
      holdings.push({
        ticker: cleanTicker(ticker),
        name: (name || '').trim(),
        shares: parseNumber(shares),
        price: parseNumber(price),
        value: value ? parseNumber(value) : parseNumber(shares) * parseNumber(price),
      });
    }
  });
  
  // Deduplicate by ticker
  const unique = new Map();
  holdings.forEach(h => {
    if (!unique.has(h.ticker) || h.value > (unique.get(h.ticker).value || 0)) {
      unique.set(h.ticker, h);
    }
  });
  
  return Array.from(unique.values());
}

/**
 * Helper: Find value from multiple possible keys
 */
function findValue(row, possibleKeys) {
  for (const key of possibleKeys) {
    if (row[key] !== undefined && row[key] !== null && row[key] !== '') {
      return row[key];
    }
  }
  return null;
}

/**
 * Helper: Clean ticker symbol
 */
function cleanTicker(ticker) {
  if (!ticker) return '';
  return String(ticker)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, ''); // Remove special chars
}

/**
 * Helper: Parse number from string (handles $, commas)
 */
function parseNumber(value) {
  if (typeof value === 'number') return value;
  if (!value) return 0;
  
  const str = String(value)
    .replace(/[$,\s]/g, '') // Remove $, commas, spaces
    .replace(/[()]/g, '-'); // Convert (100) to -100
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}
