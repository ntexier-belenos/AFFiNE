import type { TableMeta } from '@blocksuite/store';
import { describe, expect, it } from 'vitest';

import {
  createTableMeta,
  filterTablesByQuery,
  formatTableDate,
  generateTableId,
  getTableAge,
  getTableUsageStatus,
  sortTables,
  validateTableMeta,
} from '../table-utils';

describe('table-utils', () => {
  describe('generateTableId', () => {
    it('should generate unique IDs', () => {
      const id1 = generateTableId();
      const id2 = generateTableId();

      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^table_\d+_[a-z0-9]+$/);
      expect(id2).toMatch(/^table_\d+_[a-z0-9]+$/);
    });
  });

  describe('validateTableMeta', () => {
    const validTable: TableMeta = {
      id: 'table-1',
      pageId: 'page-1',
      blockId: 'block-1',
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    it('should validate complete table meta', () => {
      expect(validateTableMeta(validTable)).toBe(true);
    });

    it('should reject incomplete table meta', () => {
      expect(validateTableMeta({})).toBe(false);
      expect(validateTableMeta({ id: 'table-1' })).toBe(false);
      expect(validateTableMeta({ ...validTable, id: undefined })).toBe(false);
    });
  });

  describe('createTableMeta', () => {
    it('should create valid table meta', () => {
      const pageId = 'page-1';
      const blockId = 'block-1';

      const tableMeta = createTableMeta(pageId, blockId);

      expect(tableMeta.pageId).toBe(pageId);
      expect(tableMeta.blockId).toBe(blockId);
      expect(tableMeta.usageCount).toBe(0);
      expect(tableMeta.id).toMatch(/^table_\d+_[a-z0-9]+$/);
      expect(tableMeta.createdAt).toBeCloseTo(Date.now(), -2);
      expect(tableMeta.updatedAt).toBe(tableMeta.createdAt);
    });

    it('should accept custom table ID', () => {
      const customId = 'custom-table-id';
      const tableMeta = createTableMeta('page-1', 'block-1', customId);

      expect(tableMeta.id).toBe(customId);
    });
  });

  describe('sortTables', () => {
    const baseTimestamp = Date.now();
    const tables: TableMeta[] = [
      {
        id: 'table-1',
        pageId: 'page-1',
        blockId: 'block-1',
        usageCount: 5,
        createdAt: baseTimestamp + 3000,
        updatedAt: baseTimestamp + 4000,
      },
      {
        id: 'table-2',
        pageId: 'page-2',
        blockId: 'block-2',
        usageCount: 1,
        createdAt: baseTimestamp + 1000,
        updatedAt: baseTimestamp + 2000,
      },
      {
        id: 'table-3',
        pageId: 'page-3',
        blockId: 'block-3',
        usageCount: 10,
        createdAt: baseTimestamp + 2000,
        updatedAt: baseTimestamp + 3000,
      },
    ];

    it('should sort by creation date (default)', () => {
      const sorted = sortTables(tables);
      expect(sorted.map(t => t.id)).toEqual(['table-2', 'table-3', 'table-1']);
    });

    it('should sort by creation date descending', () => {
      const sorted = sortTables(tables, 'createdAt', 'desc');
      expect(sorted.map(t => t.id)).toEqual(['table-1', 'table-3', 'table-2']);
    });

    it('should sort by usage count', () => {
      const sorted = sortTables(tables, 'usageCount');
      expect(sorted.map(t => t.id)).toEqual(['table-2', 'table-1', 'table-3']);
    });

    it('should sort by updated date', () => {
      const sorted = sortTables(tables, 'updatedAt');
      expect(sorted.map(t => t.id)).toEqual(['table-2', 'table-3', 'table-1']);
    });
  });

  describe('filterTablesByQuery', () => {
    const tables: TableMeta[] = [
      {
        id: 'user-management-table',
        pageId: 'page-1',
        blockId: 'block-1',
        usageCount: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'product-catalog-table',
        pageId: 'page-2',
        blockId: 'block-2',
        usageCount: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'order-history-table',
        pageId: 'page-3',
        blockId: 'block-3',
        usageCount: 2,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    it('should return all tables for empty query', () => {
      const result = filterTablesByQuery(tables, '');
      expect(result).toHaveLength(3);
    });

    it('should filter by table ID', () => {
      const result = filterTablesByQuery(tables, 'user');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-management-table');
    });

    it('should be case insensitive', () => {
      const result = filterTablesByQuery(tables, 'USER');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-management-table');
    });

    it('should filter by partial ID match', () => {
      const result = filterTablesByQuery(tables, 'table');
      expect(result).toHaveLength(3);
    });
  });

  describe('getTableUsageStatus', () => {
    it('should indicate table can be deleted when usage is 0', () => {
      const table: TableMeta = {
        id: 'table-1',
        pageId: 'page-1',
        blockId: 'block-1',
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const status = getTableUsageStatus(table);
      expect(status.canDelete).toBe(true);
      expect(status.hasRelations).toBe(false);
      expect(status.relationCount).toBe(0);
    });

    it('should indicate table cannot be deleted when usage > 0', () => {
      const table: TableMeta = {
        id: 'table-1',
        pageId: 'page-1',
        blockId: 'block-1',
        usageCount: 3,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      const status = getTableUsageStatus(table);
      expect(status.canDelete).toBe(false);
      expect(status.hasRelations).toBe(true);
      expect(status.relationCount).toBe(3);
    });
  });

  describe('formatTableDate', () => {
    it('should format timestamp as date string', () => {
      const timestamp = new Date('2023-12-25').getTime();
      const formatted = formatTableDate(timestamp);
      expect(formatted).toMatch(/12\/25\/2023|25\/12\/2023|2023-12-25/);
    });
  });

  describe('getTableAge', () => {
    it('should calculate table age in days', () => {
      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const age = getTableAge(oneDayAgo);
      expect(age).toBe(1);
    });

    it('should return 0 for tables created today', () => {
      const now = Date.now();
      const age = getTableAge(now);
      expect(age).toBe(0);
    });
  });
});
