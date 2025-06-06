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

  private readonly _clickDatabaseOps = (e: MouseEvent) => {
    const currentSource = this._getCurrentSourceInfo();
    const availableTables = this._getAvailableTablesFromWorkspace();

    console.log('[DatabaseBlockComponent] Current source:', currentSource);
    console.log(
      '[DatabaseBlockComponent] Available tables from workspace:',
      availableTables
    );

    const options = this.optionsConfig.configure(this.model, {
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
        // Source menu with workspace tables
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
                  const blockTitle =
                    this._getDynamicTitleForBlock(table.blockId) ||
                    `Untitled Database (${table.id.slice(-6)})`;
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
              .catch(console.error);
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

    popMenu(popupTargetFromElement(e.currentTarget as HTMLElement), {
      options,
    });
  };

  private _dataSource?: DatabaseBlockDataSource;

  private readonly dataView = new DataView();

  private readonly renderTitle = (dataViewMethod: DataViewInstance) => {
    const addRow = () => dataViewMethod.addRow?.('start');

    // Determine which title to display
    let titleToDisplay = this.model.props.title;
    let displayName = 'local database';

    // If this database has a tableId, it's linked to a source database
    if (this.model.props.tableId) {
      const sourceModel = this._resolveTargetModel();
      if (sourceModel && sourceModel.props.title) {
        titleToDisplay = sourceModel.props.title;
        displayName = 'source database';
        console.log(
          '[DatabaseBlock] Using title from source database:',
          titleToDisplay?.toString()
        );
      } else {
        console.warn(
          '[DatabaseBlock] Could not resolve source model for tableId:',
          this.model.props.tableId
        );
      }
    }

    // Logs pour diagnostiquer le rendu du titre
    console.log('[DatabaseBlock] Rendering title for', displayName, ':', {
      blockId: this.model.id,
      tableId: this.model.props.tableId,
      title: titleToDisplay?.toString(),
      readonly: this.dataSource.readonly$.value,
    });

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
      const tableId = this.model.props?.tableId;

      // Logs pour diagnostiquer l'affichage de l'ID de table
      console.log('[DatabaseBlock] Rendering headerWidget for database:', {
        blockId: this.model.id,
        title: this.model.props.title?.toString(),
        tableId: tableId,
        hasTableId: !!tableId,
        allProps: Object.keys(this.model.props || {}),
        propsValues: this.model.props,
      });

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
      // Determine which model to use for the data source
      let modelToUse = this.model;

      // If this database has a tableId, use the source model for data
      if (this.model.props.tableId) {
        const sourceModel = this._resolveTargetModel();
        if (sourceModel) {
          modelToUse = sourceModel;
          console.log(
            '[DatabaseBlockComponent] Using source model for data source:',
            modelToUse.id
          );
        } else {
          console.warn(
            '[DatabaseBlockComponent] Could not resolve source model, using local model'
          );
        }
      } else {
        console.log(
          '[DatabaseBlockComponent] Using local model for data source:',
          modelToUse.id
        );
      }

      this._dataSource = new DatabaseBlockDataSource(modelToUse, dataSource => {
        dataSource.serviceSet(EditorHostKey, this.host);
        this.std.provider
          .getAll(ExternalGroupByConfigProvider)
          .forEach(config => {
            dataSource.serviceSet(
              ExternalGroupByConfigProvider(config.name),
              config
            );
          });
      });
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

    // Ensure table is registered in workspace index on every render
    this.ensureTableRegistered();

    // Logs pour diagnostiquer le rendu du bloc de base de données
    console.log('[DatabaseBlock] Rendering database block:', {
      blockId: this.model.id,
      title: this.model.props.title?.toString(),
      tableId: this.model.props?.tableId,
      hasHeaderWidget: !!this.headerWidget,
    });

    return html`
      <div
        contenteditable="false"
        style="position: relative;background-color: var(--affine-background-primary-color);border-radius: 4px"
      >
        ${this.dataView.render({
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
                          // abort.abort();
                          openDoc(docId).then(focusBack).catch(focusBack);
                        }),
                      },
                      { abortSignal: abort.signal }
                    )
                    .then(focusBack)
                    .catch(focusBack);
                });
              } else {
                return popSideDetail(
                  this.createTemplate(data, () => {
                    //
                  })
                );
              }
            },
          },
        })}
      </div>
    `;
  }

  /**
   * Check and migrate this specific database block if needed
   */
  private checkAndMigrateBlock() {
    const currentTableId = this.model.props?.tableId;

    if (!currentTableId) {
      console.log(
        '[DatabaseBlock] Block needs migration, generating tableId...',
        {
          blockId: this.model.id,
          title: this.model.props.title?.toString(),
        }
      );

      // Generate new tableId
      const tableId = nanoid();

      // Update the block with tableId using store transaction
      this.store.transact(() => {
        this.model.props.tableId = tableId;
      });

      console.log('[DatabaseBlock] Block migrated with tableId:', {
        blockId: this.model.id,
        tableId: tableId,
        title: this.model.props.title?.toString(),
      });

      // Emit a custom event that the workspace services can listen to
      // This allows the table to be registered in the workspace index
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
      console.log('[DatabaseBlock] Block already has tableId:', {
        blockId: this.model.id,
        tableId: currentTableId,
      });

      // Also emit event for existing tables to ensure they're registered
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
      // No tableId yet, nothing to register
      return;
    }

    // Emit an event to request registration check
    // The workspace services will check if this table is already indexed
    // and register it if missing
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

    console.log('[DatabaseBlock] Requested table registration check:', {
      blockId: this.model.id,
      tableId: tableId,
      title: this.model.props.title?.toString(),
    });
  }

  /**
   * Get current source information for this database
   */
  private _getCurrentSourceInfo(): { tableId: string } | null {
    const tableId = this.model.props.tableId;
    if (!tableId) {
      console.log('[DatabaseBlockComponent] No tableId found in model props');
      return null;
    }
    return { tableId };
  }

  /**
   * Get available tables from workspace meta
   */
  private _getAvailableTablesFromWorkspace(): any[] {
    try {
      // Try to access workspace meta through the store
      const workspace = this.store.workspace;
      if (!workspace?.meta?.tables) {
        console.log('[DatabaseBlockComponent] No workspace meta tables found');
        return [];
      }

      const tables = Object.values(workspace.meta.tables);
      console.log(
        '[DatabaseBlockComponent] Found tables in workspace meta:',
        tables
      );
      return tables;
    } catch (error) {
      console.error(
        '[DatabaseBlockComponent] Error accessing workspace meta:',
        error
      );
      return [];
    }
  }

  /**
   * Resolve the target model when this database is linked to a source
   * Returns the source database model or null if not found
   */
  private _resolveTargetModel(): DatabaseBlockModel | null {
    const tableId = this.model.props.tableId;
    if (!tableId) {
      return null;
    }

    try {
      // Get the table meta from workspace
      const workspace = this.store.workspace;
      if (!workspace?.meta?.tables) {
        console.warn('[DatabaseBlockComponent] No workspace meta tables found');
        return null;
      }

      const tableMeta = workspace.meta.tables[tableId];
      if (!tableMeta?.blockId) {
        console.warn(
          '[DatabaseBlockComponent] No table meta or blockId found for tableId:',
          tableId
        );
        return null;
      }

      // Get the source block using the blockId
      const sourceBlock = this.store.getBlock(tableMeta.blockId);
      if (
        !sourceBlock?.model ||
        sourceBlock.model.flavour !== 'affine:database'
      ) {
        console.warn(
          '[DatabaseBlockComponent] Source block not found or not a database:',
          tableMeta.blockId
        );
        return null;
      }

      console.log(
        '[DatabaseBlockComponent] Resolved target model for tableId:',
        tableId,
        'blockId:',
        tableMeta.blockId
      );
      return sourceBlock.model as DatabaseBlockModel;
    } catch (error) {
      console.error(
        '[DatabaseBlockComponent] Error resolving target model:',
        error
      );
      return null;
    }
  }

  /**
   * Get dynamic title for a block by blockId
   * Retrieves the title from the database block model
   */
  private _getDynamicTitleForBlock(blockId: string): string | null {
    try {
      const block = this.store.getBlock(blockId);
      if (!block?.model) {
        console.warn(
          '[DatabaseBlockComponent] Block or model not found for blockId:',
          blockId
        );
        return null;
      }

      // For database blocks, get title from the model's title property
      if (block.model.flavour === 'affine:database') {
        const databaseModel = block.model as DatabaseBlockModel;

        // The title is a Text object, we need to convert it to string
        if (databaseModel.props.title) {
          const titleText = databaseModel.props.title.toString();
          if (titleText && titleText.trim()) {
            console.log(
              '[DatabaseBlockComponent] Found title for database block:',
              titleText.trim()
            );
            return titleText.trim();
          }
        }

        console.log(
          '[DatabaseBlockComponent] No title found for database block:',
          blockId
        );
        return null;
      }

      // For other block types with title property
      if ('title' in block.model.props && block.model.props.title) {
        const titleProperty = block.model.props.title as any;
        if (titleProperty && typeof titleProperty.toString === 'function') {
          const titleText = titleProperty.toString();
          if (titleText && titleText.trim()) {
            return titleText.trim();
          }
        }
      }

      console.log(
        '[DatabaseBlockComponent] No title property found for block:',
        blockId,
        block.model.flavour
      );
      return null;
    } catch (error) {
      console.error(
        '[DatabaseBlockComponent] Error getting block title:',
        error
      );
      return null;
    }
  }

  /**
   * Handle switching to a different table source
   */
  private _handleSwitchToTable(table: any): void {
    console.log('[DatabaseBlockComponent] Switching to table:', table);

    // Update the tableId property
    this.model.props.tableId = table.id;

    // Increment usage count for new source
    this._dispatchUsageEvent('database-usage-increased', table.id);

    // Get dynamic title for display
    const dynamicTitle =
      this._getDynamicTitleForBlock(table.blockId) ||
      `Untitled Database (${table.id.slice(-6)})`;

    // Show success toast
    toast(this.host, `Switched to database: ${dynamicTitle}`);

    // Force refresh of data source
    this._refreshDataSource();
  }

  /**
   * Handle creating new database
   */
  private _handleCreateNewDatabase(): void {
    console.log('[DatabaseBlockComponent] Creating new database');

    // Remove tableId to indicate this is now an independent database
    delete this.model.props.tableId;

    // Show success toast
    toast(this.host, 'Switched to new database');

    // Force refresh of data source
    this._refreshDataSource();
  }

  /**
   * Handle database deletion with usage protection
   */
  private _handleDatabaseDeletion(): void {
    const currentSource = this._getCurrentSourceInfo();

    if (currentSource) {
      // Check if other views are using this source
      this._checkUsageBeforeDeletion(currentSource.tableId);
    }

    // Proceed with standard deletion
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
    } catch (error) {
      console.error('[DatabaseBlockComponent] Error checking usage:', error);
    }
  }

  /**
   * Dispatch usage events for workspace meta management
   */
  private _dispatchUsageEvent(eventType: string, tableId: string): void {
    const event = new CustomEvent(eventType, {
      detail: { tableId },
      bubbles: true,
    });
    this.dispatchEvent(event);
  }

  /**
   * Force refresh of data source when source changes
   */
  private _refreshDataSource(): void {
    // Trigger re-render by updating the component
    this.requestUpdate();
  }

  override accessor useZeroWidth = true;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-database': DatabaseBlockComponent;
  }
}
