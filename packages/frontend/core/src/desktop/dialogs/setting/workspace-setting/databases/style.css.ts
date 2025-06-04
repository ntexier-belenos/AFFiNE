import { style } from '@vanilla-extract/css';

export const databasesContainer = style({
  padding: '24px 0',
});

export const tableHeader = style({
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
});

export const tableHeaderCell = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
});

export const headerIcon = style({
  width: '16px',
  height: '16px',
  color: 'var(--affine-icon-color)',
});

export const tableBody = style({
  border: '1px solid var(--affine-border-color)',
  borderTop: 'none',
  borderRadius: '0 0 8px 8px',
});

export const tableRow = style({
  display: 'grid',
  gridTemplateColumns: '2fr 1fr 1.5fr 0.8fr 1fr',
  gap: '16px',
  padding: '16px',
  borderBottom: '1px solid var(--affine-border-color)',
  transition: 'background-color 0.2s',

  ':hover': {
    background: 'var(--affine-hover-color)',
  },

  ':last-child': {
    borderBottom: 'none',
  },
});

export const tableCell = style({
  display: 'flex',
  alignItems: 'center',
  gap: '8px',
  fontSize: '14px',
  overflow: 'hidden',
});

export const tableIcon = style({
  width: '16px',
  height: '16px',
  color: 'var(--affine-icon-color)',
  flexShrink: 0,
});

export const tableName = style({
  fontWeight: 500,
  color: 'var(--affine-text-primary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
});

export const tableId = style({
  background: 'var(--affine-background-code-block)',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'var(--affine-font-family-mono)',
  color: 'var(--affine-text-secondary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
});

export const docId = style({
  background: 'var(--affine-background-code-block)',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '12px',
  fontFamily: 'var(--affine-font-family-mono)',
  color: 'var(--affine-text-secondary-color)',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: '100%',
});

export const lastModified = style({
  color: 'var(--affine-text-secondary-color)',
  fontSize: '13px',
});

export const usageCount = style({
  color: 'var(--affine-text-secondary-color)',
  fontSize: '13px',
  fontWeight: 500,
});

export const emptyState = style({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '64px 32px',
  textAlign: 'center',
  border: '1px solid var(--affine-border-color)',
  borderRadius: '8px',
  background: 'var(--affine-background-secondary-color)',
});

export const emptyIcon = style({
  width: '48px',
  height: '48px',
  color: 'var(--affine-icon-secondary)',
  marginBottom: '16px',
});

export const emptyText = style({
  fontSize: '16px',
  fontWeight: 500,
  color: 'var(--affine-text-primary-color)',
  margin: '0 0 8px 0',
});

export const emptySubtext = style({
  fontSize: '14px',
  color: 'var(--affine-text-secondary-color)',
  margin: 0,
  lineHeight: 1.5,
});

export const summary = style({
  marginTop: '16px',
  padding: '12px 16px',
  background: 'var(--affine-background-secondary-color)',
  border: '1px solid var(--affine-border-color)',
  borderRadius: '8px',
  fontSize: '13px',
  color: 'var(--affine-text-secondary-color)',
});
