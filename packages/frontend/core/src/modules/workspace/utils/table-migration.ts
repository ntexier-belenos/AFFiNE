import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { Store, TableMeta } from '@blocksuite/store';
import { nanoid } from 'nanoid';

interface DatabaseAnalysis {
  blockId: string;
  title: string;
  hasTableId: boolean;
  tableId?: string;
  isIndexed: boolean;
}

interface PageAnalysis {
  id: string;
  title: string;
  databases: DatabaseAnalysis[];
}

interface WorkspaceAnalysis {
  totalPages: number;
  pagesWithDatabases: number;
  totalDatabases: number;
  alreadyIndexed: number;
  needsMigration: number;
  pageAnalysis: PageAnalysis[];
}

/**
 * Migration utility to add tableId to existing database blocks and register them in workspace index
 */
export class WorkspaceTableMigration {
  /**
   * Migrate all existing database blocks in a workspace to have tableId and be indexed
   */
  static async migrateWorkspace(store: Store): Promise<{
    migratedTables: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let migratedTables = 0;

    try {
      console.log('🚀 Starting workspace table migration...');

      // Get detailed analysis of workspace structure
      const analysisResult = this.analyzeWorkspaceStructure(store);

      console.log(`📊 Workspace Analysis:`);
      console.log(`  - Total pages in workspace: ${analysisResult.totalPages}`);
      console.log(
        `  - Pages with databases: ${analysisResult.pagesWithDatabases}`
      );
      console.log(
        `  - Total database blocks found: ${analysisResult.totalDatabases}`
      );
      console.log(
        `  - Already indexed tables: ${analysisResult.alreadyIndexed}`
      );
      console.log(
        `  - Tables needing migration: ${analysisResult.needsMigration}`
      );

      // Log detailed page analysis
      if (analysisResult.pageAnalysis.length > 0) {
        console.log('\n📄 Pages analyzed:');
        analysisResult.pageAnalysis.forEach((page: PageAnalysis) => {
          console.log(`  • Page "${page.title}" (ID: ${page.id})`);
          if (page.databases.length > 0) {
            page.databases.forEach((db: DatabaseAnalysis) => {
              const status = db.hasTableId
                ? db.isIndexed
                  ? '✅ Indexed'
                  : '⚠️ Has tableId but not indexed'
                : '❌ Needs migration';
              console.log(
                `    └─ Table "${db.title}" (ID: ${db.blockId}) - ${status}`
              );
              if (db.hasTableId) {
                console.log(`       TableID: ${db.tableId}`);
              }
            });
          }
        });
      }

      // Perform migration on blocks that need it
      console.log('\n🔧 Starting migration process...');

      const databaseBlocks = this.findAllDatabaseBlocks(store);
      let processedCount = 0;

      for (const block of databaseBlocks) {
        try {
          processedCount++;
          console.log(
            `\n[${processedCount}/${databaseBlocks.length}] Processing block ${block.id}...`
          );

          const migrated = await this.migrateDatabaseBlock(store, block);
          if (migrated) {
            migratedTables++;
            console.log(`  ✅ Successfully migrated`);
          } else {
            console.log(`  ⏭️  Already migrated or up-to-date`);
          }
        } catch (error) {
          const errorMsg = `Failed to migrate block ${block.id}: ${error}`;
          console.error(`  ❌ ${errorMsg}`);
          errors.push(errorMsg);
        }
      }

      // Final statistics
      console.log('\n📈 Migration Summary:');
      console.log(`  ✅ Tables successfully migrated: ${migratedTables}`);
      console.log(`  ❌ Migration errors: ${errors.length}`);
      console.log(
        `  📊 Success rate: ${databaseBlocks.length > 0 ? Math.round(((databaseBlocks.length - errors.length) / databaseBlocks.length) * 100) : 100}%`
      );

      if (errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        errors.forEach((error, index) => {
          console.log(`  ${index + 1}. ${error}`);
        });
      }

      console.log('\n🎉 Workspace table migration completed!');

      return { migratedTables, errors };
    } catch (error) {
      const errorMsg = `Migration failed: ${error}`;
      console.error(`💥 ${errorMsg}`);
      errors.push(errorMsg);
      return { migratedTables, errors };
    }
  }

