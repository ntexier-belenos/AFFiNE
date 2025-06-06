import type { TableMeta, WorkspaceMeta } from '@blocksuite/store';
import { Service } from '@toeverything/infra';
import { nanoid } from 'nanoid';

import type { WorkspaceService } from './workspace';

export class TableIndexService extends Service {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  /**
   * Get all tables in the workspace
   */
  getAllTables(): TableMeta[] {
    const meta = this.getWorkspaceMeta();
    return Object.values(meta.tables);
  }

  /**
   * Get a specific table by ID
   */
  getTable(tableId: string): TableMeta | undefined {
    const meta = this.getWorkspaceMeta();
    return meta.getTable(tableId);
  }

  /**
   * Register a new table in the workspace index
   */
  registerTable(
    pageId: string,
    blockId: string,
    tableId?: string,
    initialUsageCount: number = 0
  ): string {
    const finalTableId = tableId || nanoid();
    const now = Date.now();

    const tableMeta: TableMeta = {
      id: finalTableId,
      pageId,
      blockId,
      usageCount: initialUsageCount,
      createdAt: now,
      updatedAt: now,
    };

    const meta = this.getWorkspaceMeta();
    meta.addTable(tableMeta);

    return finalTableId;
  }

  /**
   * Update table metadata
   */
  updateTable(tableId: string, updates: Partial<Omit<TableMeta, 'id'>>): void {
    const meta = this.getWorkspaceMeta();
    const currentTable = meta.getTable(tableId);

    if (!currentTable) {
      throw new Error(`Table with ID ${tableId} not found`);
    }

    meta.updateTable(tableId, {
      ...updates,
      updatedAt: Date.now(),
    });
  }

  /**
   * Remove a table from the index
   * Only allows removal if usage count is 0
   */
  removeTable(tableId: string): boolean {
    const meta = this.getWorkspaceMeta();
    const table = meta.getTable(tableId);

    if (!table) {
      return false;
    }

    if (table.usageCount > 0) {
      throw new Error(
        `Cannot delete table ${tableId}. It is being used in ${table.usageCount} relation(s).`
      );
    }

    meta.removeTable(tableId);
    return true;
  }

  /**
   * Increment usage count for a table
   */
  incrementUsage(tableId: string): void {
    const meta = this.getWorkspaceMeta();
    meta.incrementTableUsage(tableId);
  }

  /**
   * Decrement usage count for a table
   */
  decrementUsage(tableId: string): void {
    const meta = this.getWorkspaceMeta();
    meta.decrementTableUsage(tableId);
  }

  /**
   * Get tables available for relations (excluding the current table)
   */
  getAvailableTablesForRelations(excludeTableId?: string): TableMeta[] {
    return this.getAllTables().filter(table => table.id !== excludeTableId);
  }

  /**
   * Find table by page and block ID
   */
  findTableByBlock(pageId: string, blockId: string): TableMeta | undefined {
    return this.getAllTables().find(
      table => table.pageId === pageId && table.blockId === blockId
    );
  }

  /**
   * Check if a table can be safely deleted
   */
  canDeleteTable(tableId: string): boolean {
    const table = this.getTable(tableId);
    return table ? table.usageCount === 0 : false;
  }

  /**
   * Get tables that are being used in relations
   */
  getTablesInUse(): TableMeta[] {
    return this.getAllTables().filter(table => table.usageCount > 0);
  }

  /**
   * Reset all tables in the workspace index
   * WARNING: This will clear all registered tables. Use with caution.
   */
  resetAllTables(): void {
    const meta = this.getWorkspaceMeta();

    // Get all current tables to trigger removal events
    const currentTables = Object.values(meta.tables);

    // Trigger removal events for each table individually
    currentTables.forEach(table => {
      meta.removeTable(table.id);
    });

    console.log('Table index has been reset - all tables cleared');
  }

  /**
   * Get workspace meta for external observation
   */
  getWorkspaceMetaForObservation(): WorkspaceMeta | null {
    try {
      return this.getWorkspaceMeta();
    } catch {
      return null;
    }
  }

  /**
   * Get workspace meta with error handling
   */
  private getWorkspaceMeta(): WorkspaceMeta {
    const meta = this.workspaceService.workspace?.docCollection?.meta;
    if (!meta) {
      throw new Error(
        'Workspace meta not available. Make sure workspace is properly initialized.'
      );
    }
    return meta;
  }
}
