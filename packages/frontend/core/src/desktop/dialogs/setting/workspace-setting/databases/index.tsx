import {
  SettingHeader,
  SettingWrapper,
} from '@affine/component/setting-components';
import {
  TableAccessService,
  TableIndexService,
} from '@affine/core/modules/workspace';
import { useI18n } from '@affine/i18n';
import { DatabaseTableViewIcon } from '@blocksuite/icons/rc';
import { useService } from '@toeverything/infra';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { WorkspaceService } from '../../../../../modules/workspace';

export const WorkspaceSettingDatabases = () => {
  const t = useI18n();
  const tableIndexService = useService(TableIndexService);
  const tableAccessService = useService(TableAccessService);
  const workspaceService = useService(WorkspaceService);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [tableVersion, setTableVersion] = useState(0); // Force re-renders on table changes

  // Helper function to get dynamic title from the source block
  const getDynamicTitle = useCallback(
    (table: any): string => {
      try {
        // Get the document containing the table
        const doc = workspaceService.workspace.docCollection.getDoc(
          table.pageId
        );
        if (!doc || !doc.loaded) {
          // If doc is not loaded, try to load it synchronously if possible
          if (doc && !doc.loaded) {
            doc.load();
          }
          if (!doc || !doc.loaded) {
            console.warn(
              `[WorkspaceSettingDatabases] Document ${table.pageId} not available for table ${table.id}`
            );
            return table.title || 'Untitled Table';
          }
        }

        // Get the store and find the database block
        const store = doc.getStore();
        const block = store?.getBlock(table.blockId);

        if (block?.model && block.model.flavour === 'affine:database') {
          // Type-safe access to props
          const props = block.model.props as any;
          const title = props.title?.toString();
          if (title && title.trim()) {
            return title.trim();
          }
        }

        // Fallback to index title if block is not accessible
        return table.title || 'Untitled Table';
      } catch (error) {
        console.warn(
          `[WorkspaceSettingDatabases] Error getting dynamic title for table ${table.id}:`,
          error
        );
        return table.title || 'Untitled Table';
      }
    },
    [workspaceService]
  );

  // Listen to table changes to force updates
  useEffect(() => {
    const workspaceMeta = tableIndexService.getWorkspaceMetaForObservation();
    if (!workspaceMeta) return;

    const subscriptions = [
      workspaceMeta.tableAdded.subscribe(() => setTableVersion(v => v + 1)),
      workspaceMeta.tableRemoved.subscribe(() => setTableVersion(v => v + 1)),
      workspaceMeta.tableUpdated.subscribe(() => setTableVersion(v => v + 1)),
    ];

    return () => {
      subscriptions.forEach(sub => sub.unsubscribe());
    };
  }, [tableIndexService]);

  // Get all tables from the table index
  const tables = useMemo(() => {
    try {
      // Include tableVersion in dependency to force re-computation
      const tablesArray = tableIndexService.getAllTables();
      console.log(
        '[WorkspaceSettingDatabases] Recomputing tables, version:',
        tableVersion,
        'count:',
        tablesArray.length
      );
      return tablesArray.map((table: any) => ({
        id: table.id,
        title: getDynamicTitle(table), // Use dynamic title instead of stored title
        docId: table.pageId, // pageId is the document ID
        blockId: table.blockId,
        lastModified: new Date(table.updatedAt),
        usageCount: table.usageCount,
        createdAt: new Date(table.createdAt),
      }));
    } catch (error) {
      console.error('[WorkspaceSettingDatabases] Error getting tables:', error);
      return [];
    }
  }, [tableIndexService, tableVersion, getDynamicTitle]); // Add getDynamicTitle as dependency

  const handleResetTables = useCallback(async () => {
    setIsResetting(true);
    try {
      tableAccessService.resetAllTables();
      console.log('Database list has been reset');
    } catch (error) {
      console.error('Failed to reset database list:', error);
    } finally {
      setIsResetting(false);
      setShowConfirmation(false);
    }
  }, [tableAccessService]);

  const handleResetClick = useCallback(() => {
    setShowConfirmation(true);
  }, []);

  const handleCancelReset = useCallback(() => {
    setShowConfirmation(false);
  }, []);

  console.log('[WorkspaceSettingDatabases] Found tables:', tables);

  return (
    <SettingWrapper title={t['com.affine.settings.workspace.databases']()}>
      <SettingHeader
        title={t['com.affine.settings.workspace.databases']()}
        subtitle={t['com.affine.settings.workspace.databases.description']()}
      />

      {/* Reset button section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginBottom: '16px',
          padding: '0 0 16px 0',
          borderBottom: '1px solid var(--affine-border-color)',
        }}
      >
        {showConfirmation ? (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ color: 'var(--affine-error-color)', fontSize: 14 }}>
              This will clear all registered databases. Are you sure?
            </span>
            <button
              onClick={() => {
                handleResetTables().catch(console.error);
              }}
              disabled={isResetting}
              style={{
                backgroundColor: 'var(--affine-error-color)',
                color: 'white',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: isResetting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                opacity: isResetting ? 0.6 : 1,
              }}
            >
              {isResetting ? 'Resetting...' : 'Yes, Reset'}
            </button>
            <button
              onClick={handleCancelReset}
              disabled={isResetting}
              style={{
                backgroundColor: 'var(--affine-background-secondary-color)',
                color: 'var(--affine-text-primary-color)',
                border: '1px solid var(--affine-border-color)',
                padding: '6px 12px',
                borderRadius: '6px',
                cursor: isResetting ? 'not-allowed' : 'pointer',
                fontSize: '14px',
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleResetClick}
            style={{
              backgroundColor: 'var(--affine-background-secondary-color)',
              color: 'var(--affine-text-primary-color)',
              border: '1px solid var(--affine-border-color)',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              transition: 'background-color 0.2s',
            }}
            onMouseOver={e => {
              e.currentTarget.style.backgroundColor =
                'var(--affine-hover-color)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.backgroundColor =
                'var(--affine-background-secondary-color)';
            }}
          >
            Reset Database List
          </button>
        )}
      </div>

      <div style={{ padding: '24px 0' }}>
        {tables.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '64px 32px',
              textAlign: 'center',
              border: '1px solid var(--affine-border-color)',
              borderRadius: '8px',
              background: 'var(--affine-background-secondary-color)',
            }}
          >
            <DatabaseTableViewIcon
              style={{
                width: '48px',
                height: '48px',
                marginBottom: '16px',
                color: 'var(--affine-icon-secondary)',
              }}
            />
            <p
              style={{ fontSize: '16px', fontWeight: 500, margin: '0 0 8px 0' }}
            >
              {t['com.affine.settings.workspace.databases.empty']()}
            </p>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--affine-text-secondary-color)',
                margin: 0,
              }}
            >
              {t['com.affine.settings.workspace.databases.empty.description']()}
            </p>
          </div>
        ) : (
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1.5fr 0.8fr 1fr',
                gap: '16px',
                padding: '12px 16px',
                borderBottom: '1px solid var(--affine-border-color)',
                background: 'var(--affine-background-secondary-color)',
                borderRadius: '8px 8px 0 0',
                fontWeight: 600,
                fontSize: '14px',
                color: 'var(--affine-text-secondary-color)',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
              >
                <DatabaseTableViewIcon
                  style={{ width: '16px', height: '16px' }}
                />
                {t['com.affine.settings.workspace.databases.table.name']()}
              </div>
              <div>
                {t['com.affine.settings.workspace.databases.table.id']()}
              </div>
              <div>
                {t['com.affine.settings.workspace.databases.table.document']()}
              </div>
              <div>
                {t['com.affine.settings.workspace.databases.table.usage']()}
              </div>
              <div>
                {t['com.affine.settings.workspace.databases.table.modified']()}
              </div>
            </div>

            <div
              style={{
                border: '1px solid var(--affine-border-color)',
                borderTop: 'none',
                borderRadius: '0 0 8px 8px',
              }}
            >
              {tables.map(
                (table: {
                  id: string;
                  title: string;
                  docId: string;
                  blockId: string;
                  lastModified: Date;
                  usageCount: number;
                  createdAt: Date;
                }) => (
                  <div
                    key={table.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1.5fr 0.8fr 1fr',
                      gap: '16px',
                      padding: '16px',
                      borderBottom: '1px solid var(--affine-border-color)',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <DatabaseTableViewIcon
                        style={{
                          width: '16px',
                          height: '16px',
                          color: 'var(--affine-icon-color)',
                        }}
                      />
                      <span
                        style={{
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {table.title}
                      </span>
                    </div>
                    <div>
                      <code
                        style={{
                          background: 'var(--affine-background-code-block)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {table.id}
                      </code>
                    </div>
                    <div>
                      <code
                        style={{
                          background: 'var(--affine-background-code-block)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontFamily: 'monospace',
                        }}
                      >
                        {table.docId}
                      </code>
                    </div>
                    <div>
                      <span
                        style={{
                          color: 'var(--affine-text-secondary-color)',
                          fontSize: '13px',
                          fontWeight: 500,
                        }}
                      >
                        {table.usageCount}
                      </span>
                    </div>
                    <div>
                      <span
                        style={{
                          color: 'var(--affine-text-secondary-color)',
                          fontSize: '13px',
                        }}
                      >
                        {table.lastModified.toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        )}

        <div
          style={{
            marginTop: '16px',
            padding: '12px 16px',
            background: 'var(--affine-background-secondary-color)',
            border: '1px solid var(--affine-border-color)',
            borderRadius: '8px',
            fontSize: '13px',
            color: 'var(--affine-text-secondary-color)',
          }}
        >
          <p style={{ margin: 0 }}>
            {`Found ${tables.length} database table${tables.length !== 1 ? 's' : ''} in workspace`}
          </p>
        </div>
      </div>
    </SettingWrapper>
  );
};
