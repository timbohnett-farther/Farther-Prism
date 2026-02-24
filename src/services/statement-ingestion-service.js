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
import crypto from 'crypto';

export class StatementIngestionService {
  constructor() {
    this.classifier = new DocumentClassifier();
  }

  /**
   * Ingest a statement file for a household.
   * @param {UUID} householdId - Household ID
   * @param {Object} file - { buffer, filename, mimeType }
   * @returns {Promise<{accounts, positions, summary}>}
   */
  async ingestStatement(householdId, file) {
    console.log(`[Ingestion] Processing ${file.filename} for household ${householdId}`);
    
    // Step 1: Classify and parse
    const parsed = await this.classifier.parse(file);
    
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
    
    // Step 3: Return summary
    return {
      success: true,
      custodian: parsed.custodian,
      classification: parsed.classification,
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
