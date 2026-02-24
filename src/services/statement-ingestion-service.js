/**
 * Statement Ingestion Service
 * 
 * Orchestrates the full pipeline:
 * 1. Document upload
 * 2. Classification (detect custodian)
 * 3. Parsing (extract accounts + positions)
 * 4. Data sanitization & encryption
 * 5. Database insertion
 * 6. Reconciliation & validation
 */

import { query, withTransaction } from '../db/pool.js';
import { DocumentClassifier } from '../parsers/document-classifier.js';
import { PatternLearningService } from './pattern-learning-service.js';
import crypto from 'crypto';

export class StatementIngestionService {
  constructor() {
    this.classifier = new DocumentClassifier();
    this.patternLearning = new PatternLearningService();
  }

  /**
   * Ingest a statement file for a household.
   * @param {UUID} householdId - Household ID
   * @param {Object} file - { buffer, filename, mimeType }
   * @returns {Promise<{accounts, positions, summary}>}
   */
  async ingestStatement(householdId, file) {
    console.log(`[Ingestion] Processing ${file.filename} for household ${householdId}`);
    
    const fileHash = this.hashFile(file.buffer);
    let parsed;
    let usedPattern = null;
    let patternId = null;
    
    // Step 1: Try pattern-based classification (fast path)
    const patternMatch = await this.patternLearning.matchPattern(file);
    
    if (patternMatch && patternMatch.confidence > 0.75) {
      console.log(`[Ingestion] Using learned pattern for ${patternMatch.custodian} (confidence: ${patternMatch.confidence.toFixed(2)})`);
      usedPattern = patternMatch;
      patternId = patternMatch.patternId;
      
      // Parse with matched parser
      try {
        const parser = this.classifier.parsers.find(p => p.constructor.name === patternMatch.parser);
        if (parser) {
          parsed = await parser.parse(file);
        } else {
          console.warn('[Ingestion] Pattern matched but parser not found - falling back to full classification');
          parsed = await this.classifier.parse(file);
        }
      } catch (err) {
        console.error('[Ingestion] Pattern-based parse failed:', err.message);
        // Record failure and fall back
        await this.patternLearning.recordFailedParse(file, patternId);
        parsed = await this.classifier.parse(file);
      }
    } else {
      // Step 2: Fall back to full classification
      console.log('[Ingestion] No pattern match - using full classification');
      parsed = await this.classifier.parse(file);
    }
    
    console.log(`[Ingestion] Parsed ${parsed.custodian}: ${parsed.accounts.length} accounts, ${parsed.positions.length} positions`);
    
    // Step 2: Insert into database (transactional)
    const result = await withTransaction(async (client) => {
      const insertedAccounts = [];
      const insertedPositions = [];
      
      // Insert accounts
      for (const account of parsed.accounts) {
        const accountId = await this.insertAccount(client, householdId, account);
        insertedAccounts.push({ ...account, id: accountId });
      }
      
      // Insert positions (link to accounts by account number)
      for (const position of parsed.positions) {
        const accountId = this.findAccountIdByNumber(insertedAccounts, position.accountNumber);
        if (accountId) {
          const positionId = await this.insertPosition(client, accountId, position);
          insertedPositions.push({ ...position, id: positionId, accountId });
        } else {
          console.warn(`[Ingestion] Skipping position ${position.symbol} - account ${position.accountNumber} not found`);
        }
      }
      
      // Log audit trail
      await client.query(
        `INSERT INTO audit_log (household_id, action, entity_type, changes, ip_address)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          householdId,
          'import_statement',
          'statement',
          JSON.stringify({
            filename: file.filename,
            custodian: parsed.custodian,
            accountsImported: insertedAccounts.length,
            positionsImported: insertedPositions.length,
          }),
          null, // IP address (passed from API layer)
        ]
      );
      
      return { accounts: insertedAccounts, positions: insertedPositions };
    });
    
    // Determine parser name
    const parserName = usedPattern ? usedPattern.parser : (parsed.classification?.parser || parsed.metadata?.parser || 'UnknownParser');
    const confidence = usedPattern ? usedPattern.confidence : (parsed.classification?.confidence || 0.5);
    
    // Step 3: Learn from successful parse
    try {
      await this.patternLearning.recordSuccessfulParse(
        file,
        parsed.custodian,
        parserName,
        parsed
      );
    } catch (err) {
      console.error('[Ingestion] Failed to record pattern learning:', err.message);
    }
    
    // Step 4: Record uploaded statement for audit trail
    try {
      await query(
        `INSERT INTO uploaded_statements (
          household_id, filename, file_size_bytes, mime_type, file_hash,
          detected_custodian, detected_parser, classification_confidence,
          pattern_id, parse_status, accounts_imported, positions_imported, total_value
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          householdId,
          file.filename,
          file.buffer.length,
          file.mimeType,
          fileHash,
          parsed.custodian,
          parserName,
          confidence,
          patternId,
          'success',
          result.accounts.length,
          result.positions.length,
          result.accounts.reduce((sum, a) => sum + a.currentValue, 0),
        ]
      );
    } catch (err) {
      console.error('[Ingestion] Failed to record uploaded statement:', err.message);
    }
    
    // Step 5: Return summary
    return {
      success: true,
      custodian: parsed.custodian,
      classification: {
        custodian: parsed.custodian,
        parser: parserName,
        confidence: confidence,
      },
      usedPattern: usedPattern ? {
        custodian: usedPattern.custodian,
        confidence: usedPattern.confidence,
        matchScore: usedPattern.matchScore,
      } : null,
      accounts: result.accounts,
      positions: result.positions,
      summary: {
        accountsImported: result.accounts.length,
        positionsImported: result.positions.length,
        totalValue: result.accounts.reduce((sum, a) => sum + a.currentValue, 0),
      },
    };
  }
  
  /**
   * Hash file for deduplication.
   * @private
   */
  hashFile(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Insert account into database.
   * @private
   */
  async insertAccount(client, householdId, account) {
    // Encrypt account number
    const encryptedAccountNumber = this.encryptAccountNumber(account.accountNumber);
    
    const result = await client.query(
      `INSERT INTO accounts (
        household_id, account_number_encrypted, account_name, account_type,
        tax_treatment, custodian, current_value, as_of_date, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (household_id, account_number_encrypted) 
      DO UPDATE SET 
        current_value = EXCLUDED.current_value,
        as_of_date = EXCLUDED.as_of_date,
        updated_at = NOW()
      RETURNING id`,
      [
        householdId,
        encryptedAccountNumber,
        account.accountName,
        account.accountType,
        account.taxTreatment,
        account.custodian,
        account.currentValue,
        account.asOfDate,
        JSON.stringify({ imported: true, needsOwnerAssignment: true }),
      ]
    );
    
    return result.rows[0].id;
  }

  /**
   * Insert position/lot into database.
   * @private
   */
  async insertPosition(client, accountId, position) {
    const result = await client.query(
      `INSERT INTO lots (
        account_id, symbol, description, asset_class, quantity,
        cost_basis, acquisition_date, current_price, market_value, as_of_date
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id`,
      [
        accountId,
        position.symbol,
        position.description,
        position.assetClass,
        position.quantity,
        position.costBasis,
        position.acquisitionDate,
        position.currentPrice,
        position.marketValue,
      ]
    );
    
    return result.rows[0].id;
  }

  /**
   * Find account ID by account number from inserted accounts.
   * @private
   */
  findAccountIdByNumber(accounts, accountNumber) {
    const account = accounts.find(a => a.accountNumber === accountNumber);
    return account?.id || null;
  }

  /**
   * Encrypt account number using AES-256.
   * @private
   */
  encryptAccountNumber(accountNumber) {
    // Simple hash for now (in production, use proper encryption with key rotation)
    const hash = crypto.createHash('sha256');
    hash.update(accountNumber + process.env.ENCRYPTION_SALT || 'default_salt');
    return hash.digest('hex');
  }

  /**
   * Get list of supported custodians.
   */
  getSupportedCustodians() {
    return this.classifier.getSupportedCustodians();
  }

  /**
   * Reconcile imported positions with existing database.
   * (Detect changes, additions, deletions)
   */
  async reconcilePositions(householdId) {
    // TODO: Implement reconciliation logic
    // - Compare imported positions with existing lots
    // - Flag discrepancies (quantity changes, price drifts)
    // - Generate reconciliation report
    
    return {
      status: 'not_implemented',
      message: 'Position reconciliation coming in Phase 2B',
    };
  }
}

export default StatementIngestionService;
