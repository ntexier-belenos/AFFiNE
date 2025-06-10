import { CaptionedBlockComponent } from '@blocksuite/affine-components/caption';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { DropIndicator } from '@blocksuite/affine-components/drop-indicator';
import { PeekViewProvider } from '@blocksuite/affine-components/peek';
import { toast } from '@blocksuite/affine-components/toast';
import type { DatabaseBlockModel } from '@blocksuite/affine-model';
import { EDGELESS_TOP_CONTENTEDITABLE_SELECTOR } from '@blocksuite/affine-shared/consts';
import {
  DocModeProvider,
  NotificationProvider,
  type TelemetryEventMap,
  TelemetryProvider,
} from '@blocksuite/affine-shared/services';
import { getDropResult } from '@blocksuite/affine-widget-drag-handle';
import {
  createRecordDetail,
  createUniComponentFromWebComponent,
  DataView,
  dataViewCommonStyle,
  type DataViewInstance,
  type DataViewProps,
  type DataViewSelection,
  type DataViewWidget,
  type DataViewWidgetProps,
  defineUniComponent,
  ExternalGroupByConfigProvider,
  renderUniLit,
  type SingleView,
  uniMap,
} from '@blocksuite/data-view';
import { widgetPresets } from '@blocksuite/data-view/widget-presets';
import { Rect } from '@blocksuite/global/gfx';
import {
  CopyIcon,
  DeleteIcon,
  MoreHorizontalIcon,
} from '@blocksuite/icons/lit';
import { type BlockComponent } from '@blocksuite/std';
import { RANGE_SYNC_EXCLUDE_ATTR } from '@blocksuite/std/inline';
import { Slice } from '@blocksuite/store';
import { autoUpdate } from '@floating-ui/dom';
import { computed, signal } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { keyed } from 'lit/directives/keyed.js';
import { nanoid } from 'nanoid';

import { popSideDetail } from './components/layout.js';
import { DatabaseConfigExtension } from './config.js';
import { EditorHostKey } from './context/host-context.js';
import { DatabaseBlockDataSource } from './data-source.js';
import { BlockRenderer } from './detail-panel/block-renderer.js';
import { NoteRenderer } from './detail-panel/note-renderer.js';
import { DatabaseSelection } from './selection.js';
import { currentViewStorage } from './utils/current-view.js';
import { getSingleDocIdFromText } from './utils/title-doc.js';
import type { DatabaseViewExtensionOptions } from './view';

export class DatabaseBlockComponent extends CaptionedBlockComponent<DatabaseBlockModel> {
  static override styles = css`
    ${unsafeCSS(dataViewCommonStyle('affine-database'))}
    affine-database {
      display: block;
      border-radius: 8px;
      background-color: var(--affine-background-primary-color);
      padding: 8px;
      margin: 8px -8px -8px;
    }

    .database-block-selected {
      background-color: var(--affine-hover-color);
      border-radius: 4px;
    }

    .database-ops {
      padding: 2px;
      border-radius: 4px;
      display: flex;
      cursor: pointer;
      align-items: center;
      height: max-content;
    }

    .database-ops svg {
      width: 16px;
      height: 16px;
      color: var(--affine-icon-color);
    }

    .database-ops:hover {
      background-color: var(--affine-hover-color);
    }

    @media print {
      .database-ops {
        display: none;
      }

      .database-header-bar {
        display: none !important;
      }
    }
  `;

  private readonly _titleCache = new Map<
    string,
    { title: string; loading: boolean }
  >();
  private readonly _pendingTitleLoads = new Set<string>();
  private _currentMenuHandler: ReturnType<typeof popMenu> | null = null;

