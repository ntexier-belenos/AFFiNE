import {
  menu,
  popFilterableSimpleMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { PlusIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { effect } from '@preact/signals-core';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, nothing, unsafeCSS } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type { DataViewRenderer } from '../../../core/data-view.js';
import { GroupTitle } from '../../../core/group-by/group-title.js';
import type { Group } from '../../../core/group-by/trait.js';
import type { Row } from '../../../core/index.js';
import { createDndContext } from '../../../core/utils/wc-dnd/dnd-context.js';
import { defaultActivators } from '../../../core/utils/wc-dnd/sensors/index.js';
import { linearMove } from '../../../core/utils/wc-dnd/utils/linear-move.js';
import { LEFT_TOOL_BAR_WIDTH } from '../consts.js';
import { TableViewAreaSelection } from '../selection';
import type { TableProperty, TableSingleView } from '../table-view-manager.js';
import { DataViewColumnPreview } from './header/column-renderer.js';
import { getHorizontalIndicator } from './header/horizontal-indicator.js';
import { DataViewRowPreview } from './header/row-renderer.js';
import { getVerticalIndicator } from './header/vertical-indicator.js';
import type { DataViewTable } from './table-view.js';

const styles = css`
  affine-data-view-table-group:hover .group-header-op {
    visibility: visible;
    opacity: 1;
  }

  .data-view-table-group-add-row {
    display: flex;
    width: 100%;
    height: 28px;
    position: relative;
    z-index: 0;
    cursor: pointer;
    transition: opacity 0.2s ease-in-out;
    padding: 4px 8px;
    border-bottom: 1px solid ${unsafeCSS(cssVarV2.layer.insideBorder.border)};
  }

  @media print {
    .data-view-table-group-add-row {
      display: none;
    }
  }

  .data-view-table-group-add-row-button {
    position: sticky;
    left: ${8 + LEFT_TOOL_BAR_WIDTH}px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    user-select: none;
    font-size: 12px;
    line-height: 20px;
    color: var(--affine-text-secondary-color);
  }
    font-weight: 600;
  }
`;

export class TableGroup extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = styles;

  private readonly clickAddRow = () => {
    this.view.rowAdd('end', this.group?.key);
    const selectionController = this.viewEle.selectionController;
    selectionController.selection = undefined;
    requestAnimationFrame(() => {
      const index = this.view.properties$.value.findIndex(
        v => v.type$.value === 'title'
      );
      selectionController.selection = TableViewAreaSelection.create({
        groupKey: this.group?.key,
        focus: {
          rowIndex: this.rows.length - 1,
          columnIndex: index,
        },
        isEditing: true,
      });
    });
  };

  private readonly clickAddRowInStart = () => {
    this.view.rowAdd('start', this.group?.key);
    const selectionController = this.viewEle.selectionController;
    selectionController.selection = undefined;
    requestAnimationFrame(() => {
      const index = this.view.properties$.value.findIndex(
        v => v.type$.value === 'title'
      );
      selectionController.selection = TableViewAreaSelection.create({
        groupKey: this.group?.key,
        focus: {
          rowIndex: 0,
          columnIndex: index,
        },
        isEditing: true,
      });
    });
  };

  private readonly clickGroupOptions = (e: MouseEvent) => {
    const group = this.group;
    if (!group) {
      return;
    }
    const ele = e.currentTarget as HTMLElement;
    popFilterableSimpleMenu(popupTargetFromElement(ele), [
      menu.action({
        name: 'Ungroup',
        hide: () => group.value == null,
        select: () => {
          group.rows.forEach(row => {
            group.manager.removeFromGroup(row.rowId, group.key);
          });
        },
      }),
      menu.action({
        name: 'Delete Cards',
        select: () => {
          this.view.rowsDelete(group.rows.map(row => row.rowId));
        },
      }),
    ]);
  };

  private readonly renderGroupHeader = () => {
    if (!this.group) {
      return null;
    }
    return html`
      <div
        style="position: sticky;left: 0;width: max-content;padding: 6px 0;margin-bottom: 4px;display:flex;align-items:center;gap: 12px;max-width: 400px"
      >
        ${GroupTitle(this.group, {
          readonly: this.view.readonly$.value,
          clickAdd: this.clickAddRowInStart,
          clickOps: this.clickGroupOptions,
        })}
      </div>
    `;
  };

  @property({ attribute: false })
  accessor group: Group | undefined = undefined;

  @property({ attribute: false })
  accessor view!: TableSingleView;

  dndContext?: ReturnType<typeof createDndContext>;

  showIndicator = () => {
    if (!this.dndContext) {
      return; // DnD context not initialized yet
    }

    // Use appropriate indicator based on transpose mode
    const indicator = this.view.transpose$.value
      ? getHorizontalIndicator()
      : getVerticalIndicator();

    this.disposables.add(
      effect(() => {
        if (!this.dndContext) return;

        const active = this.dndContext.active$.value;
        const over = this.dndContext.over$.value;
        if (!active || !over) {
          indicator.remove();
          return;
        }

        if (this.view.transpose$.value) {
          // Transpose mode: horizontal indicator between property rows
          const scrollY = this.dndContext.scrollOffset$.value.y;
          const containerRect = this.getBoundingClientRect();
          const top =
            over.rect.top < active.rect.top ? over.rect.top : over.rect.bottom;
          const width = containerRect.width;
          indicator.display(containerRect.left, top - scrollY, width, 2, true);
        } else {
          // Normal mode: vertical indicator between columns
          const scrollX = this.dndContext.scrollOffset$.value.x;
          const bottom =
            this.rowsContainer?.getBoundingClientRect().bottom ??
            this.getBoundingClientRect().bottom;
          const left =
            over.rect.left < active.rect.left
              ? over.rect.left
              : over.rect.right;
          const height = bottom - over.rect.top;
          indicator.display(left - scrollX, over.rect.top, height, 1, true);
        }
      })
    );
  };

  get rows() {
    return this.group?.rows ?? this.view.rows$.value;
  }

  private renderRows(rows: Row[]) {
    // Check if table is in transpose mode
    if (this.view.transpose$.value) {
      return this.renderTransposedTable(rows);
    }

    // Normal table rendering
    return html`
      <affine-database-column-header
        .renderGroupHeader="${this.renderGroupHeader}"
        .tableViewManager="${this.view}"
      ></affine-database-column-header>
      <div class="affine-database-block-rows">
        ${repeat(
          rows,
          row => row.rowId,
          (row, idx) => {
            return html` <data-view-table-row
              data-row-index="${idx}"
              data-row-id="${row.rowId}"
              .dataViewEle="${this.dataViewEle}"
              .view="${this.view}"
              .rowId="${row.rowId}"
              .rowIndex="${idx}"
            ></data-view-table-row>`;
          }
        )}
      </div>
      ${this.view.readonly$.value
        ? null
        : html` <div
            class="data-view-table-group-add-row dv-hover"
            @click="${this.clickAddRow}"
          >
            <div
              class="data-view-table-group-add-row-button dv-icon-16"
              data-test-id="affine-database-add-row-button"
              role="button"
            >
              ${PlusIcon()}<span style="font-size: 12px">New Record</span>
            </div>
          </div>`}
      <affine-database-column-stats .view="${this.view}" .group="${this.group}">
      </affine-database-column-stats>
    `;
  }

  private renderTransposedTable(rows: Row[]) {
    const properties = this.view.properties$.value;

    return html`
      <!-- Transposed header border to match classic view aesthetic -->
      <div
        style="border-top: 1px solid ${unsafeCSS(
          cssVarV2.layer.insideBorder.border
        )}; border-bottom: 1px solid ${unsafeCSS(
          cssVarV2.layer.insideBorder.border
        )}; background-color: var(--affine-background-primary-color); height: 1px;"
      ></div>

      <!-- Transposed body: each property becomes a row -->
      <div class="affine-database-block-rows">
        <!-- Property rows: each property becomes a row -->
        ${repeat(
          properties,
          property => property.id,
          (property, propertyIdx) => html`
            <data-view-table-row
              class="affine-database-block-row data-view-table-row"
              data-property-id="${property.id}"
              data-row-index="${propertyIdx + 1}"
              .dataViewEle="${this.dataViewEle}"
              .view="${this.view}"
              .property="${property}"
              .propertyIndex="${propertyIdx}"
              transposeMode
            >
              ${!this.view.readonly$.value
                ? html`<div class="data-view-table-left-bar"></div>`
                : null}
              <!-- Property header as first cell -->
              <div
                class="database-cell affine-database-column"
                style="width: ${properties[0]?.width$.value ||
                150}px; min-width: ${properties[0]?.width$.value ||
                150}px; border-right: 1px solid ${cssVarV2.layer.insideBorder
                  .border};"
              >
                <affine-database-header-column
                  .column="${property}"
                  .tableViewManager="${this.view}"
                  data-column-id="${property.id}"
                  data-column-index="${propertyIdx}"
                ></affine-database-header-column>
              </div>
              <!-- Data cells for each original row (now displayed as columns) -->
              ${repeat(rows, (row, rowIdx) => {
                const titleProperty = properties.find(
                  p => p.type$.value === 'title'
                );
                const columnWidth = titleProperty?.width$.value || 150;
                // Only add border-right if not last column
                const isLast =
                  rowIdx === rows.length - 1 &&
                  (!this.view.readonly$.value ? false : true);
                return html`
                  <div
                    class="database-cell"
                    style="width: ${columnWidth}px; min-width: ${columnWidth}px;${!isLast
                      ? ` border-right: 1px solid ${cssVarV2.layer.insideBorder.border};`
                      : ''}"
                  >
                    <affine-database-cell-container
                      .view="${this.view}"
                      .column="${property}"
                      .rowId="${row.rowId}"
                      data-row-id="${row.rowId}"
                      .rowIndex="${rowIdx}"
                      data-row-index="${rowIdx}"
                      .columnId="${property.id}"
                      data-column-id="${property.id}"
                      .columnIndex="${propertyIdx}"
                      data-column-index="${propertyIdx}"
                      .readonly="${false}"
                    ></affine-database-cell-container>
                  </div>
                `;
              })}
              <!-- New Record button column - only on first property row -->
              ${!this.view.readonly$.value && propertyIdx === 0
                ? html`
                    <div
                      class="database-cell"
                      style="width: 150px; min-width: 150px; border-right: 1px solid ${cssVarV2
                        .layer.insideBorder.border};"
                    >
                      <div
                        class="data-view-table-group-add-row-button dv-icon-16"
                        @click="${this.clickAddRow}"
                        data-test-id="affine-database-add-row-button"
                        role="button"
                      >
                        ${PlusIcon()}<span style="font-size: 12px"
                          >New Record</span
                        >
                      </div>
                    </div>
                  `
                : nothing}
            </data-view-table-row>
          `
        )}

        <!-- Add new property row -->
        ${this.view.readonly$.value
          ? null
          : html`
              <div
                class="affine-database-block-row data-view-table-row add-property-row"
              >
                <div class="data-view-table-left-bar"></div>

                <!-- Add property button -->
                <div
                  class="database-cell affine-database-column add-property-cell"
                  style="width: ${properties[0]?.width$.value ||
                  150}px; min-width: ${properties[0]?.width$.value || 150}px;"
                >
                  <div
                    class="data-view-table-group-add-row-button dv-icon-16"
                    @click="${this.clickAddProperty}"
                    data-test-id="affine-database-add-property-button"
                    role="button"
                  >
                    ${PlusIcon()}<span style="font-size: 12px"
                      >Add Property</span
                    >
                  </div>
                </div>
              </div>
            `}
      </div>
    `;
  }

  private readonly clickAddProperty = () => {
    // Get the table view manager to add a new property
    this.view.propertyAdd('end');

    // Focus on the newly added property after a brief delay
    requestAnimationFrame(() => {
      const properties = this.view.properties$.value;
      const newPropertyIndex = properties.length - 1;
      const selectionController = this.viewEle.selectionController;

      selectionController.selection = TableViewAreaSelection.create({
        groupKey: this.group?.key,
        focus: {
          rowIndex: newPropertyIndex + 1, // +1 because first row is headers
          columnIndex: 0, // Focus on property name column
        },
        isEditing: true,
      });
    });
  };

  private createColumnPreview(active: any, column: TableProperty) {
    const preview = new DataViewColumnPreview();
    preview.column = column;
    preview.group = this.group;
    preview.container = this;
    preview.style.position = 'absolute';
    preview.style.zIndex = '999';
    const scale = this.dndContext.scale$.value;
    const offsetParentRect = this.offsetParent?.getBoundingClientRect();
    if (!offsetParentRect) {
      return;
    }
    preview.style.width = `${column.width$.value}px`;
    preview.style.top = `${(active.rect.top - offsetParentRect.top - 1) / scale.y}px`;
    preview.style.left = `${(active.rect.left - offsetParentRect.left) / scale.x}px`;
    const cells = Array.from(
      this.querySelectorAll(`[data-column-id="${active.id}"]`)
    ) as HTMLElement[];
    cells.forEach(ele => {
      ele.style.opacity = '0.1';
    });
    this.append(preview);
    return {
      overlay: preview,
      cleanup: () => {
        preview.remove();
        cells.forEach(ele => {
          ele.style.opacity = '1';
        });
      },
    };
  }

  private createTransposePreview(active: any, column: TableProperty) {
    const preview = new DataViewRowPreview();
    preview.column = column;
    preview.group = this.group;
    preview.view = this.view;
    preview.container = this;
    preview.style.position = 'absolute';
    preview.style.zIndex = '999';

    const scale = this.dndContext.scale$.value;
    const offsetParentRect = this.offsetParent?.getBoundingClientRect();
    if (!offsetParentRect) {
      return;
    }

    // For transpose mode, the preview should span the full table width
    // Get the container's full width to include all columns
    const tableContainer = this.querySelector('.affine-database-block-rows');
    const containerWidth = tableContainer?.scrollWidth || this.clientWidth;

    // Position the preview to start at the beginning of the row (left: 0)
    // and span the full width
    preview.style.width = `${containerWidth}px`;
    preview.style.height = `${active.rect.height}px`;
    preview.style.top = `${(active.rect.top - offsetParentRect.top - 1) / scale.y}px`;
    preview.style.left = '0px'; // Start at the beginning of the container

    // Make original row semi-transparent
    const propertyRow = this.querySelector(
      `[data-property-id="${active.id}"]`
    ) as HTMLElement;
    if (propertyRow) {
      propertyRow.style.opacity = '0.1';
    }

    this.append(preview);

    return {
      overlay: preview,
      cleanup: () => {
        preview.remove();
        if (propertyRow) {
          propertyRow.style.opacity = '1';
        }
      },
    };
  }

  private initializeDndContext() {
    if (!this.view || this.dndContext) {
      return; // Already initialized or view not ready
    }

    this.dndContext = createDndContext({
      activators: defaultActivators,
      container: this,
      modifiers: [
        ({ transform }) => {
          // Adapt movement direction based on transpose mode
          const isTransposed = this.view.transpose$.value;
          return {
            ...transform,
            // In transpose mode, allow vertical movement; in normal mode, horizontal only
            y: isTransposed ? transform.y : 0,
            x: isTransposed ? 0 : transform.x,
          };
        },
      ],
      onDragEnd: ({ over, active }) => {
        if (over && over.id !== active.id) {
          const activeIndex = this.view.properties$.value.findIndex(
            data => data.id === active.id
          );
          const overIndex = this.view.properties$.value.findIndex(
            data => data.id === over.id
          );
          this.view.propertyGetOrCreate(active.id).move({
            before: activeIndex > overIndex,
            id: over.id,
          });
        }
      },
      collisionDetection: linearMove(!this.view.transpose$.value), // horizontal for normal, vertical for transpose
      createOverlay: active => {
        const column = this.view.propertyGetOrCreate(active.id);
        const preview = this.view.transpose$.value
          ? this.createTransposePreview(active, column)
          : this.createColumnPreview(active, column);
        return preview;
      },
    });
  }

  override connectedCallback(): void {
    super.connectedCallback();
    this.showIndicator();
  }

  override updated(changedProperties: Map<string, unknown>): void {
    super.updated(changedProperties);

    // Initialize DnD context when view becomes available
    if (changedProperties.has('view') && this.view) {
      this.initializeDndContext();
      // Initialize indicator after DnD context is ready
      this.showIndicator();
    }
  }

  override render() {
    return this.renderRows(this.rows);
  }

  @property({ attribute: false })
  accessor dataViewEle!: DataViewRenderer;

  @query('.affine-database-block-rows')
  accessor rowsContainer: HTMLElement | null = null;

  @property({ attribute: false })
  accessor viewEle!: DataViewTable;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-table-group': TableGroup;
  }
}
