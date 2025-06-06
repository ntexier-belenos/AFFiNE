import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { Command } from '@blocksuite/std';
import type { BlockModel, Store } from '@blocksuite/store';
import { nanoid } from '@blocksuite/store';

import {
  DatabaseBlockDataSource,
  databaseViewInitTemplate,
} from './data-source';

export const insertDatabaseBlockCommand: Command<
  {
    selectedModels?: BlockModel[];
    viewType: string;
    place?: 'after' | 'before';
    removeEmptyLine?: boolean;
  },
  {
    insertedDatabaseBlockId: string;
    tableId: string;
  }
> = (ctx, next) => {
  const { selectedModels, viewType, place, removeEmptyLine, std } = ctx;
  if (!selectedModels?.length) return;

  const targetModel =
    place === 'before'
      ? selectedModels[0]
      : selectedModels[selectedModels.length - 1];

  if (!targetModel) return;

  // Generate unique table ID for workspace indexing
  const tableId = nanoid();

  const result = std.store.addSiblingBlocks(
    targetModel,
    [
      {
        flavour: 'affine:database',
        props: { tableId },
      },
    ],
    place
  );
  const blockId = result[0];

  if (blockId == null) return;

  // Initialize the database block
  initDatabaseBlock(std.store, targetModel, blockId, viewType, false);

  // Register table in workspace index
  registerTableInWorkspace(std.store, blockId, tableId);

  if (removeEmptyLine && targetModel.text?.length === 0) {
    std.store.deleteBlock(targetModel);
  }

  next({
    insertedDatabaseBlockId: blockId,
    tableId,
  });
};

export const initDatabaseBlock = (
  doc: Store,
  model: BlockModel,
  databaseId: string,
  viewType: string,
  isAppendNewRow = true
) => {
  const blockModel = doc.getBlock(databaseId)?.model as
    | DatabaseBlockModel
    | undefined;
  if (!blockModel) {
    return;
  }
  const datasource = new DatabaseBlockDataSource(blockModel);
  databaseViewInitTemplate(datasource, viewType);
  if (isAppendNewRow) {
    const parent = doc.getParent(model);
    if (!parent) return;
    doc.addBlock('affine:paragraph', {}, parent.id);
  }
};

/**
 * Register a newly created table in the workspace index
 */
function registerTableInWorkspace(
  store: Store,
  blockId: string,
  tableId: string
): void {
  try {
    // Get the page containing the block
    const block = store.getBlock(blockId);
    if (!block) {
      console.warn(`Block ${blockId} not found for table registration`);
      return;
    }

    const pageId = block.doc?.id;
    if (!pageId) {
      console.warn(`Page ID not found for block ${blockId}`);
      return;
    }

    // Get workspace meta from store
    const workspaceMeta = store.workspace?.meta;
    if (!workspaceMeta) {
      console.warn('Workspace meta not available for table registration');
      return;
    }

    // Create table metadata
    const now = Date.now();
    const tableMeta = {
      id: tableId,
      pageId,
      blockId,
      usageCount: 1, // Initial usage count of 1 for newly created tables (they have at least one view)
      createdAt: now,
      updatedAt: now,
    };

    // Register in workspace index
    workspaceMeta.addTable(tableMeta);
  } catch (error) {
    console.error('Failed to register table in workspace index:', error);
  }
}
