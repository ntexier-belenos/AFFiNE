import type { TableMeta, WorkspaceMeta } from '@blocksuite/store';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TableIndexService } from '../table-index';
import type { WorkspaceService } from '../workspace';

// Mock WorkspaceService and WorkspaceMeta
const createMockWorkspaceMeta = (): WorkspaceMeta => {
  const tables: Record<string, TableMeta> = {};
  const mockMeta = {
    tables,
    setTables: vi.fn((newTables: Record<string, TableMeta>) => {
      Object.assign(tables, newTables);
    }),
    addTable: vi.fn((table: TableMeta) => {
      tables[table.id] = table;
    }),
    getTable: vi.fn((tableId: string) => tables[tableId]),
    updateTable: vi.fn((tableId: string, updates: Partial<TableMeta>) => {
      if (tables[tableId]) {
        tables[tableId] = { ...tables[tableId], ...updates };
      }
    }),
    removeTable: vi.fn((tableId: string) => {
      delete tables[tableId];
    }),
    incrementTableUsage: vi.fn((tableId: string) => {
      if (tables[tableId]) {
        tables[tableId].usageCount++;
      }
    }),
    decrementTableUsage: vi.fn((tableId: string) => {
      if (tables[tableId] && tables[tableId].usageCount > 0) {
        tables[tableId].usageCount--;
      }
    }),
  } as unknown as WorkspaceMeta;

  return mockMeta;
};

const createMockWorkspaceService = (
  workspaceMeta: WorkspaceMeta
): WorkspaceService => {
  return {
    workspace: {
      docCollection: {
        meta: workspaceMeta,
      },
    },
  } as WorkspaceService;
};

