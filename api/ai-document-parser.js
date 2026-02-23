/**
 * AI-Powered Document Parser
 * 
 * Uses vision models to intelligently extract portfolio holdings
 * from ANY statement format (PDF, images, complex layouts)
 * 
 * @module ai-document-parser
 */

import fs from 'fs';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Anthropic client (Claude has excellent vision + structured output)
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Parse document using AI vision
 */
export async function parseDocumentWithAI(filePath, fileType) {
  try {
    // Convert file to base64 for Claude
    const fileBuffer = fs.readFileSync(filePath);
    const base64Data = fileBuffer.toString('base64');
    
    // Determine media type
    const mediaTypeMap = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'webp': 'image/webp',
      'csv': 'text/csv',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'xls': 'application/vnd.ms-excel',
    };
    
    const mediaType = mediaTypeMap[fileType] || 'application/octet-stream';
    
    // For CSV/Excel, read as text first (more efficient)
    let documentContent;
    if (fileType === 'csv' || fileType === 'txt') {
      documentContent = fileBuffer.toString('utf8');
    }
    
    // Build Claude prompt
    const prompt = buildExtractionPrompt();
    
    // Call Claude with vision
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: documentContent ? [
            {
              type: 'text',
              text: `${prompt}\n\nDocument content:\n${documentContent}`,
            },
          ] : [
            {
              type: 'text',
              text: prompt,
            },
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
          ],
        },
      ],
    });
    
    // Parse Claude's response
    const responseText = message.content[0].text;
    const holdings = parseClaudeResponse(responseText);
    
    return {
      success: true,
      holdings,
      source: 'ai',
      model: 'claude-3.5-sonnet',
      confidence: 'high',
    };
  } catch (error) {
    console.error('AI parsing error:', error);
    throw new Error(`AI parsing failed: ${error.message}`);
  }
}

/**
 * Build extraction prompt for Claude
 */
function buildExtractionPrompt() {
  return `You are an expert financial document analyst. Extract all portfolio holdings from this brokerage statement.

For EACH holding, extract:
- Ticker/Symbol (stock symbol, e.g., "AAPL", "MSFT")
- Name (full security name)
- Shares (quantity owned)
- Price (current market price per share)
- Value (total market value = shares × price)

IMPORTANT RULES:
1. Extract ALL holdings - stocks, bonds, ETFs, mutual funds, options
2. If price or value is missing, calculate from the other
3. Ignore summary sections, headers, account totals
4. Clean ticker symbols (remove spaces, special chars)
5. Handle different formats: tables, lists, multi-column layouts
6. Skip cash/money market unless it's a money market fund with a ticker

OUTPUT FORMAT (JSON array):
[
  {
    "ticker": "AAPL",
    "name": "Apple Inc",
    "shares": 100,
    "price": 178.50,
    "value": 17850
  },
  {
    "ticker": "VTSAX",
    "name": "Vanguard Total Stock Market Index Fund",
    "shares": 500,
    "price": 112.34,
    "value": 56170
  }
]

Return ONLY the JSON array, nothing else. If no holdings found, return [].`;
}

/**
 * Parse Claude's JSON response
 */
function parseClaudeResponse(text) {
  try {
    // Extract JSON from response (Claude might add explanation text)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.warn('No JSON array found in Claude response:', text);
      return [];
    }
    
    const holdings = JSON.parse(jsonMatch[0]);
    
    // Validate and clean each holding
    return holdings.map(h => ({
      ticker: cleanTicker(h.ticker || h.symbol || ''),
      name: String(h.name || '').trim(),
      shares: parseFloat(h.shares || h.quantity || 0),
      price: parseFloat(h.price || h.current_price || 0),
      value: parseFloat(h.value || h.market_value || (h.shares * h.price) || 0),
    })).filter(h => h.ticker && h.value > 0);
    
  } catch (error) {
    console.error('Failed to parse Claude response:', error);
    console.error('Response text:', text);
    throw new Error('AI returned invalid format');
  }
}

/**
 * Clean ticker symbol
 */
function cleanTicker(ticker) {
  if (!ticker) return '';
  return String(ticker)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

/**
 * Fallback: Use AI to enhance basic parser results
 */
export async function enhanceWithAI(holdings, originalText) {
  try {
    const prompt = `Review these extracted portfolio holdings and fix any errors:

Original data:
${JSON.stringify(holdings, null, 2)}

Tasks:
1. Correct any malformed ticker symbols
2. Fill in missing company names (if you recognize the ticker)
3. Verify calculations (value should equal shares × price)
4. Remove duplicates
5. Flag any suspicious entries

Return the corrected JSON array.`;

    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 2048,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });
    
    const responseText = message.content[0].text;
    return parseClaudeResponse(responseText);
  } catch (error) {
    console.error('AI enhancement error:', error);
    return holdings; // Return original if enhancement fails
  }
}
