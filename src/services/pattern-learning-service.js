/**
 * Pattern Learning Service
 * 
 * Learns from successfully parsed statements to improve future classification.
 * Stores fingerprints (file patterns, headers, column names) in database.
 * Pre-classifies statements using historical patterns before running full parser detection.
 */

import { query, withTransaction } from '../db/pool.js';
import crypto from 'crypto';

export class PatternLearningService {
  
  /**
   * Generate a fingerprint from a document.
   * Fingerprint includes filename patterns, headers, column names, distinctive features.
   */
  generateFingerprint(document, parseResult = null) {
    const { filename, buffer, mimeType } = document;
    
    const fingerprint = {
      file_format: this.detectFileFormat(filename, mimeType),
      encoding: 'utf-8',
      filename_patterns: this.extractFilenamePatterns(filename),
    };
    
    // For CSV files, extract column structure
    if (fingerprint.file_format === 'csv') {
      try {
        const csvText = buffer.toString('utf-8');
        const lines = csvText.trim().split('\n').slice(0, 10); // First 10 lines
        
        if (lines.length > 0) {
          const headers = this.parseCSVLine(lines[0]);
          fingerprint.column_names = headers;
          fingerprint.header_signature = headers.join(',');
          fingerprint.column_count = headers.length;
          
          // Identify required columns (those with data in most rows)
          if (parseResult) {
            fingerprint.required_columns = this.identifyRequiredColumns(parseResult);
          }
          
          // Identify distinctive columns (unique to this custodian)
          fingerprint.distinctive_columns = this.identifyDistinctiveColumns(headers);
        }
      } catch (err) {
        console.error('[PatternLearning] Failed to extract CSV fingerprint:', err.message);
      }
    }
    
    return fingerprint;
  }

  /**
   * Try to match document against known patterns (fast path).
   * Returns best match or null.
   */
  async matchPattern(document) {
    const fingerprint = this.generateFingerprint(document);
    
    // Query database for matching patterns
    const result = await query(
      `SELECT id, custodian_name, parser_name, fingerprint, confidence_score, match_count
       FROM statement_patterns
       WHERE confidence_score > 0.6
       ORDER BY confidence_score DESC, match_count DESC
       LIMIT 50`,
      []
    );
    
    if (result.rows.length === 0) {
      return null; // No patterns yet - fall back to full detection
    }
    
    // Score each pattern against current document
    let bestMatch = null;
    let bestScore = 0;
    
    for (const pattern of result.rows) {
      const score = this.scorePatternMatch(fingerprint, pattern.fingerprint);
      
      if (score > bestScore && score > 0.7) {
        bestScore = score;
        bestMatch = {
          patternId: pattern.id,
          custodian: pattern.custodian_name,
          parser: pattern.parser_name,
          confidence: score * pattern.confidence_score, // Combine pattern confidence with match score
          matchScore: score,
          patternConfidence: pattern.confidence_score,
        };
      }
    }
    
    if (bestMatch) {
      console.log(`[PatternLearning] Matched pattern for ${bestMatch.custodian} (score: ${bestMatch.confidence.toFixed(2)})`);
      // Update match count
      await this.recordPatternMatch(bestMatch.patternId);
    }
    
    return bestMatch;
  }

  /**
   * Record a successful parse and learn the pattern.
   */
  async recordSuccessfulParse(document, custodianName, parserName, parseResult) {
    const fingerprint = this.generateFingerprint(document, parseResult);
    
    try {
      // Check if pattern already exists
      const existing = await query(
        `SELECT id, success_count, failure_count 
         FROM statement_patterns 
         WHERE custodian_name = $1 
           AND fingerprint @> $2::jsonb
         LIMIT 1`,
        [custodianName, JSON.stringify({ header_signature: fingerprint.header_signature })]
      );
      
      if (existing.rows.length > 0) {
        // Update existing pattern
        const patternId = existing.rows[0].id;
        await query(
          `UPDATE statement_patterns 
           SET success_count = success_count + 1,
               last_matched_at = NOW()
           WHERE id = $1`,
          [patternId]
        );
        await query('SELECT update_pattern_confidence($1)', [patternId]);
        console.log(`[PatternLearning] Updated pattern ${patternId} for ${custodianName}`);
      } else {
        // Create new pattern
        const sampleHeaders = this.extractSampleHeaders(document);
        const result = await query(
          `INSERT INTO statement_patterns (
            custodian_name, parser_name, fingerprint, 
            match_count, success_count, confidence_score,
            sample_filename, sample_headers, last_matched_at
          ) VALUES ($1, $2, $3, 1, 1, 0.8, $4, $5, NOW())
          RETURNING id`,
          [
            custodianName,
            parserName,
            JSON.stringify(fingerprint),
            document.filename,
            sampleHeaders,
          ]
        );
        console.log(`[PatternLearning] Created new pattern ${result.rows[0].id} for ${custodianName}`);
      }
    } catch (err) {
      console.error('[PatternLearning] Failed to record pattern:', err.message);
    }
  }

  /**
   * Record a failed parse attempt.
   */
  async recordFailedParse(document, patternId) {
    if (!patternId) return;
    
    try {
      await query(
        `UPDATE statement_patterns 
         SET failure_count = failure_count + 1
         WHERE id = $1`,
        [patternId]
      );
      await query('SELECT update_pattern_confidence($1)', [patternId]);
      console.log(`[PatternLearning] Recorded failure for pattern ${patternId}`);
    } catch (err) {
      console.error('[PatternLearning] Failed to record failure:', err.message);
    }
  }