  private readonly _clickDatabaseOps = (e: MouseEvent) => {
    const currentSource = this._getCurrentSourceInfo();
    const availableTables = this._getAvailableTablesFromWorkspace();

    this._loadTitlesAsync(availableTables).catch(() => {});

    const options = this.optionsConfig.configure(this.model, {
      refreshData: (() => {
        return async () => {
          this._titleCache.clear();
          this._pendingTitleLoads.clear();

          const refreshedTables = this._getAvailableTablesFromWorkspace();

          await this._loadTitlesAsync(refreshedTables);
          const refreshedItems = [
            menu.input({
              initialValue: this.model.props.title.toString(),
              placeholder: 'Database title',
              onChange: text => {
                this.model.props.title.replace(
                  0,
                  this.model.props.title.length,
                  text
                );
              },
            }),

            menu.subMenu({
              name: 'Source',
              options: {
                title: { text: 'Select database source' },
                items: [
                  menu.action({
                    name: 'New Database',
                    select: () => this._handleCreateNewDatabase(),
                  }),
                  menu.group({
                    items: refreshedTables.map(table => {
                      const cachedResult = this._titleCache.get(table.blockId);
                      const blockTitle =
                        cachedResult?.title ||
                        this._getDynamicTitleForBlock(table.blockId, table) ||
                        `Untitled Database (${table.id.slice(-6)})`;

                      const currentSource = this._getCurrentSourceInfo();
                      const isCurrentSource =
                        currentSource?.tableId === table.id;

                      return menu.action({
                        name: blockTitle,
                        isSelected: isCurrentSource,
                        select: () => this._handleSwitchToTable(table),
                      });
                    }),
                  }),
                ],
              },
              refreshData: (() => {
                return async () => {
                  const freshTables = this._getAvailableTablesFromWorkspace();
                  await this._loadTitlesAsync(freshTables);

                  return [
                    menu.action({
                      name: 'New Database',
                      select: () => this._handleCreateNewDatabase(),
                    }),
                    menu.group({
                      items: freshTables.map(table => {
                        const cachedResult = this._titleCache.get(
                          table.blockId
                        );
                        const blockTitle =
                          cachedResult?.title ||
                          this._getDynamicTitleForBlock(table.blockId, table) ||
                          `Untitled Database (${table.id.slice(-6)})`;

                        const currentSource = this._getCurrentSourceInfo();
                        const isCurrentSource =
                          currentSource?.tableId === table.id;

                        return menu.action({
                          name: blockTitle,
                          isSelected: isCurrentSource,
                          select: () => this._handleSwitchToTable(table),
                        });
                      }),
                    }),
                  ];
                };
              })(),
            }),
            menu.action({
              prefix: CopyIcon(),
              name: 'Copy',
              select: () => {
                const slice = Slice.fromModels(this.store, [this.model]);
                this.std.clipboard
                  .copySlice(slice)
                  .then(() => {
                    toast(this.host, 'Copied to clipboard');
                  })
                  .catch(() => {});
              },
            }),
            menu.group({
              items: [
                menu.action({
                  prefix: DeleteIcon(),
                  class: {
                    'delete-item': true,
                  },
                  name: 'Delete Database',
                  select: () => {
                    this._handleDatabaseDeletion();
                  },
                }),
              ],
            }),
          ];

          const configuredOptions = this.optionsConfig.configure(this.model, {
            items: refreshedItems,
          });

          return configuredOptions.items;
        };
      })(),
      items: [
        menu.input({
          initialValue: this.model.props.title.toString(),
          placeholder: 'Database title',
          onChange: text => {
            this.model.props.title.replace(
              0,
              this.model.props.title.length,
              text
            );
          },
        }),
        menu.subMenu({
          name: 'Source',
          options: {
            title: { text: 'Select database source' },
            items: [
              menu.action({
                name: 'New Database',
                select: () => this._handleCreateNewDatabase(),
              }),
              menu.group({
                items: availableTables.map(table => {
                  const cachedResult = this._titleCache.get(table.blockId);
                  let blockTitle: string;

                  if (cachedResult && !cachedResult.loading) {
                    blockTitle = cachedResult.title;
                  } else {
                    blockTitle = this._getDynamicTitleForBlock(
                      table.blockId,
                      table
                    );

                    const isUnresolved =
                      blockTitle === table.blockId ||
                      blockTitle.includes(table.blockId);

                    if (isUnresolved) {
                      blockTitle = `Loading... (${table.id.slice(-6)})`;
                      this._titleCache.set(table.blockId, {
                        title: blockTitle,
                        loading: true,
                      });

                      this._pendingTitleLoads.add(table.blockId);

                      this._loadTitleAsync(table.blockId, table)
                        .then(resolvedTitle => {
                          this._titleCache.set(table.blockId, {
                            title: resolvedTitle,
                            loading: false,
                          });

                          this._pendingTitleLoads.delete(table.blockId);

                          if (this._pendingTitleLoads.size === 0) {
                            this._triggerMenuRefresh();
                          }
                        })
                        .catch(() => {
                          this._pendingTitleLoads.delete(table.blockId);

                          const fallbackTitle =
                            table.title ||
                            `Untitled Database (${table.id.slice(-6)})`;
                          this._titleCache.set(table.blockId, {
                            title: fallbackTitle,
                            loading: false,
                          });

                          if (this._pendingTitleLoads.size === 0) {
                            this._triggerMenuRefresh();
                          }
                        });
                    } else {
                      this._titleCache.set(table.blockId, {
                        title: blockTitle,
                        loading: false,
                      });
                    }
                  }

                  const isCurrentSource = currentSource?.tableId === table.id;

                  return menu.action({
                    name: blockTitle,
                    isSelected: isCurrentSource,
                    select: () => this._handleSwitchToTable(table),
                  });
                }),
              }),
            ],
          },
          refreshData: (() => {
            return async () => {
              const freshTables = this._getAvailableTablesFromWorkspace();
              await this._loadTitlesAsync(freshTables);

              return [
                menu.action({
                  name: 'New Database',
                  select: () => this._handleCreateNewDatabase(),
                }),
                menu.group({
                  items: freshTables.map(table => {
                    const cachedResult = this._titleCache.get(table.blockId);
                    const blockTitle =
                      cachedResult?.title ||
                      this._getDynamicTitleForBlock(table.blockId, table) ||
                      `Untitled Database (${table.id.slice(-6)})`;

                    const currentSource = this._getCurrentSourceInfo();
                    const isCurrentSource = currentSource?.tableId === table.id;

                    return menu.action({
                      name: blockTitle,
                      isSelected: isCurrentSource,
                      select: () => this._handleSwitchToTable(table),
                    });
                  }),
                }),
              ];
            };
          })(),
        }),
        menu.action({
          prefix: CopyIcon(),
          name: 'Copy',
          select: () => {
            const slice = Slice.fromModels(this.store, [this.model]);
            this.std.clipboard
              .copySlice(slice)
              .then(() => {
                toast(this.host, 'Copied to clipboard');
              })
              .catch(() => {});
          },
        }),
        menu.group({
          items: [
            menu.action({
              prefix: DeleteIcon(),
              class: {
                'delete-item': true,
              },
              name: 'Delete Database',
              select: () => {
                this._handleDatabaseDeletion();
              },
            }),
          ],
        }),
      ],
    });

    options.onClose = () => {
      this._currentMenuHandler = null;
    };

    this._currentMenuHandler = popMenu(
      popupTargetFromElement(e.currentTarget as HTMLElement),
      {
        options,
      }
    );
  };

