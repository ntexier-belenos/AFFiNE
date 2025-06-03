import type { TableMeta } from '@blocksuite/store';

/**
 * Migration utilities for table indexing system
 */

/**
 * Check if a table metadata is valid
 */
export function validateMigrationTableMeta(
  table: Partial<TableMeta>
): table is TableMeta {
  return !!(
    table &&
    typeof table.id === 'string' &&
    typeof table.title === 'string' &&
    typeof table.pageId === 'string' &&
    typeof table.blockId === 'string' &&
    typeof table.usageCount === 'number' &&
    typeof table.createdAt === 'number' &&
    typeof table.updatedAt === 'number'
  );
}

/**
 * Create default table metadata for migration
 */
export function createMigrationTableMeta(
  tableId: string,
  title: string,
  pageId: string,
  blockId: string
): TableMeta {
  const now = Date.now();
  return {
    id: tableId,
    title: title || 'Untitled Table',
    pageId,
    blockId,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Migration status types
 */
export type MigrationStatus =
  | 'not-needed'
  | 'needed'
  | 'in-progress'
  | 'completed'
  | 'failed';

export interface MigrationResult {
  status: MigrationStatus;
  migrated: number;
  skipped: number;
  errors: string[];
  duration?: number;
}

export interface MigrationInfo {
  totalDatabaseBlocks: number;
  blocksWithTableId: number;
  blocksNeedingMigration: number;
  registeredInIndex: number;
}

/**
 * Format migration result for display
 */
export function formatMigrationResult(result: MigrationResult): string {
  const { status, migrated, skipped, errors, duration } = result;

  let message = `Migration ${status}:\n`;
  message += `- Migrated: ${migrated} tables\n`;
  message += `- Skipped: ${skipped} tables\n`;

  if (errors.length > 0) {
    message += `- Errors: ${errors.length}\n`;
    message += errors.map(err => `  • ${err}`).join('\n') + '\n';
  }

  if (duration) {
    message += `- Duration: ${duration}ms`;
  }

  return message;
}

/**
 * Format migration info for display
 */
export function formatMigrationInfo(info: MigrationInfo): string {
  const {
    totalDatabaseBlocks,
    blocksWithTableId,
    blocksNeedingMigration,
    registeredInIndex,
  } = info;

  let message = `Migration Status:\n`;
  message += `- Total database blocks: ${totalDatabaseBlocks}\n`;
  message += `- Blocks with tableId: ${blocksWithTableId}\n`;
  message += `- Blocks needing migration: ${blocksNeedingMigration}\n`;
  message += `- Registered in index: ${registeredInIndex}`;

  return message;
}

/**
 * Check if migration is recommended
 */
export function shouldRunMigration(info: MigrationInfo): boolean {
  return (
    info.blocksNeedingMigration > 0 ||
    info.blocksWithTableId > info.registeredInIndex
  );
}

/**
 * Calculate migration completion percentage
 */
export function getMigrationProgress(info: MigrationInfo): number {
  if (info.totalDatabaseBlocks === 0) return 100;

  const completed = info.registeredInIndex;
  const total = info.totalDatabaseBlocks;

  return Math.round((completed / total) * 100);
}

/**
 * Batch processing utilities for large migrations
 */
export const MIGRATION_BATCH_SIZE = 50;

export function createMigrationBatches<T>(
  items: T[],
  batchSize: number = MIGRATION_BATCH_SIZE
): T[][] {
  const batches: T[][] = [];

  for (let i = 0; i < items.length; i += batchSize) {
    batches.push(items.slice(i, i + batchSize));
  }

  return batches;
}

/**
 * Delay utility for batch processing
 */
export function migrationDelay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