  /**
   * Record that a pattern was matched (increments match_count).
   */
  async recordPatternMatch(patternId) {
    try {
      await query(
        `UPDATE statement_patterns 
         SET match_count = match_count + 1,
             last_matched_at = NOW()
         WHERE id = $1`,
        [patternId]
      );
    } catch (err) {
      console.error('[PatternLearning] Failed to record match:', err.message);
    }
  }

  /**
   * Score how well a fingerprint matches a known pattern.
   * Returns 0-1 score.
   */
  scorePatternMatch(fingerprint, patternFingerprint) {
    let score = 0;
    let totalWeight = 0;
    
    // Header signature match (high weight)
    if (fingerprint.header_signature && patternFingerprint.header_signature) {
      const weight = 0.5;
      totalWeight += weight;
      if (fingerprint.header_signature === patternFingerprint.header_signature) {
        score += weight;
      }
    }
    
    // Column names overlap (medium weight)
    if (fingerprint.column_names && patternFingerprint.column_names) {
      const weight = 0.3;
      totalWeight += weight;
      const overlap = this.calculateColumnOverlap(
        fingerprint.column_names,
        patternFingerprint.column_names
      );
      score += overlap * weight;
    }
    
    // Filename pattern match (low weight)
    if (fingerprint.filename_patterns && patternFingerprint.filename_patterns) {
      const weight = 0.2;
      totalWeight += weight;
      const filenameMatch = this.matchFilenamePatterns(
        fingerprint.filename_patterns,
        patternFingerprint.filename_patterns
      );
      score += (filenameMatch ? 1 : 0) * weight;
    }
    
    return totalWeight > 0 ? score / totalWeight : 0;
  }

  /**
   * Calculate column name overlap (Jaccard similarity).
   */
  calculateColumnOverlap(columns1, columns2) {
    const set1 = new Set(columns1.map(c => c.toLowerCase()));
    const set2 = new Set(columns2.map(c => c.toLowerCase()));
    
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  /**
   * Check if filename matches any patterns.
   */
  matchFilenamePatterns(patterns1, patterns2) {
    for (const p1 of patterns1) {
      for (const p2 of patterns2) {
        if (p1 === p2 || this.wildcardMatch(p1, p2)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Simple wildcard matching (* = any characters).
   */
  wildcardMatch(pattern, str) {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    return regex.test(str);
  }

  /**
   * Extract filename patterns (e.g., "schwab_positions_2024.csv" → ["schwab*", "*positions*", "*.csv"]).
   */
  extractFilenamePatterns(filename) {
    if (!filename) return [];
    
    const patterns = [];
    const lower = filename.toLowerCase();
    
    // Exact match
    patterns.push(lower);
    
    // Common keywords
    const keywords = ['schwab', 'fidelity', 'vanguard', 'morgan', 'ubs', 'goldman', 'td', 'etrade', 'positions', 'holdings', 'statement'];
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        patterns.push(`*${keyword}*`);
      }
    }
    
    // Extension pattern
    if (lower.endsWith('.csv')) patterns.push('*.csv');
    if (lower.endsWith('.pdf')) patterns.push('*.pdf');
    
    return [...new Set(patterns)]; // Deduplicate
  }

  /**
   * Identify required columns from parse result.
   */
  identifyRequiredColumns(parseResult) {
    const required = new Set();
    
    // Accounts need account number
    if (parseResult.accounts && parseResult.accounts.length > 0) {
      required.add('Account Number');
      required.add('Account');
    }
    
    // Positions need symbol and quantity
    if (parseResult.positions && parseResult.positions.length > 0) {
      required.add('Symbol');
      required.add('Quantity');
    }
    
    return Array.from(required);
  }

  /**
   * Identify distinctive columns (unique to specific custodians).
   */
  identifyDistinctiveColumns(headers) {
    const distinctive = [];
    const distinctiveKeywords = [
      'cusip', 'sedol', 'isin', // Security identifiers
      'trade date', 'settlement date', // Schwab/Fidelity specific
      'spaxx', 'fcash', 'vmfxx', // Cash sweep funds (custodian-specific)
      'portfolio', 'account id', // Morgan Stanley/UBS
    ];
    
    for (const header of headers) {
      const lower = header.toLowerCase();
      for (const keyword of distinctiveKeywords) {
        if (lower.includes(keyword)) {
          distinctive.push(header);
          break;
        }
      }
    }
    
    return distinctive;
  }

  /**
   * Extract first 5 rows of CSV for sample storage.
   */
  extractSampleHeaders(document) {
    try {
      const csvText = document.buffer.toString('utf-8');
      const lines = csvText.trim().split('\n').slice(0, 5);
      return lines.join('\n');
    } catch (err) {
      return null;
    }
  }

  /**
   * Detect file format from filename/mimetype.
   */
  detectFileFormat(filename, mimeType) {
    if (mimeType === 'text/csv' || filename?.endsWith('.csv')) return 'csv';
    if (mimeType === 'application/pdf' || filename?.endsWith('.pdf')) return 'pdf';
    if (mimeType === 'application/vnd.ms-excel' || filename?.endsWith('.xls')) return 'xls';
    return 'unknown';
  }

  /**
   * Parse CSV line (handles quoted fields).
   */
  parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  /**
   * Get pattern statistics for monitoring/debugging.
   */
  async getPatternStats() {
    const result = await query(
      `SELECT 
        custodian_name,
        COUNT(*) as pattern_count,
        SUM(match_count) as total_matches,
        SUM(success_count) as total_successes,
        SUM(failure_count) as total_failures,
        AVG(confidence_score) as avg_confidence
       FROM statement_patterns
       GROUP BY custodian_name
       ORDER BY total_matches DESC`,
      []
    );
    
    return result.rows;
  }
}

export default PatternLearningService;
