import {
  createYProxy,
  type DocMeta,
  type DocsPropertiesMeta,
  type TableMeta,
  type TablesIndexMeta,
  type WorkspaceMeta,
} from '@blocksuite/affine/store';
import { Subject } from 'rxjs';
import type * as Y from 'yjs';

type MetaState = {
  pages?: unknown[];
  properties?: DocsPropertiesMeta;
  tables?: TablesIndexMeta;
  name?: string;
  avatar?: string;
};

export class WorkspaceMetaImpl implements WorkspaceMeta {
  /* eslint-disable rxjs/finnish */
  commonFieldsUpdated = new Subject<void>();
  docMetaAdded = new Subject<string>();
  docMetaRemoved = new Subject<string>();
  docMetaUpdated = new Subject<void>();
  tableAdded = new Subject<string>();
  tableRemoved = new Subject<string>();
  tableUpdated = new Subject<string>();
  /* eslint-enable rxjs/finnish */

  private readonly _handleDocCollectionMetaEvents = (
    events: Y.YEvent<Y.Array<unknown> | Y.Text | Y.Map<unknown>>[]
  ) => {
    events.forEach(e => {
      const hasKey = (k: string) =>
        e.target === this._yMap && e.changes.keys.has(k);

      if (
        e.target === this.yDocs ||
        e.target.parent === this.yDocs ||
        hasKey('pages')
      ) {
        this._handleDocMetaEvent();
      }

      if (hasKey('tables')) {
        this._handleTableMetaEvent();
      }

      if (hasKey('name') || hasKey('avatar')) {
        this._handleCommonFieldsEvent();
      }
    });
  };

  private readonly _id: string = 'meta';
  private readonly _doc: Y.Doc;
  private readonly _proxy: MetaState;
  private readonly _yMap: Y.Map<MetaState[keyof MetaState]>;
  private _prevDocs = new Set<string>();

  get avatar() {
    return this._proxy.avatar;
  }

  setAvatar(avatar: string) {
    this._doc.transact(() => {
      this._proxy.avatar = avatar;
    }, this._doc.clientID);
  }

  get name() {
    return this._proxy.name;
  }

  setName(name: string) {
    this._doc.transact(() => {
      this._proxy.name = name;
    }, this._doc.clientID);
  }

  get properties(): DocsPropertiesMeta {
    const meta = this._proxy.properties;
    if (!meta) {
      return {
        tags: {
          options: [],
        },
      };
    }
    return meta;
  }

  setProperties(meta: DocsPropertiesMeta) {
    this._proxy.properties = meta;
    this.docMetaUpdated.next();
  }

  get tables(): TablesIndexMeta {
    const tables = this._proxy.tables;
    if (!tables) {
      return {};
    }
    return tables;
  }

  setTables(tables: TablesIndexMeta) {
    this._proxy.tables = tables;
    this._handleTableMetaEvent();
  }

  addTable(table: TableMeta) {
    this._doc.transact(() => {
      if (!this._proxy.tables) {
        this._proxy.tables = {};
      }
      this._proxy.tables[table.id] = table;
    }, this._doc.clientID);
    this.tableAdded.next(table.id);
  }

  getTable(tableId: string): TableMeta | undefined {
    return this.tables[tableId];
  }

  updateTable(tableId: string, updates: Partial<TableMeta>) {
    const table = this.getTable(tableId);
    if (!table) {
      return;
    }

    this._doc.transact(() => {
      if (!this._proxy.tables) {
        return;
      }
      this._proxy.tables[tableId] = { ...table, ...updates };
    }, this._doc.clientID);
    this.tableUpdated.next(tableId);
  }

  removeTable(tableId: string) {
    this._doc.transact(() => {
      if (!this._proxy.tables) {
        return;
      }
      delete this._proxy.tables[tableId];
    }, this._doc.clientID);
    this.tableRemoved.next(tableId);
  }

  incrementTableUsage(tableId: string) {
    const table = this.getTable(tableId);
    if (table) {
      this.updateTable(tableId, { usageCount: table.usageCount + 1 });
    }
  }

  decrementTableUsage(tableId: string) {
    const table = this.getTable(tableId);
    if (table && table.usageCount > 0) {
      this.updateTable(tableId, { usageCount: table.usageCount - 1 });
    }
  }

  get docMetas() {
    if (!this._proxy.pages) {
      return [] as DocMeta[];
    }
    return this._proxy.pages as DocMeta[];
  }

  get docs() {
    return this._proxy.pages;
  }

  get yDocs() {
    return this._yMap.get('pages') as unknown as Y.Array<unknown>;
  }

  constructor(doc: Y.Doc) {
    this._doc = doc;
    const map = doc.getMap(this._id) as Y.Map<MetaState[keyof MetaState]>;
    this._yMap = map;
    this._proxy = createYProxy(map);
    this._yMap.observeDeep(this._handleDocCollectionMetaEvents);
  }

  private _handleCommonFieldsEvent() {
    this.commonFieldsUpdated.next();
  }

  private _handleTableMetaEvent() {
    // Could add specific table event handling logic here if needed
    // For now, we handle table events individually in the methods
  }

  private _handleDocMetaEvent() {
    const { docMetas, _prevDocs } = this;

    const newDocs = new Set<string>();

    docMetas.forEach(docMeta => {
      if (!_prevDocs.has(docMeta.id)) {
        this.docMetaAdded.next(docMeta.id);
      }
      newDocs.add(docMeta.id);
    });

    _prevDocs.forEach(prevDocId => {
      const isRemoved = newDocs.has(prevDocId) === false;
      if (isRemoved) {
        this.docMetaRemoved.next(prevDocId);
      }
    });

    this._prevDocs = newDocs;

    this.docMetaUpdated.next();
  }

  addDocMeta(doc: DocMeta, index?: number) {
    this._doc.transact(() => {
      if (!this.docs) {
        return;
      }
      const docs = this.docs as unknown[];
      if (index === undefined) {
        docs.push(doc);
      } else {
        docs.splice(index, 0, doc);
      }
    }, this._doc.clientID);
  }

  getDocMeta(id: string) {
    return this.docMetas.find(doc => doc.id === id);
  }

  initialize() {
    if (!this._proxy.pages) {
      this._proxy.pages = [];
    }
    if (!this._proxy.tables) {
      this._proxy.tables = {};
    }
  }

  removeDocMeta(id: string) {
    // you cannot delete a doc if there's no doc
    if (!this.docs) {
      return;
    }

    const docMeta = this.docMetas;
    const index = docMeta.findIndex((doc: DocMeta) => id === doc.id);
    if (index === -1) {
      return;
    }
    this._doc.transact(() => {
      if (!this.docs) {
        return;
      }
      this.docs.splice(index, 1);
    }, this._doc.clientID);
  }

  setDocMeta(id: string, props: Partial<DocMeta>) {
    const docs = (this.docs as DocMeta[]) ?? [];
    const index = docs.findIndex((doc: DocMeta) => id === doc.id);

    this._doc.transact(() => {
      if (!this.docs) {
        return;
      }
      if (index === -1) return;

      const doc = this.docs[index] as Record<string, unknown>;
      Object.entries(props).forEach(([key, value]) => {
        doc[key] = value;
      });
    }, this._doc.clientID);
  }
}