  private _dataSource?: DatabaseBlockDataSource;

  private _dataSourceRefreshCounter = 0;

  private readonly dataView = new DataView();

  private readonly renderTitle = (dataViewMethod: DataViewInstance) => {
    const addRow = () => dataViewMethod.addRow?.('start');

    let titleToDisplay = this.model.props.title;

    if (this.model.props.tableId) {
      const sourceModel = this._resolveTargetModel();
      if (sourceModel && sourceModel.props.title) {
        titleToDisplay = sourceModel.props.title;
      } else {
        // Could not resolve source model
      }
    }

    return html` <affine-database-title
      style="overflow: hidden"
      .titleText="${titleToDisplay}"
      .readonly="${this.dataSource.readonly$.value}"
      .onPressEnterKey="${addRow}"
    ></affine-database-title>`;
  };

  _bindHotkey: DataViewProps['bindHotkey'] = hotkeys => {
    return {
      dispose: this.host.event.bindHotkey(hotkeys, {
        blockId: this.topContenteditableElement?.blockId ?? this.blockId,
      }),
    };
  };

  _handleEvent: DataViewProps['handleEvent'] = (name, handler) => {
    return {
      dispose: this.host.event.add(name, handler, {
        blockId: this.blockId,
      }),
    };
  };

  createTemplate = (
    data: {
      view: SingleView;
      rowId: string;
    },
    openDoc: (docId: string) => void
  ) => {
    return createRecordDetail({
      ...data,
      openDoc,
      detail: {
        header: uniMap(
          createUniComponentFromWebComponent(BlockRenderer),
          props => ({
            ...props,
            host: this.host,
          })
        ),
        note: uniMap(
          createUniComponentFromWebComponent(NoteRenderer),
          props => ({
            ...props,
            model: this.model,
            host: this.host,
          })
        ),
      },
    });
  };

