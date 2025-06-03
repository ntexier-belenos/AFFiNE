import type { TableMeta } from '@blocksuite/store';
import { Service } from '@toeverything/infra';

import type { TableIndexService } from './table-index';
import type { TableObserverService } from './table-observer';
import type { WorkspaceService } from './workspace';

/**
 * Public API for table management across the workspace
 * This service provides a high-level interface for table operations
 */
export class WorkspaceTablesService extends Service {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly tableIndexService: TableIndexService,
    private readonly tableObserverService: TableObserverService
  ) {
    super();
  }

  /**
   * Initialize table management for the workspace
   */
  async initialize(): Promise<void> {
    // TODO: Re-enable automatic table observation when we have proper Store access
    // Current issue: TableObserver needs a Store but we only have Workspace access
    const workspace = this.workspaceService.workspace;
    if (workspace?.docCollection) {
      // this.tableObserverService.startObserving(workspace.docCollection);
      console.log(
        `WorkspaceTablesService initialized for workspace: ${workspace.id}`
      );
    } else {
      console.log(
        'WorkspaceTablesService initialized (no workspace available)'
      );
    }
  }

  /**
   * Cleanup table management
   */
  override dispose(): void {
    this.tableObserverService.stopObserving();
  }

  /**
   * Get all tables in the workspace
   */
  getAllTables(): TableMeta[] {
    return this.tableIndexService.getAllTables();
  }

  /**
   * Get tables available for creating relations (excludes specified table)
   */
  getAvailableTablesForRelations(excludeTableId?: string): TableMeta[] {
    return this.tableIndexService.getAvailableTablesForRelations(
      excludeTableId
    );
  }

  /**
   * Get a specific table by ID
   */
  getTable(tableId: string): TableMeta | undefined {
    return this.tableIndexService.getTable(tableId);
  }

  /**
   * Find table by page and block ID
   */
  findTableByBlock(pageId: string, blockId: string): TableMeta | undefined {
    return this.tableIndexService.findTableByBlock(pageId, blockId);
  }

  /**
   * Update table metadata
   */
  updateTable(tableId: string, updates: Partial<TableMeta>): void {
    this.tableIndexService.updateTable(tableId, updates);
  }

  /**
   * Check if a table can be safely deleted
   */
  canDeleteTable(tableId: string): boolean {
    return this.tableIndexService.canDeleteTable(tableId);
  }

  /**
   * Get tables that reference the specified table
   */
  getTableDependencies(_tableId: string): TableMeta[] {
    // TODO: Implement when relation system is added
    // This will return tables that have relations pointing to the specified table
    return [];
  }

  /**
   * Increment usage count when a table is referenced
   */
  incrementTableUsage(tableId: string): void {
    this.tableIndexService.incrementUsage(tableId);
  }

  /**
   * Decrement usage count when a table reference is removed
   */
  decrementTableUsage(tableId: string): void {
    this.tableIndexService.decrementUsage(tableId);
  }

  /**
   * Attempt to delete a table (will fail if usage count > 0)
   */
  deleteTable(tableId: string): boolean {
    return this.tableIndexService.removeTable(tableId);
  }

  /**
   * Get table statistics
   */
  getTableStats(): {
    totalTables: number;
    tablesWithReferences: number;
    averageUsageCount: number;
  } {
    const tables = this.getAllTables();
    const totalTables = tables.length;
    const tablesWithReferences = tables.filter(t => t.usageCount > 0).length;
    const averageUsageCount =
      totalTables > 0
        ? tables.reduce((sum, t) => sum + t.usageCount, 0) / totalTables
        : 0;

    return {
      totalTables,
      tablesWithReferences,
      averageUsageCount: Math.round(averageUsageCount * 100) / 100,
    };
  }

  /**
   * Search tables by title or ID
   */
  searchTables(query: string): TableMeta[] {
    if (!query.trim()) {
      return this.getAllTables();
    }

    const tables = this.getAllTables();
    const lowercaseQuery = query.toLowerCase();

    return tables.filter(
      table =>
        table.title.toLowerCase().includes(lowercaseQuery) ||
        table.id.toLowerCase().includes(lowercaseQuery)
    );
  }

  /**
   * Register a new table in the index
   * This is typically called automatically by the block creation commands
   */
  registerTable(pageId: string, blockId: string, title: string): string {
    return this.tableIndexService.registerTable(pageId, blockId, title);
  }
}