describe('TableIndexService', () => {
  let tableIndexService: TableIndexService;
  let mockWorkspaceMeta: WorkspaceMeta;
  let mockWorkspaceService: WorkspaceService;

  beforeEach(() => {
    mockWorkspaceMeta = createMockWorkspaceMeta();
    mockWorkspaceService = createMockWorkspaceService(mockWorkspaceMeta);
    tableIndexService = new TableIndexService(mockWorkspaceService);
  });

  describe('registerTable', () => {
    it('should register a new table and return a table ID', () => {
      const pageId = 'page-1';
      const blockId = 'block-1';
      const title = 'Test Table';

      const tableId = tableIndexService.registerTable(pageId, blockId, title);

      expect(tableId).toBeDefined();
      expect(typeof tableId).toBe('string');

      const table = tableIndexService.getTable(tableId);
      expect(table).toBeDefined();
      expect(table?.title).toBe(title);
      expect(table?.pageId).toBe(pageId);
      expect(table?.blockId).toBe(blockId);
      expect(table?.usageCount).toBe(0);
    });

    it('should set created and updated timestamps', () => {
      const before = Date.now();
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );
      const after = Date.now();

      const table = tableIndexService.getTable(tableId);
      expect(table?.createdAt).toBeGreaterThanOrEqual(before);
      expect(table?.createdAt).toBeLessThanOrEqual(after);
      expect(table?.updatedAt).toBe(table?.createdAt);
    });
  });

  describe('getAllTables', () => {
    it('should return empty array when no tables exist', () => {
      const tables = tableIndexService.getAllTables();
      expect(tables).toEqual([]);
    });

    it('should return all registered tables', () => {
      const tableId1 = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Table 1'
      );
      const tableId2 = tableIndexService.registerTable(
        'page-2',
        'block-2',
        'Table 2'
      );

      const tables = tableIndexService.getAllTables();
      expect(tables).toHaveLength(2);
      expect(tables.map(t => t.id)).toContain(tableId1);
      expect(tables.map(t => t.id)).toContain(tableId2);
    });
  });

  describe('updateTable', () => {
    it('should update table metadata', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Original Title'
      );
      const newTitle = 'Updated Title';

      tableIndexService.updateTable(tableId, { title: newTitle });

      const table = tableIndexService.getTable(tableId);
      expect(table?.title).toBe(newTitle);
    });

    it('should update the updatedAt timestamp', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );
      const originalTable = tableIndexService.getTable(tableId);
      const originalUpdatedAt = originalTable?.updatedAt;

      // Wait a bit to ensure timestamp difference
      setTimeout(() => {
        tableIndexService.updateTable(tableId, { title: 'New Title' });

        const updatedTable = tableIndexService.getTable(tableId);
        expect(updatedTable?.updatedAt).toBeGreaterThan(originalUpdatedAt || 0);
      }, 10);
    });

    it('should throw error for non-existent table', () => {
      expect(() => {
        tableIndexService.updateTable('non-existent', { title: 'New Title' });
      }).toThrow('Table with ID non-existent not found');
    });
  });

  describe('removeTable', () => {
    it('should remove table when usage count is 0', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );

      const result = tableIndexService.removeTable(tableId);

      expect(result).toBe(true);
      expect(tableIndexService.getTable(tableId)).toBeUndefined();
    });

    it('should not remove table when usage count > 0', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );
      tableIndexService.incrementUsage(tableId);

      expect(() => {
        tableIndexService.removeTable(tableId);
      }).toThrow(
        'Cannot delete table "Test Table". It is being used in 1 relation(s).'
      );
    });

    it('should return false for non-existent table', () => {
      const result = tableIndexService.removeTable('non-existent');
      expect(result).toBe(false);
    });
  });

  describe('usage counting', () => {
    it('should increment usage count', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );

      tableIndexService.incrementUsage(tableId);

      const table = tableIndexService.getTable(tableId);
      expect(table?.usageCount).toBe(1);
    });

    it('should decrement usage count', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );
      tableIndexService.incrementUsage(tableId);
      tableIndexService.incrementUsage(tableId);

      tableIndexService.decrementUsage(tableId);

      const table = tableIndexService.getTable(tableId);
      expect(table?.usageCount).toBe(1);
    });

    it('should not decrement below 0', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );

      tableIndexService.decrementUsage(tableId);

      const table = tableIndexService.getTable(tableId);
      expect(table?.usageCount).toBe(0);
    });
  });

  describe('canDeleteTable', () => {
    it('should return true when usage count is 0', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );

      expect(tableIndexService.canDeleteTable(tableId)).toBe(true);
    });

    it('should return false when usage count > 0', () => {
      const tableId = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Test Table'
      );
      tableIndexService.incrementUsage(tableId);

      expect(tableIndexService.canDeleteTable(tableId)).toBe(false);
    });

    it('should return false for non-existent table', () => {
      expect(tableIndexService.canDeleteTable('non-existent')).toBe(false);
    });
  });

  describe('getAvailableTablesForRelations', () => {
    it('should return all tables when no exclusion', () => {
      const tableId1 = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Table 1'
      );
      const tableId2 = tableIndexService.registerTable(
        'page-2',
        'block-2',
        'Table 2'
      );

      const available = tableIndexService.getAvailableTablesForRelations();

      expect(available).toHaveLength(2);
      expect(available.map(t => t.id)).toContain(tableId1);
      expect(available.map(t => t.id)).toContain(tableId2);
    });

    it('should exclude specified table', () => {
      const tableId1 = tableIndexService.registerTable(
        'page-1',
        'block-1',
        'Table 1'
      );
      const tableId2 = tableIndexService.registerTable(
        'page-2',
        'block-2',
        'Table 2'
      );

      const available =
        tableIndexService.getAvailableTablesForRelations(tableId1);

      expect(available).toHaveLength(1);
      expect(available[0].id).toBe(tableId2);
    });
  });

  describe('findTableByBlock', () => {
    it('should find table by page and block ID', () => {
      const pageId = 'page-1';
      const blockId = 'block-1';
      const tableId = tableIndexService.registerTable(
        pageId,
        blockId,
        'Test Table'
      );

      const found = tableIndexService.findTableByBlock(pageId, blockId);

      expect(found?.id).toBe(tableId);
    });

    it('should return undefined for non-existent block', () => {
      const found = tableIndexService.findTableByBlock(
        'non-existent-page',
        'non-existent-block'
      );
      expect(found).toBeUndefined();
    });
  });
});