  headerWidget: DataViewWidget = defineUniComponent(
    (props: DataViewWidgetProps) => {
      return html`
        <div style="margin-bottom: 16px;display:flex;flex-direction: column">
          <div
            style="display:flex;gap:12px;margin-bottom: 8px;align-items: center"
          >
            ${this.renderTitle(props.dataViewInstance)}
            ${this.renderDatabaseOps()}
          </div>
          <div
            style="display:flex;align-items:center;justify-content: space-between;gap: 12px"
            class="database-header-bar"
          >
            <div style="flex:1">
              ${renderUniLit(widgetPresets.viewBar, {
                ...props,
                onChangeView: id => {
                  currentViewStorage.setCurrentView(this.blockId, id);
                },
              })}
            </div>
            ${renderUniLit(this.toolsWidget, props)}
          </div>
          ${renderUniLit(widgetPresets.quickSettingBar, props)}
        </div>
      `;
    }
  );

  indicator = new DropIndicator();

  onDrag = (evt: MouseEvent, id: string): (() => void) => {
    const result = getDropResult(evt);
    if (result && result.rect) {
      document.body.append(this.indicator);
      this.indicator.rect = Rect.fromLWTH(
        result.rect.left,
        result.rect.width,
        result.rect.top,
        result.rect.height
      );
      return () => {
        this.indicator.remove();
        const model = this.store.getBlock(id)?.model;
        const target = result.modelState.model;
        let parent = this.store.getParent(target.id);
        const shouldInsertIn = result.placement === 'in';
        if (shouldInsertIn) {
          parent = target;
        }
        if (model && target && parent) {
          if (shouldInsertIn) {
            this.store.moveBlocks([model], parent);
          } else {
            this.store.moveBlocks(
              [model],
              parent,
              target,
              result.placement === 'before'
            );
          }
        }
      };
    }
    this.indicator.remove();
    return () => {};
  };

  setSelection = (selection: DataViewSelection | undefined) => {
    if (selection) {
      getSelection()?.removeAllRanges();
    }
    this.selection.setGroup(
      'note',
      selection
        ? [
            new DatabaseSelection({
              blockId: this.blockId,
              viewSelection: selection,
            }),
          ]
        : []
    );
  };

  toolsWidget: DataViewWidget = widgetPresets.createTools({
    table: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
    kanban: [
      widgetPresets.tools.filter,
      widgetPresets.tools.sort,
      widgetPresets.tools.search,
      widgetPresets.tools.viewOptions,
      widgetPresets.tools.tableAddRow,
    ],
  });

  viewSelection$ = computed(() => {
    const databaseSelection = this.selection.value.find(
      (selection): selection is DatabaseSelection => {
        if (selection.blockId !== this.blockId) {
          return false;
        }
        return selection instanceof DatabaseSelection;
      }
    );
    return databaseSelection?.viewSelection;
  });

  virtualPadding$ = signal(0);

  get dataSource(): DatabaseBlockDataSource {
    if (!this._dataSource) {
      let modelToUse = this.model;

      if (this.model.props.tableId) {
        const sourceModel = this._resolveTargetModel();
        if (sourceModel) {
          modelToUse = sourceModel;
        } else {
          // Could not resolve source model, using local model
        }
      }

      this._dataSource = new DatabaseBlockDataSource(
        modelToUse,
        dataSource => {
          dataSource.serviceSet(EditorHostKey, this.host);
          this.std.provider
            .getAll(ExternalGroupByConfigProvider)
            .forEach(config => {
              dataSource.serviceSet(
                ExternalGroupByConfigProvider(config.name),
                config
              );
            });
        },
        this._dataSourceRefreshCounter
      );

      const id = currentViewStorage.getCurrentView(this.model.id);
      if (id && this.dataSource.viewManager.viewGet(id)) {
        this.dataSource.viewManager.setCurrentView(id);
      }
    }
    return this._dataSource;
  }

