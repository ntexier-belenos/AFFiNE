import type { Subject } from 'rxjs';

export type Tag = {
  id: string;
  value: string;
  color: string;
};

export type TableMeta = {
  id: string;
  pageId: string;
  blockId: string;
  usageCount: number;
  createdAt: number;
  updatedAt: number;
};

export type DocsPropertiesMeta = {
  tags?: {
    options: Tag[];
  };
};

export type TablesIndexMeta = {
  [tableId: string]: TableMeta;
};
export interface DocMeta {
  id: string;
  title: string;
  tags: string[];
  createDate: number;
  updatedDate?: number;
  favorite?: boolean;
}

export interface WorkspaceMeta {
  get docMetas(): DocMeta[];

  addDocMeta(props: DocMeta, index?: number): void;
  getDocMeta(id: string): DocMeta | undefined;
  setDocMeta(id: string, props: Partial<DocMeta>): void;
  removeDocMeta(id: string): void;

  get properties(): DocsPropertiesMeta;
  setProperties(meta: DocsPropertiesMeta): void;

  get tables(): TablesIndexMeta;
  setTables(tables: TablesIndexMeta): void;
  addTable(table: TableMeta): void;
  getTable(tableId: string): TableMeta | undefined;
  updateTable(tableId: string, updates: Partial<TableMeta>): void;
  removeTable(tableId: string): void;
  incrementTableUsage(tableId: string): void;
  decrementTableUsage(tableId: string): void;

  get docs(): unknown[] | undefined;
  initialize(): void;

  docMetaAdded: Subject<string>;
  docMetaRemoved: Subject<string>;
  docMetaUpdated: Subject<void>;
  tableAdded: Subject<string>;
  tableRemoved: Subject<string>;
  tableUpdated: Subject<string>;
}
