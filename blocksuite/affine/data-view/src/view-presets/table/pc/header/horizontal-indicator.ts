import { unsafeCSSVarV2 } from '@blocksuite/affine-shared/theme';
import { WithDisposable } from '@blocksuite/global/lit';
import { ShadowlessElement } from '@blocksuite/std';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

export class TableHorizontalIndicator extends WithDisposable(
  ShadowlessElement
) {
  static override styles = css`
    data-view-table-horizontal-indicator {
      position: fixed;
      left: 0;
      top: 0;
      z-index: 1;
      pointer-events: none;
    }

    .horizontal-indicator {
      position: absolute;
      pointer-events: none;
      height: 1px;
      background-color: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .horizontal-indicator::after {
      position: absolute;
      z-index: 1;
      height: 2px;
      width: 100%;
      content: '';
      top: 0;
      background-color: var(--affine-primary-color);
      border-radius: 1px;
    }

    .with-shadow.horizontal-indicator::after {
      box-shadow: 0px 0px 8px 0px rgba(30, 150, 235, 0.35);
    }
  `;

  protected override render(): unknown {
    const style = styleMap({
      top: `${this.top}px`,
      left: `${this.left}px`,
      height: `${this.height}px`,
      width: `${this.width}px`,
    });
    const className = classMap({
      'with-shadow': this.shadow,
      'horizontal-indicator': true,
    });
    return html` <div class="${className}" style=${style}></div> `;
  }

  @property({ attribute: false })
  accessor height!: number;

  @property({ attribute: false })
  accessor left!: number;

  @property({ attribute: false })
  accessor shadow = false;

  @property({ attribute: false })
  accessor top!: number;

  @property({ attribute: false })
  accessor width!: number;
}

let preview: HorizontalIndicator | null = null;
type HorizontalIndicator = {
  display: (
    left: number,
    top: number,
    width: number,
    height?: number,
    shadow?: boolean
  ) => void;
  remove: () => void;
};

export const getHorizontalIndicator = (): HorizontalIndicator => {
  if (!preview) {
    const dragBar = new TableHorizontalIndicator();
    preview = {
      display(
        left: number,
        top: number,
        width: number,
        height = 1,
        shadow = false
      ) {
        document.body.append(dragBar);
        dragBar.left = left;
        dragBar.height = height;
        dragBar.top = top;
        dragBar.width = width;
        dragBar.shadow = shadow;
      },
      remove() {
        dragBar.remove();
      },
    };
  }

  return preview;
};

declare global {
  interface HTMLElementTagNameMap {
    'data-view-table-horizontal-indicator': TableHorizontalIndicator;
  }
}

// Define the custom element
if (!customElements.get('data-view-table-horizontal-indicator')) {
  customElements.define(
    'data-view-table-horizontal-indicator',
    TableHorizontalIndicator
  );
}
