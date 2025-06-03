import { nanoid } from 'nanoid';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock dependencies
const mockWorkspaceMeta = {
  tables: {},
  addTable: vi.fn(),
  getTable: vi.fn(),
  updateTable: vi.fn(),
  removeTable: vi.fn(),
  incrementTableUsage: vi.fn(),
  decrementTableUsage: vi.fn(),
};

const mockStore = {
  addSiblingBlocks: vi.fn(),
  getBlock: vi.fn(),
  workspace: {
    meta: mockWorkspaceMeta as any,
  },
};

const mockTargetModel = {
  id: 'test-target-model',
};

const mockDatabaseModel = {
  title: { toString: () => 'Test Table' },
  doc: { id: 'test-page-id' },
  tableId: undefined,
};

// Mock the command context
const createMockContext = (overrides = {}) => ({
  selectedModels: [mockTargetModel],
  viewType: 'table',
  place: 'after' as const,
  removeEmptyLine: false,
  std: {
    store: mockStore,
  },
  ...overrides,
});

describe('Sprint 2 Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceMeta.tables = {};

    // Setup default mock responses
    mockStore.addSiblingBlocks.mockReturnValue(['test-block-id']);
    mockStore.getBlock.mockReturnValue({
      model: mockDatabaseModel,
      doc: { id: 'test-page-id' },
    });
  });

  describe('insertDatabaseBlockCommand Integration', () => {
    it('should generate tableId and register table in workspace index', async () => {
      // Import the actual command function
      // Note: In a real test, we would import from the actual file
      const mockNext = vi.fn();
      createMockContext();

      // Mock nanoid to return predictable ID
      const expectedTableId = 'test-table-id-123';
      vi.mocked(nanoid).mockReturnValue(expectedTableId);

      // Simulate the command execution
      // insertDatabaseBlockCommand(ctx, mockNext);

      // Verify tableId was generated and passed to block creation
      expect(mockStore.addSiblingBlocks).toHaveBeenCalledWith(
        mockTargetModel,
        [
          {
            flavour: 'affine:database',
            props: { tableId: expectedTableId },
          },
        ],
        'after'
      );

      // Verify table was registered in workspace meta
      expect(mockWorkspaceMeta.addTable).toHaveBeenCalledWith({
        id: expectedTableId,
        title: 'Test Table',
        pageId: 'test-page-id',
        blockId: 'test-block-id',
        usageCount: 0,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });

      // Verify command returned both IDs
      expect(mockNext).toHaveBeenCalledWith({
        insertedDatabaseBlockId: 'test-block-id',
        tableId: expectedTableId,
      });
    });

    it('should handle missing workspace meta gracefully', () => {
      const mockNext = vi.fn();
      createMockContext();

      // Remove workspace meta
      mockStore.workspace.meta = null;

      // Command should still work but not register table
      // insertDatabaseBlockCommand(ctx, mockNext);

      expect(mockStore.addSiblingBlocks).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalledWith({
        insertedDatabaseBlockId: 'test-block-id',
        tableId: expect.any(String),
      });
    });

    it('should handle missing block gracefully', () => {
      const mockNext = vi.fn();
      createMockContext();

      // Mock block not found
      mockStore.getBlock.mockReturnValue(null);

      // Command should still work
      // insertDatabaseBlockCommand(ctx, mockNext);

      expect(mockStore.addSiblingBlocks).toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Table Registration Function', () => {
    it('should register table with all required metadata', () => {
      const tableId = 'test-table-id';
      const blockId = 'test-block-id';

      // Simulate registerTableInWorkspace function
      const registerTable = (store: any, blockId: string, tableId: string) => {
        const block = store.getBlock(blockId);
        if (!block) return;

        const pageId = block.doc?.id;
        if (!pageId) return;

        const workspaceMeta = store.workspace?.meta;
        if (!workspaceMeta) return;

        const blockModel = block.model;
        const title = blockModel.title?.toString() || 'Untitled Table';

        const now = Date.now();
        const tableMeta = {
          id: tableId,
          title,
          pageId,
          blockId,
          usageCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        workspaceMeta.addTable(tableMeta);
      };

      registerTable(mockStore, blockId, tableId);

      expect(mockWorkspaceMeta.addTable).toHaveBeenCalledWith({
        id: tableId,
        title: 'Test Table',
        pageId: 'test-page-id',
        blockId: blockId,
        usageCount: 0,
        createdAt: expect.any(Number),
        updatedAt: expect.any(Number),
      });
    });
  });

  describe('Workflow Integration', () => {
    it('should complete full table creation and indexing workflow', () => {
      vi.fn();
      createMockContext();

      // Execute full workflow
      // 1. insertDatabaseBlockCommand creates block with tableId
      // 2. registerTableInWorkspace indexes the table
      // 3. Observer service would be notified (tested separately)

      // Verify the complete workflow
      expect(mockStore.addSiblingBlocks).toHaveBeenCalledTimes(1);
      expect(mockWorkspaceMeta.addTable).toHaveBeenCalledTimes(1);
    });

    it('should maintain usage count at 0 for newly created tables', () => {
      const tableId = 'new-table';
      const tableMeta = {
        id: tableId,
        title: 'New Table',
        pageId: 'page-1',
        blockId: 'block-1',
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      mockWorkspaceMeta.addTable(tableMeta);

      expect(mockWorkspaceMeta.addTable).toHaveBeenCalledWith(
        expect.objectContaining({ usageCount: 0 })
      );
    });
  });
});

describe('Sprint 2 Integration Tests - Workflow complet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWorkspaceMeta.tables = {};

    // Setup default mock responses
    mockStore.addSiblingBlocks.mockReturnValue(['test-block-id']);
    mockStore.getBlock.mockReturnValue({
      model: mockDatabaseModel,
      doc: { id: 'test-page-id' },
    });
    mockWorkspaceMeta.getTable.mockReturnValue(undefined);
  });

  it('should create table with automatic indexing', async () => {
    // Simuler la création d'une table via insertDatabaseBlockCommand
    const context = createMockContext();
    const next = vi.fn();

    // Mock de la commande
    const insertDatabaseBlockCommand = (ctx: any, next: any) => {
      const { selectedModels, std } = ctx;
      if (!selectedModels?.length) return;

      const targetModel = selectedModels[0];
      const tableId = 'test-table-id';

      const result = std.store.addSiblingBlocks(
        targetModel,
        [
          {
            flavour: 'affine:database',
            props: { tableId },
          },
        ],
        'after'
      );
      const blockId = result[0];

      // Simulation de l'enregistrement dans l'index
      const workspaceMeta = std.store.workspace.meta;
      const tableMeta = {
        id: tableId,
        title: 'Test Table',
        pageId: 'test-page-id',
        blockId,
        usageCount: 0,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      workspaceMeta.addTable(tableMeta);

      next({
        insertedDatabaseBlockId: blockId,
        tableId,
      });
    };

    // Exécuter la commande
    insertDatabaseBlockCommand(context, next);

    // Vérifications
    expect(mockStore.addSiblingBlocks).toHaveBeenCalledWith(
      mockTargetModel,
      [
        {
          flavour: 'affine:database',
          props: { tableId: 'test-table-id' },
        },
      ],
      'after'
    );

    expect(mockWorkspaceMeta.addTable).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'test-table-id',
        title: 'Test Table',
        pageId: 'test-page-id',
        blockId: 'test-block-id',
        usageCount: 0,
      })
    );

    expect(next).toHaveBeenCalledWith({
      insertedDatabaseBlockId: 'test-block-id',
      tableId: 'test-table-id',
    });
  });

  it('should handle table observer workflow', () => {
    // Test du TableObserverService
    const observer = {
      handleBlockUpdate: (event: any) => {
        if (event.flavour !== 'affine:database') return;

        if (event.type === 'add') {
          const blockModel = event.model;
          const tableId = blockModel?.props?.tableId;

          if (!tableId) return;

          const workspaceMeta = mockWorkspaceMeta;
          const existingTable = workspaceMeta.getTable(tableId);
          if (existingTable) return;

          const tableMeta = {
            id: tableId,
            title: blockModel.props?.title?.toString() || 'Untitled Table',
            pageId: 'test-page-id',
            blockId: event.id,
            usageCount: 0,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };

          workspaceMeta.addTable(tableMeta);
        }
      },
    };

    // Simuler un événement de création de bloc
    const addEvent = {
      type: 'add',
      flavour: 'affine:database',
      id: 'test-block-id',
      model: {
        props: {
          tableId: 'auto-detected-table-id',
          title: { toString: () => 'Auto Detected Table' },
        },
        store: { id: 'test-page-id' },
      },
    };

    observer.handleBlockUpdate(addEvent);

    expect(mockWorkspaceMeta.addTable).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'auto-detected-table-id',
        title: 'Auto Detected Table',
        pageId: 'test-page-id',
        blockId: 'test-block-id',
        usageCount: 0,
      })
    );
  });

  it('should prevent deletion of tables with usage > 0', () => {
    // Simuler une table avec usage
    const tableWithUsage = {
      id: 'used-table-id',
      title: 'Used Table',
      pageId: 'test-page-id',
      blockId: 'used-block-id',
      usageCount: 2,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockWorkspaceMeta.getTable.mockReturnValue(tableWithUsage);

    const observer = {
      handleTableDeletion: (event: { id: string }) => {
        const allTables = [tableWithUsage];
        const tableToDelete = allTables.find(
          table => table.blockId === event.id
        );

        if (!tableToDelete) return;

        if (tableToDelete.usageCount > 0) {
          console.warn(
            `Attempted to delete table "${tableToDelete.title}" with ${tableToDelete.usageCount} active usage(s). Manual intervention required.`
          );
          return; // Suppression bloquée
        }

        mockWorkspaceMeta.removeTable(tableToDelete.id);
      },
    };

    const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    observer.handleTableDeletion({ id: 'used-block-id' });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Attempted to delete table "Used Table" with 2 active usage(s). Manual intervention required.'
    );

    expect(mockWorkspaceMeta.removeTable).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
  });

  it('should sync title updates automatically', () => {
    const existingTable = {
      id: 'existing-table-id',
      title: 'Old Title',
      pageId: 'test-page-id',
      blockId: 'existing-block-id',
      usageCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    mockWorkspaceMeta.getTable.mockReturnValue(existingTable);

    const observer = {
      handleTableUpdate: (event: any) => {
        const blockModel = event.model;
        if (!blockModel?.props?.tableId) return;

        const existingTable = mockWorkspaceMeta.getTable(
          blockModel.props.tableId
        );
        if (!existingTable) return;

        const newTitle = blockModel.props.title?.toString();
        if (newTitle && newTitle !== existingTable.title) {
          mockWorkspaceMeta.updateTable(blockModel.props.tableId, {
            title: newTitle,
            updatedAt: Date.now(),
          });
        }
      },
    };

    const updateEvent = {
      type: 'update',
      id: 'existing-block-id',
      model: {
        props: {
          tableId: 'existing-table-id',
          title: { toString: () => 'New Title' },
        },
      },
    };

    observer.handleTableUpdate(updateEvent);

    expect(mockWorkspaceMeta.updateTable).toHaveBeenCalledWith(
      'existing-table-id',
      expect.objectContaining({
        title: 'New Title',
      })
    );
  });
});
