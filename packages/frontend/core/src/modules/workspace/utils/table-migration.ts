import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { Store, TableMeta } from '@blocksuite/store';
import { nanoid } from 'nanoid';

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
      console.log('Starting workspace table migration...');

      // Find all database blocks in the workspace
      const databaseBlocks = this.findAllDatabaseBlocks(store);

      console.log(`Found ${databaseBlocks.length} database blocks to migrate`);

      for (const block of databaseBlocks) {
        try {
          const migrated = await this.migrateDatabaseBlock(store, block);
          if (migrated) {
            migratedTables++;
          }
        } catch (error) {
          const errorMsg = `Failed to migrate block ${block.id}: ${error}`;
          console.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      console.log(
        `Migration completed: ${migratedTables} tables migrated, ${errors.length} errors`
      );

      return { migratedTables, errors };
    } catch (error) {
      const errorMsg = `Migration failed: ${error}`;
      console.error(errorMsg);
      errors.push(errorMsg);
      return { migratedTables, errors };
    }
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
   * Migrate a single database block
   */
  private static async migrateDatabaseBlock(
    store: Store,
    block: DatabaseBlockModel
  ): Promise<boolean> {
    // Check if block already has tableId
    if (block.props.tableId) {
      console.log(
        `Block ${block.id} already has tableId: ${block.props.tableId}`
      );
      return false; // Already migrated
    }

    // Generate new tableId
    const tableId = nanoid();
    // Update block with tableId
    store.updateBlock(block, { tableId });
    // Register in workspace index
    await this.registerTableInWorkspaceIndex(store, block, tableId);
    console.log(`Migrated block ${block.id} with tableId: ${tableId}`);
    return true;
  }

  /**
   * Register table in workspace index (similar to the function in commands.ts)
   */
  private static async registerTableInWorkspaceIndex(
    store: Store,
    block: DatabaseBlockModel,
    tableId: string
  ): Promise<void> {
    try {
      // Get page information
      // PageId must be passed or resolved from context; fallback to empty string
      const pageId = '';
      const blockId = block.id;
      // Get table title from block props
      const title = block.props.title?.toString() || 'Untitled Table';

      // Get workspace meta
      const workspaceMeta = store.workspace?.meta;
      if (!workspaceMeta) {
        throw new Error('Workspace meta not available');
      }
      // Create table metadata
      const now = Date.now();
      const tableMeta: TableMeta = {
        id: tableId,
        title,
        pageId,
        blockId,
        usageCount: 0, // Migration starts with 0 usage
        createdAt: now,
        updatedAt: now,
      };
      // Register in workspace index
      workspaceMeta.addTable(tableMeta);
      console.log(
        `Table ${tableId} registered in workspace index during migration`,
        {
          title,
          pageId,
          blockId,
        }
      );
    } catch (error) {
      console.error(
        'Failed to register table in workspace index during migration:',
        error
      );
      throw error;
    }
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
