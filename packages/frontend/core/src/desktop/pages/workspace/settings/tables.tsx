import { TableAccessService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useCallback, useMemo, useState } from 'react';

export const WorkspaceTablesSettings = () => {
  const tableAccessService = useService(TableAccessService);
  const [isResetting, setIsResetting] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);

  const tables = useMemo(
    () => tableAccessService.getAllTables(),
    [tableAccessService] // Remove isResetting dependency as it's not used in the computation
  );

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

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2>Workspace Databases</h2>
        <div>
          {showConfirmation ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ color: '#e74c3c', fontSize: 14 }}>
                This will clear all registered databases. Are you sure?
              </span>
              <button
                onClick={() => {
                  handleResetTables().catch(console.error);
                }}
                disabled={isResetting}
                style={{
                  backgroundColor: '#e74c3c',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 4,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                {isResetting ? 'Resetting...' : 'Yes, Reset'}
              </button>
              <button
                onClick={handleCancelReset}
                disabled={isResetting}
                style={{
                  backgroundColor: '#95a5a6',
                  color: 'white',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: 4,
                  cursor: isResetting ? 'not-allowed' : 'pointer',
                  fontSize: 12,
                }}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleResetClick}
              style={{
                backgroundColor: '#e74c3c',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Reset Database List
            </button>
          )}
        </div>
      </div>
      <table
        style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}
      >
        <thead>
          <tr>
            <th
              style={{
                textAlign: 'left',
                borderBottom: '1px solid #eee',
                padding: 8,
              }}
            >
              Title
            </th>
            <th
              style={{
                textAlign: 'left',
                borderBottom: '1px solid #eee',
                padding: 8,
              }}
            >
              Usages
            </th>
            <th
              style={{
                textAlign: 'left',
                borderBottom: '1px solid #eee',
                padding: 8,
              }}
            >
              Page
            </th>
            <th
              style={{
                textAlign: 'left',
                borderBottom: '1px solid #eee',
                padding: 8,
              }}
            >
              Block
            </th>
          </tr>
        </thead>
        <tbody>
          {tables.length === 0 ? (
            <tr>
              <td colSpan={4} style={{ padding: 16, color: '#888' }}>
                No databases found in this workspace.
              </td>
            </tr>
          ) : (
            tables.map(table => (
              <tr key={table.id}>
                <td style={{ padding: 8 }}>
                  <a
                    href={`#/workspace/${table.pageId}/${table.blockId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {table.title}
                  </a>
                </td>
                <td style={{ padding: 8 }}>{table.usageCount}</td>
                <td
                  style={{ padding: 8, fontFamily: 'monospace', fontSize: 13 }}
                >
                  {table.pageId}
                </td>
                <td
                  style={{ padding: 8, fontFamily: 'monospace', fontSize: 13 }}
                >
                  {table.blockId}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};
