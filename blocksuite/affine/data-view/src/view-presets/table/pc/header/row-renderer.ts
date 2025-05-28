import { SignalWatcher, WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { cssVarV2 } from '@toeverything/theme/v2';
import { css, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { html } from 'lit/static-html.js';

import type { Group } from '../../../../core/group-by/trait.js';
import type {
  TableProperty,
  TableSingleView,
} from '../../table-view-manager.js';

export class DataViewRowPreview extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    affine-data-view-row-preview {
      pointer-events: none;
      display: block;
      position: absolute;
      font-family: var(--affine-font-family);
      z-index: 1000;
      opacity: 0.9;
    }
  `;

  private renderTransposeRow() {
    const rows = this.group?.rows ?? this.view.rows$.value;
    const properties = this.view.properties$.value;
    const currentProperty = this.column;

    return html`
      <div
        class="affine-database-block-row data-view-table-row"
        style="background-color: var(--affine-background-primary-color); border: 1px solid ${unsafeCSS(
          cssVarV2.layer.insideBorder.border
        )}; box-shadow: var(--affine-shadow-2);"
      >
        <!-- Property header as first cell -->
        <div
          class="database-cell affine-database-column"
          style="width: ${properties[0]?.width$.value ||
          150}px; min-width: ${properties[0]?.width$.value ||
          150}px; border-right: 1px solid ${cssVarV2.layer.insideBorder
            .border};"
        >
          <affine-database-header-column
            .column="${currentProperty}"
            .tableViewManager="${this.view}"
            data-column-id="${currentProperty.id}"
          ></affine-database-header-column>
        </div>
        <!-- Data cells for each original row (now displayed as columns) -->
        ${repeat(rows, (row, rowIdx) => {
          const titleProperty = properties.find(p => p.type$.value === 'title');
          const columnWidth = titleProperty?.width$.value || 150;
          const isLast = rowIdx === rows.length - 1;
          return html`
            <div
              class="database-cell"
              style="width: ${columnWidth}px; min-width: ${columnWidth}px;${!isLast
                ? ` border-right: 1px solid ${cssVarV2.layer.insideBorder.border};`
                : ''}"
            >
              <affine-database-cell-container
                .view="${this.view}"
                .column="${currentProperty}"
                .rowId="${row.rowId}"
                data-row-id="${row.rowId}"
                .rowIndex="${rowIdx}"
                .columnId="${currentProperty.id}"
                data-column-id="${currentProperty.id}"
                .readonly="${false}"
              ></affine-database-cell-container>
            </div>
          `;
        })}
      </div>
    `;
  }

  override render() {
    return this.renderTransposeRow();
  }

  @property({ attribute: false })
  accessor column!: TableProperty;

  @property({ attribute: false })
  accessor container!: HTMLElement;

  @property({ attribute: false })
  accessor view!: TableSingleView;

  @property({ attribute: false })
  accessor group: Group | undefined = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-data-view-row-preview': DataViewRowPreview;
  }
}

// Define the custom element if not already defined
if (!customElements.get('affine-data-view-row-preview')) {
  customElements.define('affine-data-view-row-preview', DataViewRowPreview);
}
