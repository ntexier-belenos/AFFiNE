import {
  menu,
  popFilterableSimpleMenu,
  popupTargetFromElement,
} from '@blocksuite/affine-components/context-menu';
import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { PlusIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, html, unsafeCSS } from 'lit';
import { property, query } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import type { DataViewRenderer } from '../../../core/data-view.js';
import { GroupTitle } from '../../../core/group-by/group-title.js';
import type { Group } from '../../../core/group-by/trait.js';
import type { Row } from '../../../core/index.js';
import { LEFT_TOOL_BAR_WIDTH } from '../consts.js';
import type { DataViewTable } from '../pc/table-view.js';
import { TableViewAreaSelection } from '../selection';
import type { TableSingleView } from '../table-view-manager.js';

const styles = css`
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
`;

export class MobileTableGroup extends SignalWatcher(
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

  get rows() {
    return this.group?.rows ?? this.view.rows$.value;
  }

  private renderRows(rows: Row[]) {
    // Check if table is in transpose mode
    if (this.view.transpose$.value) {
      return this.renderTransposedTable(rows);
    }

    // Normal mobile table rendering
    return html`
      <mobile-table-header
        .renderGroupHeader="${this.renderGroupHeader}"
        .tableViewManager="${this.view}"
      ></mobile-table-header>
      <div class="mobile-affine-table-body">
        ${repeat(
          rows,
          row => row.rowId,
          (row, idx) => {
            return html` <mobile-table-row
              data-row-index="${idx}"
              data-row-id="${row.rowId}"
              .dataViewEle="${this.dataViewEle}"
              .view="${this.view}"
              .rowId="${row.rowId}"
              .rowIndex="${idx}"
            ></mobile-table-row>`;
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
      <div class="mobile-affine-table-body">
        <!-- First row: Data row headers with "New record" at the end -->
        <div class="mobile-table-row transpose-header-row">
          <!-- Empty cell for property header column -->
          <div
            class="mobile-table-cell"
            style="width: 120px; min-width: 120px;"
          ></div>
          <div class="cell-divider"></div>

          <!-- Row headers (original record titles) -->
          ${repeat(
            rows,
            row => row.rowId,
            (row, rowIdx) => {
              const titleProperty = properties.find(
                p => p.type$.value === 'title'
              );

              return html`
                <div
                  class="mobile-table-cell"
                  style="width: 100px; min-width: 100px;"
                >
                  <mobile-table-cell
                    .view="${this.view}"
                    .column="${titleProperty}"
                    .rowId="${row.rowId}"
                    data-row-id="${row.rowId}"
                    .rowIndex="${rowIdx}"
                    data-row-index="${rowIdx}"
                    .columnId="${titleProperty?.id}"
                    data-column-id="${titleProperty?.id}"
                    .columnIndex="0"
                    data-column-index="0"
                  ></mobile-table-cell>
                </div>
                <div class="cell-divider"></div>
              `;
            }
          )}

          <!-- "New record" button at the end -->
          ${this.view.readonly$.value
            ? null
            : html`
                <div
                  class="mobile-table-cell"
                  style="width: 100px; min-width: 100px;"
                >
                  <div
                    class="data-view-table-group-add-row-button dv-icon-16 transpose-new-record"
                    @click="${this.clickAddRow}"
                    data-test-id="affine-database-add-row-button"
                    role="button"
                  >
                    ${PlusIcon()}<span style="font-size: 10px">New Record</span>
                  </div>
                </div>
                <div class="cell-divider"></div>
              `}
        </div>

        <!-- Property rows: each property becomes a row -->
        ${repeat(
          properties,
          property => property.id,
          (property, propertyIdx) => html`
            <div
              class="mobile-table-row"
              data-property-id="${property.id}"
              data-row-index="${propertyIdx + 1}"
            >
              <!-- Property header as first cell -->
              <div
                class="mobile-table-cell"
                style="width: 120px; min-width: 120px; border-right: 1px solid ${cssVarV2
                  .layer.insideBorder.border};"
              >
                <mobile-table-column-header
                  .column="${property}"
                  .tableViewManager="${this.view}"
                  data-column-id="${property.id}"
                  data-column-index="${propertyIdx}"
                ></mobile-table-column-header>
              </div>
              <!-- Data cells for each original row (now displayed as columns) -->
              ${repeat(
                rows,
                row => row.rowId,
                (row, rowIdx) => {
                  // Only add border-right if not last column
                  const isLast =
                    rowIdx === rows.length - 1 &&
                    (!this.view.readonly$.value ? false : true);
                  return html`
                    <div
                      class="mobile-table-cell"
                      style="width: 100px; min-width: 100px;${!isLast
                        ? ` border-right: 1px solid ${cssVarV2.layer.insideBorder.border};`
                        : ''}"
                    >
                      <mobile-table-cell
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
                      ></mobile-table-cell>
                    </div>
                  `;
                }
              )}
            </div>
          `
        )}

        <!-- Add new property row -->
        ${this.view.readonly$.value
          ? null
          : html`
              <div class="mobile-table-row add-property-row">
                <!-- Add property button -->
                <div
                  class="mobile-table-cell add-property-cell"
                  style="width: 120px; min-width: 120px;"
                >
                  <div
                    class="data-view-table-group-add-row-button dv-icon-16"
                    @click="${this.clickAddProperty}"
                    data-test-id="affine-database-add-property-button"
                    role="button"
                  >
                    ${PlusIcon()}<span style="font-size: 10px"
                      >Add Property</span
                    >
                  </div>
                </div>
                <div class="cell-divider"></div>
              </div>
            `}
      </div>

      <affine-database-column-stats .view="${this.view}" .group="${this.group}">
      </affine-database-column-stats>
    `;
  }

  override render() {
    return this.renderRows(this.rows);
  }

  @property({ attribute: false })
  accessor dataViewEle!: DataViewRenderer;

  @property({ attribute: false })
  accessor group: Group | undefined = undefined;

  @query('.affine-database-block-rows')
  accessor rowsContainer: HTMLElement | null = null;

  @property({ attribute: false })
  accessor view!: TableSingleView;

  @property({ attribute: false })
  accessor viewEle!: DataViewTable;

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
}

declare global {
  interface HTMLElementTagNameMap {
    'mobile-table-group': MobileTableGroup;
  }
}
