import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { Doc } from '@blocksuite/store';
import { Service } from '@toeverything/infra';
import { nanoid } from 'nanoid';

import type { TableIndexService } from './table-index';
import type { WorkspaceService } from './workspace';

/**
 * Service for migrating existing database blocks to include tableId and workspace indexing
 */
export class TableMigrationService extends Service {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly tableIndexService: TableIndexService
  ) {
    super();
  }

  /**
   * Migrate all existing database blocks in the workspace to have tableId
   * and register them in the workspace table index
   */
  async migrateWorkspaceTables(): Promise<{
    migrated: number;
    skipped: number;
    errors: string[];
  }> {
    const result = {
      migrated: 0,
      skipped: 0,
      errors: [] as string[],
    };

    try {
      const workspace = this.workspaceService.workspace;
      const docCollection = workspace.docCollection;

      console.log('[TableMigration] Starting workspace table migration...');

      // Get all document metadata instead of relying on loaded documents
      const docMetas = docCollection?.meta?.docMetas || [];
      console.log(
        `[TableMigration] Found ${docMetas.length} documents in metadata to check for tables`
      );

      // Also try to get all docs directly from the collection
      const allDocs = docCollection?.docs || new Map();
      console.log(
        `[TableMigration] Found ${allDocs.size} documents directly in collection`
      );

      // Combine both approaches - use all available document IDs
      const allDocIds = new Set([
        ...docMetas.map(meta => meta.id),
        ...Array.from(allDocs.keys()),
      ]);

      console.log(
        `[TableMigration] Total unique documents to process: ${allDocIds.size}`
      );

      if (allDocIds.size === 0) {
        console.warn('[TableMigration] No documents found in workspace');
        return result;
      }

      // Iterate through all document IDs to find database blocks
      for (const docId of allDocIds) {
        try {
          console.log(`[TableMigration] Processing document ${docId}...`);

          // Get or create the document - this will load it if needed
          let doc = docCollection.getDoc(docId);
          if (!doc) {
            console.log(
              `[TableMigration] Document ${docId} not found in collection, attempting to create...`
            );
            try {
              doc = docCollection.createDoc(docId);
            } catch (e) {
              console.log(
                `[TableMigration] Could not create document ${docId}, skipping:`,
                e
              );
              continue;
            }
          }

          // Ensure doc is loaded - try multiple times if needed
          let loadAttempts = 0;
          const maxLoadAttempts = 3;
          while (!doc.loaded && loadAttempts < maxLoadAttempts) {
            console.log(
              `[TableMigration] Loading document ${docId}... (attempt ${loadAttempts + 1})`
            );
            try {
              doc.load();
              // Wait a bit for the document to fully load
              await new Promise(resolve => setTimeout(resolve, 100));
            } catch (e) {
              console.warn(
                `[TableMigration] Failed to load document ${docId} on attempt ${loadAttempts + 1}:`,
                e
              );
            }
            loadAttempts++;
          }

          if (!doc.loaded) {
            console.warn(
              `[TableMigration] Could not load document ${docId} after ${maxLoadAttempts} attempts, skipping`
            );
            continue;
          }

          // Get the store to access blocks
          const store = doc.getStore();
          if (!store) {
            console.warn(
              `[TableMigration] Could not get store for document ${docId}`
            );
            continue;
          }

          await this.migrateDocTables(store, docId, result);
        } catch (error) {
          const errorMsg = `Failed to migrate doc ${docId}: ${error}`;
          console.error(`[TableMigration] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }

      console.log(`[TableMigration] Migration completed:`, result);
      return result;
    } catch (error) {
      const errorMsg = `Workspace migration failed: ${error}`;
      console.error(errorMsg);
      result.errors.push(errorMsg);
      return result;
    }
  }

  /**
   * Migrate tables in a specific document
   */
  private async migrateDocTables(
    store: any,
    docId: string,
    result: { migrated: number; skipped: number; errors: string[] }
  ): Promise<void> {
    try {
      console.log(`[TableMigration] Analyzing store for document ${docId}...`);
      console.log(`[TableMigration] Store type:`, typeof store);
      console.log(
        `[TableMigration] Store methods:`,
        Object.getOwnPropertyNames(Object.getPrototypeOf(store))
      );

      // Use getModelsByFlavour to get all database blocks in the store
      const databaseBlocks = store.getModelsByFlavour('affine:database') || [];
      console.log(
        `[TableMigration] Document ${docId} contains ${databaseBlocks.length} database blocks`
      );

      if (databaseBlocks.length === 0) {
        console.log(
          `[TableMigration] No database blocks found in document ${docId}`
        );
        // Also check if there are any blocks at all
        try {
          const allBlocks = store.getAllModels?.() || [];
          console.log(
            `[TableMigration] Document ${docId} has ${allBlocks.length} total blocks`
          );
          const blockFlavours = allBlocks.map((block: any) => block.flavour);
          const uniqueFlavours = [...new Set(blockFlavours)];
          console.log(`[TableMigration] Block flavours found:`, uniqueFlavours);
        } catch (e) {
          console.log(`[TableMigration] Could not get all models:`, e);
        }
        return;
      }

      for (const block of databaseBlocks) {
        try {
          const blockId = block.id;
          const currentTableId = block.props?.tableId;

          if (currentTableId) {
            console.log(
              `[TableMigration] Database block ${blockId} already has tableId: ${currentTableId}`
            );

            // Check if it's registered in the index
            const existingTable =
              this.tableIndexService.getTable(currentTableId);
            if (!existingTable) {
              console.log(
                `[TableMigration] Re-registering table ${currentTableId} in index`
              );
              this.tableIndexService.registerTable(
                docId,
                blockId,
                block.props.title?.toString() || 'Untitled Table',
                currentTableId,
                1 // Initial usage count of 1 for existing tables
              );
            }
            result.skipped++;
          } else {
            // Generate new tableId and assign it
            const tableId = nanoid();
            console.log(
              `[TableMigration] Migrating database block ${blockId}, assigning tableId: ${tableId}`
            );

            // Update the block with tableId using store transaction
            store.transact(() => {
              block.props.tableId = tableId;
              console.log(
                `[TableMigration] Set tableId ${tableId} on block ${blockId}, props now:`,
                block.props
              );
            });

            // Register in the table index with initial usage of 1
            // because this table already exists and has at least one view
            this.tableIndexService.registerTable(
              docId,
              blockId,
              block.props.title?.toString() || 'Untitled Table',
              tableId,
              1 // Initial usage count of 1 for migrated tables
            );

            result.migrated++;
            console.log(
              `[TableMigration] Successfully migrated database block ${blockId} with tableId ${tableId}`
            );
          }
        } catch (error) {
          const errorMsg = `Failed to migrate block ${block.id} in doc ${docId}: ${error}`;
          console.error(`[TableMigration] ${errorMsg}`);
          result.errors.push(errorMsg);
        }
      }
    } catch (error) {
      const errorMsg = `Failed to process document ${docId}: ${error}`;
      console.error(`[TableMigration] ${errorMsg}`);
      result.errors.push(errorMsg);
    }
  }

  /**
   * Find all database blocks in a document
   */
  private findDatabaseBlocks(doc: Doc): DatabaseBlockModel[] {
    try {
      // Ensure doc is loaded
      if (!doc.loaded) {
        doc.load();
      }

      // Get the store to access blocks
      const store = doc.getStore();
      if (!store) {
        console.warn(
          `[TableMigration] Could not get store for document ${doc.id}`
        );
        return [];
      }

      // Use getModelsByFlavour to get all database blocks
      const databaseBlocks = store.getModelsByFlavour(
        'affine:database'
      ) as DatabaseBlockModel[];
      console.log(
        `[TableMigration] Found ${databaseBlocks.length} database blocks in document ${doc.id}`
      );
      return databaseBlocks;
    } catch (error) {
      console.error(
        `[TableMigration] Error finding database blocks in doc ${doc.id}:`,
        error
      );
      return [];
    }
  }

  /**
   * Check if migration is needed for the workspace
   */
  async needsMigration(): Promise<boolean> {
    try {
      console.log('[TableMigration] Checking if migration is needed...');
      const workspace = this.workspaceService.workspace;
      const docCollection = workspace.docCollection;

      // Get all document metadata AND direct docs from collection
      const docMetas = docCollection?.meta?.docMetas || [];
      const allDocs = docCollection?.docs || new Map();
      const allDocIds = new Set([
        ...docMetas.map(meta => meta.id),
        ...Array.from(allDocs.keys()),
      ]);

      console.log(
        `[TableMigration] Checking ${allDocIds.size} documents for unmigrated database blocks`
      );

      if (allDocIds.size === 0) {
        console.log(
          '[TableMigration] No documents found - no migration needed'
        );
        return false;
      }

      // Check each document for unmigrated database blocks
      for (const docId of allDocIds) {
        try {
          console.log(
            `[TableMigration] Checking document ${docId} for database blocks...`
          );

          // Get or create the document - this will load it if needed
          let doc = docCollection.getDoc(docId);
          if (!doc) {
            console.log(
              `[TableMigration] Document ${docId} not found in collection, skipping`
            );
            continue;
          }

          // Ensure doc is loaded before checking for database blocks
          if (!doc.loaded) {
            console.log(
              `[TableMigration] Loading document ${docId} to check for tables...`
            );
            doc.load();
          }

          const databaseBlocks = this.findDatabaseBlocks(doc);
          console.log(
            `[TableMigration] Found ${databaseBlocks.length} database blocks in document ${docId}`
          );

          // Check if any database block needs migration
          for (const block of databaseBlocks) {
            if (!block.props?.tableId) {
              console.log(
                `[TableMigration] Found unmigrated database block ${block.id} in doc ${docId} - migration needed`
              );
              return true;
            }

            // Also check if the table is properly indexed
            const tableId = block.props.tableId;
            const existingTable = this.tableIndexService.getTable(tableId);
            if (!existingTable) {
              console.log(
                `[TableMigration] Found database block ${block.id} with tableId ${tableId} but not in index - migration needed`
              );
              return true;
            }
          }
        } catch (error) {
          console.error(
            `[TableMigration] Error checking document ${docId}:`,
            error
          );
          // Continue checking other documents
        }
      }

      console.log(
        '[TableMigration] All database blocks are properly migrated and indexed'
      );
      return false;
    } catch (error) {
      console.error('[TableMigration] Error checking migration status:', error);
      // If we can't check, assume migration is needed to be safe
      return true;
    }
  }

  /**
   * Get migration status info
   */
  async getMigrationInfo(): Promise<{
    totalDatabaseBlocks: number;
    blocksWithTableId: number;
    blocksNeedingMigration: number;
    registeredInIndex: number;
  }> {
    const info = {
      totalDatabaseBlocks: 0,
      blocksWithTableId: 0,
      blocksNeedingMigration: 0,
      registeredInIndex: 0,
    };

    try {
      const workspace = this.workspaceService.workspace;
      const docCollection = workspace.docCollection;

      // Use all available document IDs
      const docMetas = docCollection?.meta?.docMetas || [];
      const allDocs = docCollection?.docs || new Map();
      const allDocIds = new Set([
        ...docMetas.map(meta => meta.id),
        ...Array.from(allDocs.keys()),
      ]);

      for (const docId of allDocIds) {
        try {
          let doc = docCollection.getDoc(docId);
          if (!doc) continue;

          if (!doc.loaded) {
            doc.load();
          }

          const databaseBlocks = this.findDatabaseBlocks(doc);
          info.totalDatabaseBlocks += databaseBlocks.length;

          for (const block of databaseBlocks) {
            const tableId = block.props?.tableId;
            if (tableId) {
              info.blocksWithTableId++;

              // Check if registered in index
              const existingTable = this.tableIndexService.getTable(tableId);
              if (existingTable) {
                info.registeredInIndex++;
              }
            } else {
              info.blocksNeedingMigration++;
            }
          }
        } catch (error) {
          console.error(
            `[TableMigration] Error processing document ${docId}:`,
            error
          );
        }
      }

      return info;
    } catch (error) {
      console.error('Failed to get migration info:', error);
      return info;
    }
  }
}
