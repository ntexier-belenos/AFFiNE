import type { TableMeta } from '@blocksuite/store';

/**
 * Generate a unique table identifier
 */
export function generateTableId(): string {
  return `table_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Validate table metadata
 */
export function validateTableMeta(table: Partial<TableMeta>): boolean {
  return !!(
    table.id &&
    table.pageId &&
    table.blockId &&
    typeof table.usageCount === 'number' &&
    typeof table.createdAt === 'number'
  );
}

/**
 * Create table metadata object
 */
export function createTableMeta(
  pageId: string,
  blockId: string,
  tableId?: string
): TableMeta {
  const now = Date.now();

  return {
    id: tableId || generateTableId(),
    pageId,
    blockId,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Sort tables by various criteria
 */
export function sortTables(
  tables: TableMeta[],
  sortBy: 'createdAt' | 'updatedAt' | 'usageCount' = 'createdAt',
  direction: 'asc' | 'desc' = 'asc'
): TableMeta[] {
  return [...tables].sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'createdAt':
        comparison = a.createdAt - b.createdAt;
        break;
      case 'updatedAt':
        comparison =
          (a.updatedAt || a.createdAt) - (b.updatedAt || b.createdAt);
        break;
      case 'usageCount':
        comparison = a.usageCount - b.usageCount;
        break;
    }

    return direction === 'desc' ? -comparison : comparison;
  });
}

/**
 * Filter tables by search query
 */
export function filterTablesByQuery(
  tables: TableMeta[],
  query: string
): TableMeta[] {
  if (!query.trim()) {
    return tables;
  }

  const lowercaseQuery = query.toLowerCase().trim();

  return tables.filter(table =>
    table.id.toLowerCase().includes(lowercaseQuery)
  );
}

/**
 * Get table usage status
 */
export function getTableUsageStatus(table: TableMeta): {
  canDelete: boolean;
  hasRelations: boolean;
  relationCount: number;
} {
  return {
    canDelete: table.usageCount === 0,
    hasRelations: table.usageCount > 0,
    relationCount: table.usageCount,
  };
}

/**
 * Format table creation/update date
 */
export function formatTableDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get table age in days
 */
export function getTableAge(createdAt: number): number {
  const now = Date.now();
  const ageMs = now - createdAt;
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
}