  /**
   * Run migration with retry mechanism and comprehensive error handling
   */
  static async migrateWorkspaceWithRetry(
    store: Store,
    maxRetries: number = 3
  ): Promise<{
    migratedTables: number;
    errors: string[];
    retryCount: number;
  }> {
    let retryCount = 0;
    let lastErrors: string[] = [];

    while (retryCount < maxRetries) {
      try {
        const result = await this.migrateWorkspace(store);

        // If migration was successful or only had minor errors, return
        if (result.errors.length === 0 || retryCount === maxRetries - 1) {
          return { ...result, retryCount };
        }

        // If there were errors but we have retries left, try again
        console.warn(
          `Migration attempt ${retryCount + 1} had ${result.errors.length} errors, retrying...`
        );
        lastErrors = result.errors;
        retryCount++;

        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      } catch (error) {
        retryCount++;
        const errorMsg = `Migration attempt ${retryCount} failed completely: ${error}`;
        console.error(errorMsg);
        lastErrors = [errorMsg];

        if (retryCount >= maxRetries) {
          break;
        }

        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    return {
      migratedTables: 0,
      errors: lastErrors,
      retryCount,
    };
  }

  /**
   * Find all database blocks in the workspace
   */
  private static findAllDatabaseBlocks(store: Store): DatabaseBlockModel[] {
    // Use getModelsByFlavour to get all database blocks
    const dbBlocks = store.getModelsByFlavour(
      'affine:database'
    ) as DatabaseBlockModel[];
    return dbBlocks;
  }

  /**
   * Analyze workspace structure to provide detailed migration insights
   */
  private static analyzeWorkspaceStructure(store: Store): WorkspaceAnalysis {
    const pageAnalysis: PageAnalysis[] = [];
    let totalDatabases = 0;
    let alreadyIndexed = 0;
    let needsMigration = 0;

    const workspaceMeta = store.workspace?.meta;

    // Get all database blocks directly (more reliable than page traversal)
    const databaseBlocks = this.findAllDatabaseBlocks(store);

    // Group databases by their parent page
    const databasesByPage = new Map<string, DatabaseBlockModel[]>();

    for (const dbBlock of databaseBlocks) {
      const pageId = this.findPageForBlock(store, dbBlock.id);
      if (pageId) {
        if (!databasesByPage.has(pageId)) {
          databasesByPage.set(pageId, []);
        }
        const pageDbBlocks = databasesByPage.get(pageId);
        if (pageDbBlocks) {
          pageDbBlocks.push(dbBlock);
        }
      }
    }

    // Get all pages to have complete page information
    const allPages = store.getModelsByFlavour('affine:page');

    // Analyze each page that contains databases
    for (const [pageId, databases] of databasesByPage.entries()) {
      const page = allPages.find(p => p.id === pageId);
      const pageTitle = this.getPageTitle(page) || `Page ${pageId}`;
      const pageDatabases: DatabaseAnalysis[] = [];

      for (const dbBlock of databases) {
        const dbTitle = dbBlock.props.title?.toString() || 'Untitled Table';
        const hasTableId = Boolean(dbBlock.props.tableId);
        const tableId = dbBlock.props.tableId;
        const isIndexed =
          hasTableId && tableId && workspaceMeta
            ? Boolean(workspaceMeta.getTable(tableId))
            : false;

        pageDatabases.push({
          blockId: dbBlock.id,
          title: dbTitle,
          hasTableId,
          tableId,
          isIndexed,
        });

        totalDatabases++;
        if (isIndexed) {
          alreadyIndexed++;
        } else if (!hasTableId) {
          needsMigration++;
        }
      }

      pageAnalysis.push({
        id: pageId,
        title: pageTitle,
        databases: pageDatabases,
      });
    }

    return {
      totalPages: allPages.length,
      pagesWithDatabases: pageAnalysis.length,
      totalDatabases,
      alreadyIndexed,
      needsMigration,
      pageAnalysis,
    };
  }

  /**
   * Get page title from page model
   */
  private static getPageTitle(page: any): string | null {
    if (!page) return null;

    // Try different ways to get the page title
    if (page.title) {
      return page.title.toString();
    }

    // Look for title in page props or root block
    const root = page.children?.[0];
    if (root?.props?.title) {
      return root.props.title.toString();
    }

    return null;
  }

  /**
   * Migrate a single database block with comprehensive error handling
   */
  private static async migrateDatabaseBlock(
    store: Store,
    block: DatabaseBlockModel
  ): Promise<boolean> {
    try {
      // Check if block already has tableId
      if (block.props.tableId) {
        // Verify the tableId is in the workspace index
        const workspaceMeta = store.workspace?.meta;
        if (workspaceMeta && !workspaceMeta.getTable(block.props.tableId)) {
          console.warn(
            `Block ${block.id} has tableId ${block.props.tableId} but not in index, re-registering`
          );
          await this.registerTableInWorkspaceIndex(
            store,
            block,
            block.props.tableId
          );
        }
        return false; // Already migrated
      }

      // Generate new tableId and ensure uniqueness
      let tableId = nanoid();
      const workspaceMeta = store.workspace?.meta;
      if (workspaceMeta) {
        while (workspaceMeta.getTable(tableId)) {
          tableId = nanoid();
        }
      }

      // Update block with tableId in a transaction
      store.transact(() => {
        block.props.tableId = tableId;
      });

      // Register in workspace index
      await this.registerTableInWorkspaceIndex(store, block, tableId);

      console.log(
        `Successfully migrated block ${block.id} with tableId: ${tableId}`
      );
      return true;
    } catch (error) {
      console.error(`Failed to migrate block ${block.id}:`, error);
      throw error;
    }
  }

  /**
   * Register table in workspace index with proper page resolution
   */
  private static async registerTableInWorkspaceIndex(
    store: Store,
    block: DatabaseBlockModel,
    tableId: string
  ): Promise<void> {
    try {
      const blockId = block.id;
      const title = block.props.title?.toString() || 'Untitled Table';

      // Find the page that contains this block
      const pageId = this.findPageForBlock(store, blockId);

      const workspaceMeta = store.workspace?.meta;
      if (!workspaceMeta) {
        throw new Error('Workspace meta not available');
      }

      // Check if table already exists in index
      const existingTable = workspaceMeta.getTable(tableId);
      if (existingTable) {
        console.log(
          `Table ${tableId} already exists in index, skipping registration`
        );
        return;
      }

      const now = Date.now();
      const tableMeta: TableMeta = {
        id: tableId,
        title,
        pageId,
        blockId,
        usageCount: this.calculateInitialUsageCount(store, block),
        createdAt: now,
        updatedAt: now,
      };

      workspaceMeta.addTable(tableMeta);
      console.log(`Table ${tableId} registered in workspace index`, tableMeta);
    } catch (error) {
      console.error('Failed to register table in workspace index:', error);
      throw error;
    }
  }

  /**
   * Find the page that contains a specific block
   */
  private static findPageForBlock(store: Store, blockId: string): string {
    try {
      const block = store.getBlock(blockId);
      if (!block) return '';

      // Walk up the block tree to find the page
      let currentModel = block.model;
      while (currentModel && currentModel.flavour !== 'affine:page') {
        const parent = store.getParent(currentModel.id);
        if (!parent) break;
        currentModel = parent;
      }

      return currentModel?.id || '';
    } catch {
      return '';
    }
  }

  /**
   * Calculate initial usage count based on existing relations and references
   */
  private static calculateInitialUsageCount(
    _store: Store,
    block: DatabaseBlockModel
  ): number {
    let usageCount = 0;

    try {
      // Count views referencing this table
      usageCount += block.props.views?.length || 0;

      // TODO: Count relation columns pointing to this table
      // This requires analyzing all database blocks for relation columns

      console.log(`Initial usage count for table ${block.id}: ${usageCount}`);
    } catch (error) {
      console.warn(
        `Failed to calculate usage count for block ${block.id}:`,
        error
      );
    }

    // Ensure minimum usage count of 1 for migrated tables
    // since they are being actively used (rendered/migrated)
    return Math.max(usageCount, 1);
  }

  /**
   * Validate migration results
   */
  static validateMigration(store: Store): {
    totalDatabaseBlocks: number;
    blocksWithTableId: number;
    tablesInIndex: number;
    inconsistencies: string[];
  } {
    const inconsistencies: string[] = [];

    // Find all database blocks
    const databaseBlocks = this.findAllDatabaseBlocks(store);
    const totalDatabaseBlocks = databaseBlocks.length;

    // Count blocks with tableId
    const blocksWithTableId = databaseBlocks.filter(
      block => block.props.tableId
    ).length;

    // Get tables from workspace index
    const workspaceMeta = store.workspace?.meta;
    const tablesInIndex = workspaceMeta
      ? Object.keys(workspaceMeta.tables).length
      : 0;

    // Check for inconsistencies
    for (const block of databaseBlocks) {
      if (block.props.tableId) {
        const tableInIndex = workspaceMeta?.getTable(block.props.tableId);
        if (!tableInIndex) {
          inconsistencies.push(
            `Block ${block.id} has tableId ${block.props.tableId} but not found in index`
          );
        } else if (tableInIndex.blockId !== block.id) {
          inconsistencies.push(
            `Block ${block.id} tableId ${block.props.tableId} points to different block in index`
          );
        }
      } else {
        inconsistencies.push(`Block ${block.id} missing tableId`);
      }
    }

    return {
      totalDatabaseBlocks,
      blocksWithTableId,
      tablesInIndex,
      inconsistencies,
    };
  }

  /**
   * Fix inconsistencies found during validation
   */
  static async fixInconsistencies(store: Store): Promise<{
    fixed: number;
    errors: string[];
  }> {
    const validation = this.validateMigration(store);
    const errors: string[] = [];
    let fixed = 0;

    for (const inconsistency of validation.inconsistencies) {
      try {
        if (inconsistency.includes('missing tableId')) {
          const blockId = inconsistency.match(/Block (\w+)/)?.[1];
          if (blockId) {
            const block = store.getBlock(blockId)?.model as DatabaseBlockModel;
            if (block) {
              await this.migrateDatabaseBlock(store, block);
              fixed++;
            }
          }
        } else if (inconsistency.includes('not found in index')) {
          const matches = inconsistency.match(/Block (\w+) has tableId (\w+)/);
          if (matches) {
            const [, blockId, tableId] = matches;
            const block = store.getBlock(blockId)?.model as DatabaseBlockModel;
            if (block) {
              await this.registerTableInWorkspaceIndex(store, block, tableId);
              fixed++;
            }
          }
        }
      } catch (error) {
        const errorMsg = `Failed to fix inconsistency: ${inconsistency} - ${error}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    return { fixed, errors };
  }

  /**
   * Check if workspace needs migration
   */
  static needsMigration(store: Store): boolean {
    const databaseBlocks = this.findAllDatabaseBlocks(store);
    return databaseBlocks.some(block => !block.props.tableId);
  }

  /**
   * Get migration status summary
   */
  static getMigrationStatus(store: Store): {
    needsMigration: boolean;
    summary: string;
    details: {
      totalBlocks: number;
      migratedBlocks: number;
      pendingBlocks: number;
    };
  } {
    const databaseBlocks = this.findAllDatabaseBlocks(store);
    const totalBlocks = databaseBlocks.length;
    const migratedBlocks = databaseBlocks.filter(
      block => block.props.tableId
    ).length;
    const pendingBlocks = totalBlocks - migratedBlocks;
    const needsMigration = pendingBlocks > 0;

    const summary = needsMigration
      ? `Migration needed: ${pendingBlocks} of ${totalBlocks} database blocks need tableId`
      : `Migration complete: All ${totalBlocks} database blocks have tableId`;

    return {
      needsMigration,
      summary,
      details: {
        totalBlocks,
        migratedBlocks,
        pendingBlocks,
      },
    };
  }
}
