import type { TableMeta } from '@blocksuite/store';
import { describe, expect, it } from 'vitest';

import {
  createTableMeta,
  filterTablesByQuery,
  formatTableDate,
  generateTableId,
  getTableAge,
  getTableUsageStatus,
  isValidTableTitle,
  sanitizeTableTitle,
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
      title: 'Test Table',
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
      expect(validateTableMeta({ ...validTable, title: undefined })).toBe(
        false
      );
    });
  });

  describe('createTableMeta', () => {
    it('should create valid table meta', () => {
      const pageId = 'page-1';
      const blockId = 'block-1';
      const title = 'Test Table';

      const tableMeta = createTableMeta(pageId, blockId, title);

      expect(tableMeta.pageId).toBe(pageId);
      expect(tableMeta.blockId).toBe(blockId);
      expect(tableMeta.title).toBe(title);
      expect(tableMeta.usageCount).toBe(0);
      expect(tableMeta.id).toMatch(/^table_\d+_[a-z0-9]+$/);
      expect(tableMeta.createdAt).toBeCloseTo(Date.now(), -2);
      expect(tableMeta.updatedAt).toBe(tableMeta.createdAt);
    });

    it('should use provided table ID', () => {
      const customId = 'custom-table-id';
      const tableMeta = createTableMeta('page-1', 'block-1', 'Test', customId);

      expect(tableMeta.id).toBe(customId);
    });

    it('should handle empty title', () => {
      const tableMeta = createTableMeta('page-1', 'block-1', '');
      expect(tableMeta.title).toBe('Untitled Table');
    });
  });

  describe('isValidTableTitle', () => {
    it('should validate normal titles', () => {
      expect(isValidTableTitle('Valid Title')).toBe(true);
      expect(isValidTableTitle('A')).toBe(true);
    });

    it('should reject empty or whitespace titles', () => {
      expect(isValidTableTitle('')).toBe(false);
      expect(isValidTableTitle('   ')).toBe(false);
      expect(isValidTableTitle('\t\n')).toBe(false);
    });

    it('should reject overly long titles', () => {
      const longTitle = 'A'.repeat(256);
      expect(isValidTableTitle(longTitle)).toBe(false);
    });
  });

  describe('sanitizeTableTitle', () => {
    it('should trim whitespace', () => {
      expect(sanitizeTableTitle('  Title  ')).toBe('Title');
    });

    it('should truncate long titles', () => {
      const longTitle = 'A'.repeat(300);
      const sanitized = sanitizeTableTitle(longTitle);
      expect(sanitized).toHaveLength(255);
      expect(sanitized).toBe('A'.repeat(255));
    });

    it('should provide default for empty titles', () => {
      expect(sanitizeTableTitle('')).toBe('Untitled Table');
      expect(sanitizeTableTitle('   ')).toBe('Untitled Table');
    });
  });

  describe('sortTables', () => {
    const createTestTable = (overrides: Partial<TableMeta>): TableMeta => ({
      id: 'table-1',
      title: 'Table A',
      pageId: 'page-1',
      blockId: 'block-1',
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      ...overrides,
    });

    const tables: TableMeta[] = [
      createTestTable({
        id: 'table-1',
        title: 'Zebra',
        createdAt: 1000,
        usageCount: 3,
      }),
      createTestTable({
        id: 'table-2',
        title: 'Alpha',
        createdAt: 3000,
        usageCount: 1,
      }),
      createTestTable({
        id: 'table-3',
        title: 'Beta',
        createdAt: 2000,
        usageCount: 2,
      }),
    ];

    it('should sort by title ascending (default)', () => {
      const sorted = sortTables(tables);
      expect(sorted.map(t => t.title)).toEqual(['Alpha', 'Beta', 'Zebra']);
    });

    it('should sort by title descending', () => {
      const sorted = sortTables(tables, 'title', 'desc');
      expect(sorted.map(t => t.title)).toEqual(['Zebra', 'Beta', 'Alpha']);
    });

    it('should sort by creation date', () => {
      const sorted = sortTables(tables, 'createdAt');
      expect(sorted.map(t => t.id)).toEqual(['table-1', 'table-3', 'table-2']);
    });

    it('should sort by usage count', () => {
      const sorted = sortTables(tables, 'usageCount');
      expect(sorted.map(t => t.usageCount)).toEqual([1, 2, 3]);
    });

    it('should not mutate original array', () => {
      const original = [...tables];
      sortTables(tables);
      expect(tables).toEqual(original);
    });
  });

  describe('filterTablesByQuery', () => {
    const tables: TableMeta[] = [
      {
        id: 'table-abc',
        title: 'User Management',
        pageId: 'page-1',
        blockId: 'block-1',
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'table-def',
        title: 'Product Catalog',
        pageId: 'page-2',
        blockId: 'block-2',
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'table-xyz',
        title: 'Order History',
        pageId: 'page-3',
        blockId: 'block-3',
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    it('should return all tables for empty query', () => {
      expect(filterTablesByQuery(tables, '')).toEqual(tables);
      expect(filterTablesByQuery(tables, '   ')).toEqual(tables);
    });

    it('should filter by title', () => {
      const result = filterTablesByQuery(tables, 'user');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('User Management');
    });

    it('should filter by ID', () => {
      const result = filterTablesByQuery(tables, 'abc');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('table-abc');
    });

    it('should be case insensitive', () => {
      const result = filterTablesByQuery(tables, 'USER');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('User Management');
    });

    it('should match partial strings', () => {
      const result = filterTablesByQuery(tables, 'cat');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Product Catalog');
    });
  });

  describe('getTableUsageStatus', () => {
    it('should indicate deletable table', () => {
      const table: TableMeta = {
        id: 'table-1',
        title: 'Test Table',
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

    it('should indicate non-deletable table', () => {
      const table: TableMeta = {
        id: 'table-1',
        title: 'Test Table',
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
    it('should format timestamp to date string', () => {
      const timestamp = new Date('2024-01-15').getTime();
      const formatted = formatTableDate(timestamp);

      // The exact format depends on locale, but it should contain the date
      expect(formatted).toContain('2024');
      expect(formatted).toMatch(/\d+\/\d+\/\d+/);
    });
  });

  describe('getTableAge', () => {
    it('should calculate age in days', () => {
      const now = Date.now();
      const threeDaysAgo = now - 3 * 24 * 60 * 60 * 1000;

      const age = getTableAge(threeDaysAgo);
      expect(age).toBe(3);
    });

    it('should return 0 for recent tables', () => {
      const now = Date.now();
      const oneHourAgo = now - 60 * 60 * 1000;

      const age = getTableAge(oneHourAgo);
      expect(age).toBe(0);
    });
  });
});