  get optionsConfig(): DatabaseViewExtensionOptions {
    return {
      configure: (_model, options) => options,
      ...this.std.getOptional(DatabaseConfigExtension.identifier),
    };
  }

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>(
        EDGELESS_TOP_CONTENTEDITABLE_SELECTOR
      );
    }
    return this.rootComponent;
  }

  get view() {
    return this.dataView.expose;
  }

  private renderDatabaseOps() {
    if (this.dataSource.readonly$.value) {
      return nothing;
    }
    return html` <div class="database-ops" @click="${this._clickDatabaseOps}">
      ${MoreHorizontalIcon()}
    </div>`;
  }

  override connectedCallback() {
    super.connectedCallback();

    this.setAttribute(RANGE_SYNC_EXCLUDE_ATTR, 'true');
    this.listenFullWidthChange();
  }

  listenFullWidthChange() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return;
    }
    this.disposables.add(
      autoUpdate(this.host, this, () => {
        const padding =
          this.getBoundingClientRect().left -
          this.host.getBoundingClientRect().left;
        this.virtualPadding$.value = Math.max(0, padding - 72);
      })
    );
  }

  override renderBlock() {
    const peekViewService = this.std.getOptional(PeekViewProvider);
    const telemetryService = this.std.getOptional(TelemetryProvider);

    // Check and migrate this block if needed
    this.checkAndMigrateBlock();
    this.ensureTableRegistered();

    return html`
      <div
        contenteditable="false"
        style="position: relative;background-color: var(--affine-background-primary-color);border-radius: 4px"
      >
        ${keyed(
          `dataview-${this.model.id}-${this._dataSourceRefreshCounter}`,
          this.dataView.render({
            virtualPadding$: this.virtualPadding$,
            bindHotkey: this._bindHotkey,
            handleEvent: this._handleEvent,
            selection$: this.viewSelection$,
            setSelection: this.setSelection,
            dataSource: this.dataSource,
            headerWidget: this.headerWidget,
            onDrag: this.onDrag,
            clipboard: this.std.clipboard,
            notification: {
              toast: message => {
                const notification = this.std.getOptional(NotificationProvider);
                if (notification) {
                  notification.toast(message);
                } else {
                  toast(this.host, message);
                }
              },
            },
            eventTrace: (key, params) => {
              telemetryService?.track(key, {
                ...(params as TelemetryEventMap[typeof key]),
                blockId: this.blockId,
              });
            },
            detailPanelConfig: {
              openDetailPanel: (target, data) => {
                if (peekViewService) {
                  const openDoc = (docId: string) => {
                    return peekViewService.peek({
                      docId,
                      databaseId: this.blockId,
                      databaseDocId: this.model.store.id,
                      databaseRowId: data.rowId,
                      target: this,
                    });
                  };
                  const doc = getSingleDocIdFromText(
                    this.model.store.getBlock(data.rowId)?.model?.text
                  );
                  if (doc) {
                    return openDoc(doc);
                  }
                  const abort = new AbortController();
                  return new Promise<void>(focusBack => {
                    peekViewService
                      .peek(
                        {
                          target,
                          template: this.createTemplate(data, docId => {
                            openDoc(docId).then(focusBack).catch(focusBack);
                          }),
                        },
                        { abortSignal: abort.signal }
                      )
                      .then(focusBack)
                      .catch(focusBack);
                  });
                } else {
                  return popSideDetail(this.createTemplate(data, () => {}));
                }
              },
            },
          })
        )}
      </div>
    `;
  }

  /**
   * Check and migrate this specific database block if needed
   */
  private checkAndMigrateBlock() {
    const currentTableId = this.model.props?.tableId;

    if (!currentTableId) {
      const tableId = nanoid();

      this.store.transact(() => {
        this.model.props.tableId = tableId;
      });

      this.dispatchEvent(
        new CustomEvent('database-migrated', {
          detail: {
            pageId: this.store.id,
            blockId: this.model.id,
            tableId: tableId,
          },
          bubbles: true,
        })
      );
    } else {
      this.dispatchEvent(
        new CustomEvent('database-ready', {
          detail: {
            pageId: this.store.id,
            blockId: this.model.id,
            tableId: currentTableId,
          },
          bubbles: true,
        })
      );
    }
  }

  /**
   * Ensures that this table is registered in the workspace index.
   * This method is called on every render to guarantee that tables
   * with tableIds are always present in the workspace index, regardless
   * of how/when the tableId was generated.
   */
  private ensureTableRegistered() {
    const tableId = this.model.props?.tableId;
    if (!tableId) {
      return;
    }

    this.dispatchEvent(
      new CustomEvent('database-ensure-indexed', {
        detail: {
          pageId: this.store.id,
          blockId: this.model.id,
          tableId: tableId,
        },
        bubbles: true,
      })
    );
  }

  /**
   * Get current source info for this database
   */
  private _getCurrentSourceInfo(): { tableId: string } | null {
    const tableId = this.model.props.tableId;
    if (!tableId) {
      return null;
    }
    return { tableId };
  }

  /**
   * Get available tables from workspace metadata
   */
  private _getAvailableTablesFromWorkspace(): Array<{
    id: string;
    blockId: string;
    title?: string;
  }> {
    try {
      const workspace = this.store.workspace;

      if (!workspace?.meta?.tables) {
        return [];
      }

      const tables = Object.values(workspace.meta.tables);

      return tables;
    } catch {
      return [];
    }
  }

  /**
   * Resolve target model when this database is linked to a source
   */
  private _resolveTargetModel(): DatabaseBlockModel | null {
    const tableId = this.model.props.tableId;
    if (!tableId) {
      return null;
    }

    try {
      const workspace = this.store.workspace;
      if (!workspace?.meta?.tables) {
        return null;
      }

      const tableMeta = workspace.meta.tables[tableId];
      if (!tableMeta?.blockId) {
        return null;
      }

      const sourceBlock = this.store.getBlock(tableMeta.blockId);
      if (
        !sourceBlock?.model ||
        sourceBlock.model.flavour !== 'affine:database'
      ) {
        return null;
      }

      return sourceBlock.model as DatabaseBlockModel;
    } catch {
      return null;
    }
  }

  /**
   * Get dynamic title for source block - fast version with immediate results
   */
  private _getDynamicTitleForBlock(blockId: string, tableMeta?: any): string {
    try {
      let pageId = tableMeta?.pageId;
      let actualBlockId = tableMeta?.blockId || blockId;

      if (!pageId && blockId.includes(':')) {
        const parts = blockId.split(':');
        if (parts.length === 2) {
          pageId = parts[0];
          actualBlockId = parts[1];
        }
      }

      // Try local resolution first if no pageId
      if (!pageId) {
        const localBlock = this.store.getBlock(actualBlockId);
        if (localBlock?.model?.flavour === 'affine:database') {
          const localTitle = (localBlock.model.props as any).title?.toString();
          if (localTitle && localTitle.trim()) {
            return localTitle.trim();
          }
        }
        return tableMeta?.title || blockId;
      }

      // Cross-document check only if document is already loaded
      const doc = this.store.workspace?.getDoc(pageId);
      if (doc?.loaded) {
        const store = doc.getStore();
        const block = store?.getBlock(actualBlockId);

        if (block?.model && block.model.flavour === 'affine:database') {
          const props = block.model.props as any;
          const title = props.title?.toString();
          if (title && title.trim()) {
            return title.trim();
          }
        }
      }

      // Immediate fallback
      const fallbackTitle = tableMeta?.title || blockId;
      return fallbackTitle;
    } catch {
      return tableMeta?.title || blockId;
    }
  }

  /**
   * Load title asynchronously for cross-document database block
   */
  private async _loadTitleAsync(
    blockId: string,
    tableMeta?: any
  ): Promise<string> {
    try {
      let pageId = tableMeta?.pageId;
      let actualBlockId = tableMeta?.blockId || blockId;

      if (!pageId && blockId.includes(':')) {
        const parts = blockId.split(':');
        if (parts.length === 2) {
          pageId = parts[0];
          actualBlockId = parts[1];
        }
      }

      if (!pageId) {
        return tableMeta?.title || blockId;
      }

      const doc = this.store.workspace?.getDoc(pageId);
      if (!doc) {
        return tableMeta?.title || blockId;
      }

      if (!doc.loaded) {
        doc.load();
      }

      const delays = [100, 300, 500, 1000, 2000];

      for (const delay of delays) {
        await new Promise(resolve => setTimeout(resolve, delay));

        if (doc.loaded) {
          const store = doc.getStore();
          const block = store?.getBlock(actualBlockId);

          if (block?.model && block.model.flavour === 'affine:database') {
            const props = block.model.props as any;
            const title = props.title?.toString();
            if (title && title.trim()) {
              return title.trim();
            }
          }
        }
      }

      return tableMeta?.title || blockId;
    } catch {
      return tableMeta?.title || blockId;
    }
  }

  /**
   * Load titles asynchronously for all tables
   */
  private async _loadTitlesAsync(
    tables: Array<{ id: string; blockId: string; title?: string }>
  ): Promise<void> {
    const tablesToLoad = tables.filter(table => {
      const cached = this._titleCache.get(table.blockId);
      return !cached || cached.loading;
    });

    if (tablesToLoad.length === 0) {
      return;
    }

    const loadPromises = tablesToLoad.map(async table => {
      const blockId = table.blockId;

      this._titleCache.set(blockId, {
        title: `Loading... (${table.id.slice(-6)})`,
        loading: true,
      });
      this._pendingTitleLoads.add(blockId);

      try {
        const title = await this._loadTitleAsync(blockId, table);
        this._titleCache.set(blockId, { title, loading: false });
      } catch {
        const fallbackTitle =
          table.title || `Untitled Database (${table.id.slice(-6)})`;
        this._titleCache.set(blockId, { title: fallbackTitle, loading: false });
      } finally {
        this._pendingTitleLoads.delete(blockId);
      }
    });

    await Promise.allSettled(loadPromises);

    this._triggerMenuRefresh();
  }

  /**
   * Trigger menu refresh when async titles are loaded
   */
  private _triggerMenuRefresh(): void {
    if (this._currentMenuHandler) {
      this._currentMenuHandler.refresh().catch(() => {
        if (this._currentMenuHandler) {
          this._currentMenuHandler.reopen();
        }
      });
    }
  }

  /**
   * Handle switching to a different table source
   */
  private _handleSwitchToTable(table: any): void {
    this.store.transact(() => {
      this.model.props.tableId = table.id;
    });

    this._dispatchUsageEvent('database-usage-increased', table.id);

    const cachedResult = this._titleCache.get(table.blockId);
    const dynamicTitle =
      cachedResult?.title ||
      this._getDynamicTitleForBlock(table.blockId, table) ||
      `Untitled Database (${table.id.slice(-6)})`;

    toast(this.host, `Switched to database: ${dynamicTitle}`);

    this._refreshDataSource();

    setTimeout(() => {
      const currentDataSource = this._dataSource;
      if (currentDataSource && currentDataSource.model.id !== table.blockId) {
        this._forceDataSourceRecreation();
      }
    }, 500);
  }

  private _handleCreateNewDatabase(): void {
    this.store.transact(() => {
      delete this.model.props.tableId;
    });

    toast(this.host, 'Switched to new database');

    this._refreshDataSource();

    setTimeout(() => {
      const currentDataSource = this._dataSource;
      if (currentDataSource && this.model.props.tableId) {
        this._forceDataSourceRecreation();
      }
    }, 500);
  }

  /**
   * Handle database deletion with usage protection
   */
  private _handleDatabaseDeletion(): void {
    const currentSource = this._getCurrentSourceInfo();

    if (currentSource) {
      this._checkUsageBeforeDeletion(currentSource.tableId);
    }

    this.model.children.slice().forEach(block => {
      this.store.deleteBlock(block);
    });
    this.store.deleteBlock(this.model);
  }

  /**
   * Check usage count before allowing deletion
   */
  private _checkUsageBeforeDeletion(tableId: string): void {
    try {
      const workspace = this.store.workspace;
      const table = workspace?.meta?.getTable?.(tableId);

      if (table && table.usageCount > 1) {
        toast(
          this.host,
          `Cannot delete database. It is being used in ${table.usageCount - 1} other view(s).`
        );
        throw new Error('Database is in use');
      }
    } catch {
      // Error checking usage
    }
  }

  /**
   * Dispatch usage events for workspace metadata management
   */
  private _dispatchUsageEvent(eventType: string, tableId: string): void {
    const event = new CustomEvent(eventType, {
      detail: { tableId },
      bubbles: true,
    });
    this.dispatchEvent(event);
  }

  /**
   * Force data source refresh when source changes
   */
  private _refreshDataSource(): void {
    this._dataSourceRefreshCounter++;
    this._dataSource = undefined;

    this.requestUpdate();

    setTimeout(() => {
      const currentPadding = this.virtualPadding$.value;
      this.virtualPadding$.value = currentPadding + 0.001;

      this.requestUpdate();

      requestAnimationFrame(() => {
        this.virtualPadding$.value = currentPadding;
        this.requestUpdate();
      });
    }, 0);
  }

  private _forceDataSourceRecreation(): void {
    this._dataSourceRefreshCounter += 10;
    this._dataSource = undefined;

    this.requestUpdate();

    setTimeout(() => {
      this.requestUpdate();

      setTimeout(() => {
        this.requestUpdate();
      }, 100);
    }, 100);
  }

  override accessor useZeroWidth = true;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database': DatabaseBlockComponent;
  }
}
