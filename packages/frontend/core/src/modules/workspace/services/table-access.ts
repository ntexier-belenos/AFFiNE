import { Service } from '@toeverything/infra';

import type { TableIndexService } from './table-index';

export class TableAccessService extends Service {
  constructor(private readonly tableIndexService: TableIndexService) {
    super();
  }

  /**
   * Get all tables in the current workspace
   */
  getAllTables() {
    return this.tableIndexService.getAllTables();
  }

  /**
   * Get a specific table by ID
   */
  getTable(tableId: string) {
    return this.tableIndexService.getTable(tableId);
  }

  /**
   * Check if a table can be deleted (usageCount === 0)
   */
  canDeleteTable(tableId: string): boolean {
    return this.tableIndexService.canDeleteTable(tableId);
  }

  /**
   * Get all tables currently referenced in relations (usageCount > 0)
   */
  getTablesInUse() {
    return this.tableIndexService.getTablesInUse();
  }

  /**
   * Get available tables for relations (excluding the given table)
   */
  getAvailableTablesForRelations(excludeTableId?: string) {
    return this.tableIndexService.getAvailableTablesForRelations(
      excludeTableId
    );
  }

  /**
   * Increment usage count for a table
   */
  incrementTableUsage(tableId: string) {
    this.tableIndexService.incrementUsage(tableId);
  }

  /**
   * Decrement usage count for a table
   */
  decrementTableUsage(tableId: string) {
    this.tableIndexService.decrementUsage(tableId);
  }

  /**
   * Attempt to delete a table (will throw if usageCount > 0)
   */
  deleteTable(tableId: string): boolean {
    return this.tableIndexService.removeTable(tableId);
  }

  /**
   * Find a table by page and block ID
   */
  findTableByBlock(pageId: string, blockId: string) {
    return this.tableIndexService.findTableByBlock(pageId, blockId);
  }

  /**
   * Search tables by title or ID
   */
  searchTables(query: string) {
    const tables = this.getAllTables();
    if (!query.trim()) return tables;
    const q = query.toLowerCase();
    return tables.filter(
      table =>
        table.title.toLowerCase().includes(q) ||
        table.id.toLowerCase().includes(q)
    );
  }

  /**
   * Get table statistics (total, referenced, average usage)
   */
  getTableStats() {
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
   * Reset all tables in the workspace index
   * WARNING: This will clear all registered tables. Use with caution.
   */
  resetAllTables(): void {
    this.tableIndexService.resetAllTables();
  }
}
