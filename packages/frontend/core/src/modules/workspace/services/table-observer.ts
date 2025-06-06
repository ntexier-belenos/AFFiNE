import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import type { BlockModel, Store } from '@blocksuite/store';
import { Service } from '@toeverything/infra';

import type { WorkspaceService } from './workspace';

/**
 * Service to observe database blocks and maintain workspace table index synchronization
 */
export class TableObserverService extends Service {
  protected override disposables: Array<() => void> = [];

  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  /**
   * Start observing database block changes for automatic table index synchronization
   */
  startObserving(store: Store): void {
    // Subscribe to block updates
    const blockUpdateDisposable = store.slots.blockUpdated.subscribe(event => {
      this.handleBlockUpdate(event);
    });

    this.disposables.push(() => blockUpdateDisposable.unsubscribe());
  }

  /**
   * Stop observing and clean up subscriptions
   */
  stopObserving(): void {
    this.disposables.forEach(dispose => dispose());
    this.disposables = [];
  }

  /**
   * Handle block update events and sync table index
   */
  private handleBlockUpdate(event: any): void {
    // Only process database blocks
    if (event.flavour !== 'affine:database') {
      return;
    }

    try {
      switch (event.type) {
        case 'add':
          this.handleTableCreation(event);
          break;
        case 'delete':
          this.handleTableDeletion(event);
          break;
        case 'update':
          this.handleTableUpdate(event);
          break;
      }
    } catch (error) {
      console.error('Error handling table index update:', error);
    }
  }

  /**
   * Handle table creation - register in index if not already present
   */
  private handleTableCreation(event: any): void {
    const blockModel = event.model as DatabaseBlockModel;
    const tableId = blockModel?.props?.tableId;

    if (!tableId) {
      // Legacy table without tableId - could be migrated later
      return;
    }

    const workspaceMeta = this.getWorkspaceMeta();
    if (!workspaceMeta) return;

    // Check if already registered
    const existingTable = workspaceMeta.getTable(tableId);
    if (existingTable) {
      return; // Already registered
    }

    // Register new table
    const pageId = blockModel.store.id; // Get store/doc ID
    if (!pageId) return;

    const now = Date.now();
    const tableMeta = {
      id: tableId,
      pageId,
      blockId: event.id,
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    workspaceMeta.addTable(tableMeta);

    console.log(`Table ${tableId} auto-registered via observer`);
  }

  /**
   * Handle table deletion - remove from index after usage check
   */
  private handleTableDeletion(event: { id: string }): void {
    const workspaceMeta = this.getWorkspaceMeta();
    if (!workspaceMeta) return;

    // Find table by blockId since we don't have the model anymore
    const allTables = Object.values(workspaceMeta.tables);
    const tableToDelete = allTables.find(table => table.blockId === event.id);

    if (!tableToDelete) return;

    // Check usage count before deletion
    if (tableToDelete.usageCount > 0) {
      console.warn(
        `Attempted to delete table ${tableToDelete.id} with ${tableToDelete.usageCount} active usage(s). Manual intervention required.`
      );
      return;
    }

    // Safe to remove from index
    workspaceMeta.removeTable(tableToDelete.id);

    console.log(`Table ${tableToDelete.id} auto-removed from index`);
  }

  /**
   * Handle table updates - sync metadata (no longer syncing title as it's dynamic)
   */
  private handleTableUpdate(event: {
    id: string;
    model?: BlockModel;
    props?: Record<string, unknown>;
  }): void {
    const blockModel = event.model as DatabaseBlockModel;
    if (!blockModel?.props?.tableId) return;

    const workspaceMeta = this.getWorkspaceMeta();
    if (!workspaceMeta) return;

    const existingTable = workspaceMeta.getTable(blockModel.props.tableId);
    if (!existingTable) return;

    // Update timestamp only - title is now dynamic and fetched from block
    workspaceMeta.updateTable(blockModel.props.tableId, {
      updatedAt: Date.now(),
    });

    console.log(`Table ${blockModel.props.tableId} metadata updated`);
  }

  /**
   * Get workspace meta safely
   */
  private getWorkspaceMeta() {
    try {
      const workspace = this.workspaceService.workspace;
      return workspace?.docCollection?.meta;
    } catch (error) {
      console.error('Failed to get workspace meta:', error);
      return null;
    }
  }

  /**
   * Cleanup on service disposal
   */
  override dispose(): void {
    this.stopObserving();
    super.dispose();
  }
}
