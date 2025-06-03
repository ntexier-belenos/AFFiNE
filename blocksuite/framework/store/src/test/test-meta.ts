import { Subject } from 'rxjs';
import type * as Y from 'yjs';

import type {
  DocMeta,
  DocsPropertiesMeta,
  TableMeta,
  TablesIndexMeta,
  WorkspaceMeta,
} from '../extension/index.js';
import { createYProxy } from '../reactive/proxy.js';

type DocCollectionMetaState = {
  pages?: unknown[];
  properties?: DocsPropertiesMeta;
  name?: string;
  avatar?: string;
};

export class TestMeta implements WorkspaceMeta {
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
    });
  };

  private _prevDocs = new Set<string>();

  protected readonly _proxy: DocCollectionMetaState;

  protected readonly _yMap: Y.Map<
    DocCollectionMetaState[keyof DocCollectionMetaState]
  >;

  readonly doc: Y.Doc;

  docMetaAdded = new Subject<string>();

  docMetaRemoved = new Subject<string>();

  docMetaUpdated = new Subject<void>();

  readonly id: string = 'meta';

  // Ajout des propriétés manquantes pour respecter WorkspaceMeta
  tables: TablesIndexMeta = {};
  tableAdded = new Subject<string>();
  tableRemoved = new Subject<string>();
  tableUpdated = new Subject<string>();

  setTables = (tables: TablesIndexMeta) => {
    this.tables = tables;
  };
  addTable = (table: TableMeta) => {
    this.tables[table.id] = table;
    this.tableAdded.next(table.id);
  };
  getTable = (tableId: string) => {
    return this.tables[tableId];
  };
  updateTable = (tableId: string, updates: Partial<TableMeta>) => {
    const table = this.tables[tableId];
    if (!table) return;
    const updatedTable = { ...table, ...updates };
    this.tables[tableId] = updatedTable;
    this.tableUpdated.next(tableId);
  };
  removeTable = (tableId: string) => {
    const table = this.tables[tableId];
    if (table) {
      delete this.tables[tableId];
      this.tableRemoved.next(tableId);
    }
  };
  incrementTableUsage = (_name: string) => {
    // Implémentation factice
  };
  decrementTableUsage = (_name: string) => {
    // Implémentation factice
  };

  get docMetas() {
    if (!this._proxy.pages) {
      return [] as DocMeta[];
    }
    return this._proxy.pages as DocMeta[];
  }

  get docs() {
    return this._proxy.pages;
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

  get yDocs() {
    return this._yMap.get('pages') as unknown as Y.Array<unknown>;
  }

  constructor(doc: Y.Doc) {
    this.doc = doc;
    const map = doc.getMap(this.id) as Y.Map<
      DocCollectionMetaState[keyof DocCollectionMetaState]
    >;
    this._yMap = map;
    this._proxy = createYProxy(map);
    this._yMap.observeDeep(this._handleDocCollectionMetaEvents);
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
    this.doc.transact(() => {
      if (!this.docs) {
        return;
      }
      const docs = this.docs as unknown[];
      if (index === undefined) {
        docs.push(doc);
      } else {
        docs.splice(index, 0, doc);
      }
    }, this.doc.clientID);
  }

  getDocMeta(id: string) {
    return this.docMetas.find(doc => doc.id === id);
  }

  initialize() {
    if (!this._proxy.pages) {
      this._proxy.pages = [];
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
    this.doc.transact(() => {
      if (!this.docs) {
        return;
      }
      this.docs.splice(index, 1);
    }, this.doc.clientID);
  }

  setDocMeta(id: string, props: Partial<DocMeta>) {
    const docs = (this.docs as DocMeta[]) ?? [];
    const index = docs.findIndex((doc: DocMeta) => id === doc.id);

    this.doc.transact(() => {
      if (!this.docs) {
        return;
      }
      if (index === -1) return;

      const doc = this.docs[index] as Record<string, unknown>;
      Object.entries(props).forEach(([key, value]) => {
        doc[key] = value;
      });
    }, this.doc.clientID);
  }

  setProperties(meta: DocsPropertiesMeta) {
    this._proxy.properties = meta;
    this.docMetaUpdated.next();
  }
}
