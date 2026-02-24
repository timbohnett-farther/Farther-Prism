/**
 * Document Classifier
 * 
 * Routes uploaded statements to the correct custodian parser.
 * Uses pattern matching + AI fallback for unknown formats.
 */

import { SchwabParser } from './custodians/schwab-parser.js';
import { FidelityParser } from './custodians/fidelity-parser.js';
import { VanguardParser } from './custodians/vanguard-parser.js';
import { TDAParser } from './custodians/tda-parser.js';
import { ETradeParser } from './custodians/etrade-parser.js';
import { MorganStanleyParser } from './custodians/morgan-stanley-parser.js';
import { UBSParser } from './custodians/ubs-parser.js';
import { GoldmanParser } from './custodians/goldman-parser.js';
import { GenericParser } from './custodians/generic-parser.js';
// Future: InteractiveBrokersParser, PershingParser, etc.

export class DocumentClassifier {
  constructor() {
    // Register all available parsers
    // Order matters: most specific first, generic last
    this.parsers = [
      // Major retail brokers
      new SchwabParser(),
      new FidelityParser(),
      new VanguardParser(),
      new TDAParser(),
      new ETradeParser(),
      
      // Wealth management / UHNW
      new MorganStanleyParser(),
      new UBSParser(),
      new GoldmanParser(),
      
      // Generic fallback (MUST BE LAST - lowest confidence)
      new GenericParser(),
    ];
  }

  /**
   * Classify a document and return the best parser.
   * @param {Object} document - { buffer, filename, mimeType, text? }
   * @returns {Promise<{parser: BaseStatementParser, confidence: number, custodian: string}>}
   */
  async classify(document) {
    const results = [];
    
    // Run all parsers' detect() methods
    for (const parser of this.parsers) {
      try {
        const detection = await parser.detect(document);
        if (detection.canParse) {
          results.push({
            parser,
            confidence: detection.confidence,
            custodian: parser.custodianName,
          });
        }
      } catch (err) {
        console.error(`[Classifier] ${parser.custodianName} detection failed:`, err.message);
      }
    }
    
    // Sort by confidence (highest first)
    results.sort((a, b) => b.confidence - a.confidence);
    
    if (results.length === 0) {
      return {
        parser: null,
        confidence: 0,
        custodian: 'unknown',
        error: 'No parser matched this document',
      };
    }
    
    return results[0];
  }

  /**
   * Parse a document using the best available parser.
   * @param {Object} document - { buffer, filename, mimeType, text? }
   * @returns {Promise<{custodian, accounts, positions, transactions, metadata}>}
   */
  async parse(document) {
    const classification = await this.classify(document);
    
    if (!classification.parser) {
      throw new Error(`Unable to classify document: ${document.filename}. Custodian not recognized.`);
    }
    
    console.log(`[Classifier] Matched ${classification.custodian} (confidence: ${classification.confidence})`);
    
    // Parse using the matched parser
    const result = await classification.parser.parse(document);
    
    return {
      ...result,
      classification: {
        custodian: classification.custodian,
        confidence: classification.confidence,
      },
    };
  }

  /**
   * Get list of supported custodians.
   */
  getSupportedCustodians() {
    return this.parsers.map(p => ({
      name: p.custodianName,
      parser: p.constructor.name,
    }));
  }
}

export default DocumentClassifier;
