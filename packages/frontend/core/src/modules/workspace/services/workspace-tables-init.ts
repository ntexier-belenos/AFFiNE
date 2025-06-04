import { OnEvent, Service } from '@toeverything/infra';

import type { Workspace } from '../entities/workspace';
import { WorkspaceInitialized } from '../events';
import type { TableIndexService } from './table-index';
import type { TableMigrationService } from './table-migration';
import type { WorkspaceTablesService } from './workspace-tables';

/**
 * Service responsible for automatically triggering table migration
 * when a workspace is initialized
 */
@OnEvent(WorkspaceInitialized, i => i.onWorkspaceInitialized)
export class WorkspaceTablesInitializationService extends Service {
  constructor(
    private readonly tableMigrationService: TableMigrationService,
    private readonly workspaceTablesService: WorkspaceTablesService,
    private readonly tableIndexService: TableIndexService
  ) {
    super();
  }

  onWorkspaceInitialized = async (workspace: Workspace): Promise<void> => {
    try {
      console.log(
        '[WorkspaceTablesInit] Workspace initialized, checking for table migration...',
        workspace.id
      );

      // Set up DOM event listeners for database blocks
      this.setupDatabaseBlockEventListeners();

      // Force a more aggressive migration approach
      console.log('[WorkspaceTablesInit] Starting forced migration check...');
      const migrationResult =
        await this.tableMigrationService.migrateWorkspaceTables();

      console.log('[WorkspaceTablesInit] Forced migration completed:', {
        migrated: migrationResult.migrated,
        skipped: migrationResult.skipped,
        errors: migrationResult.errors.length,
      });

      if (migrationResult.errors.length > 0) {
        console.warn(
          '[WorkspaceTablesInit] Migration had errors:',
          migrationResult.errors
        );
      }

      // Also check if migration is needed for informational purposes
      const needsMigration = await this.tableMigrationService.needsMigration();
      console.log(
        '[WorkspaceTablesInit] Post-migration check - still needs migration:',
        needsMigration
      );

      // Initialize the workspace tables service
      await this.workspaceTablesService.initialize();

      console.log('[WorkspaceTablesInit] Workspace tables system ready');
    } catch (error) {
      console.error(
        '[WorkspaceTablesInit] Failed to initialize workspace tables:',
        error
      );
    }
  };

  /**
   * Set up DOM event listeners for database block events
   */
  private setupDatabaseBlockEventListeners(): void {
    console.log(
      '[WorkspaceTablesInit] Setting up database block event listeners...'
    );

    // Listen for database-ready events (when a table already has a tableId)
    document.addEventListener('database-ready', ((event: CustomEvent) => {
      const { pageId, blockId, tableId, title } = event.detail;
      console.log('[WorkspaceTablesInit] Database ready event:', {
        pageId,
        blockId,
        tableId,
        title,
      });

      try {
        // Check if table is already indexed
        const existingTable = this.tableIndexService.findTableByBlock(
          pageId,
          blockId
        );
        if (!existingTable) {
          // Register the table in the index with initial usage of 1
          // because it already exists and has at least one view
          const registeredTableId = this.tableIndexService.registerTable(
            pageId,
            blockId,
            title,
            tableId,
            1 // Initial usage count of 1 for existing tables
          );
          console.log(
            '[WorkspaceTablesInit] Registered existing table in index:',
            {
              pageId,
              blockId,
              tableId: registeredTableId,
              title,
            }
          );
        } else {
          console.log(
            '[WorkspaceTablesInit] Table already indexed:',
            existingTable
          );
        }
      } catch (error) {
        console.error(
          '[WorkspaceTablesInit] Failed to register existing table:',
          error
        );
      }
    }) as EventListener);

    // Listen for database-migrated events (when a table was just assigned a tableId)
    document.addEventListener('database-migrated', ((event: CustomEvent) => {
      const { pageId, blockId, tableId, title } = event.detail;
      console.log('[WorkspaceTablesInit] Database migrated event:', {
        pageId,
        blockId,
        tableId,
        title,
      });

      try {
        // Check if table is already indexed
        const existingTable = this.tableIndexService.findTableByBlock(
          pageId,
          blockId
        );
        if (!existingTable) {
          // Register the newly migrated table in the index with initial usage of 1
          // because it already has at least one view (the one being migrated)
          const registeredTableId = this.tableIndexService.registerTable(
            pageId,
            blockId,
            title,
            tableId,
            1 // Initial usage count of 1 for migrated tables
          );
          console.log(
            '[WorkspaceTablesInit] Registered migrated table in index:',
            {
              pageId,
              blockId,
              tableId: registeredTableId,
              title,
            }
          );
        } else {
          console.log(
            '[WorkspaceTablesInit] Migrated table already indexed:',
            existingTable
          );
        }
      } catch (error) {
        console.error(
          '[WorkspaceTablesInit] Failed to register migrated table:',
          error
        );
      }
    }) as EventListener);

    // Listen for database-ensure-indexed events (check on every render)
    document.addEventListener('database-ensure-indexed', ((
      event: CustomEvent
    ) => {
      const { pageId, blockId, tableId, title } = event.detail;

      try {
        // Check if table is already indexed
        const existingTable = this.tableIndexService.findTableByBlock(
          pageId,
          blockId
        );
        if (!existingTable) {
          // Register the table in the index with initial usage of 1
          // because it's being actively rendered and has at least one view
          const registeredTableId = this.tableIndexService.registerTable(
            pageId,
            blockId,
            title,
            tableId,
            1 // Initial usage count of 1 for rendered tables
          );
          console.log(
            '[WorkspaceTablesInit] Registered missing table in index (render check):',
            {
              pageId,
              blockId,
              tableId: registeredTableId,
              title,
            }
          );
        }
      } catch (error) {
        console.error(
          '[WorkspaceTablesInit] Failed to register table on render check:',
          error
        );
      }
    }) as EventListener);

    console.log(
      '[WorkspaceTablesInit] Database block event listeners registered'
    );
  }
}
