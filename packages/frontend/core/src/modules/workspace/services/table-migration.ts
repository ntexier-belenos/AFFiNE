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

      // Get all docs in the workspace
      const docs = docCollection?.docs || new Map();

      for (const [docId, doc] of docs) {
        try {
          await this.migrateDocTables(doc as Doc, docId, result);
        } catch (error) {
          const errorMsg = `Failed to migrate doc ${docId}: ${error}`;
          console.error(errorMsg);
          result.errors.push(errorMsg);
        }
      }

      console.log(`Table migration completed:`, result);
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
    doc: any,
    docId: string,
    result: { migrated: number; skipped: number; errors: string[] }
  ): Promise<void> {
    // Get all blocks in the doc
    const blocks = doc.blocks || [];

    for (const block of blocks) {
      if (block.flavour === 'affine:database') {
        if (!block.props.tableId) {
          try {
            const tableId = nanoid();
            block.props.tableId = tableId;
            this.tableIndexService.registerTable(
              docId,
              block.id,
              block.props.title?.toString() || 'Untitled Table'
            );
            result.migrated++;
          } catch (error) {
            const errorMsg = `Failed to migrate block ${block.id} in doc ${docId}: ${error}`;
            console.error(errorMsg);
            result.errors.push(errorMsg);
          }
        } else {
          result.skipped++;
        }
      }
    }
  }

  /**
   * Find all database blocks in a document
   */
  private findDatabaseBlocks(doc: Doc): DatabaseBlockModel[] {
    const databaseBlocks: DatabaseBlockModel[] = [];

    // Walk through all blocks in the document
    const walkBlocks = (blockId: string) => {
      // Use doc.getBlockRaw to get block since getBlock does not exist
      const block = (doc as any).getBlockRaw(blockId);
      if (!block) return;

      // Check if this is a database block
      if (block.model.flavour === 'affine:database') {
        databaseBlocks.push(block.model as DatabaseBlockModel);
      }

      // Recursively check children
      for (const childId of block.model.children) {
        walkBlocks(childId);
      }
    };

    // Start from root block
    if ((doc as any).root) {
      walkBlocks((doc as any).root.id);
    }

    return databaseBlocks;
  }

  /**
   * Check if migration is needed for the workspace
   */
  async needsMigration(): Promise<boolean> {
    try {
      const workspace = this.workspaceService.workspace;
      const docCollection = workspace.docCollection;
      const docs = docCollection?.docs || new Map();

      for (const [, doc] of docs) {
        const databaseBlocks = this.findDatabaseBlocks(doc as Doc);

        // Check if any database block lacks tableId
        for (const block of databaseBlocks) {
          if (!(block as any).tableId) {
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.error('Failed to check migration status:', error);
      return true; // Better to migrate when in doubt
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
      const docs = docCollection?.docs || new Map();

      for (const [, doc] of docs) {
        const databaseBlocks = this.findDatabaseBlocks(doc as Doc);
        info.totalDatabaseBlocks += databaseBlocks.length;

        for (const block of databaseBlocks) {
          if ((block as any).tableId) {
            info.blocksWithTableId++;

            // Check if registered in index
            const existingTable = this.tableIndexService.getTable(
              (block as any).tableId
            );
            if (existingTable) {
              info.registeredInIndex++;
            }
          } else {
            info.blocksNeedingMigration++;
          }
        }
      }

      return info;
    } catch (error) {
      console.error('Failed to get migration info:', error);
      return info;
    }
  }
}
