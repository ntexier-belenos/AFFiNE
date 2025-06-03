import { TableAccessService } from '@affine/core/modules/workspace';
import { useService } from '@toeverything/infra';
import { useMemo } from 'react';

export const WorkspaceTablesSettings = () => {
  const tableAccessService = useService(TableAccessService);
  const tables = useMemo(
    () => tableAccessService.getAllTables(),
    [tableAccessService]
  );

  return (
    <div style={{ padding: 24 }}>
      <h2>Workspace Databases</h2>
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
              Table ID
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
              <td colSpan={5} style={{ padding: 16, color: '#888' }}>
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
                <td
                  style={{ padding: 8, fontFamily: 'monospace', fontSize: 13 }}
                >
                  {table.id}
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
