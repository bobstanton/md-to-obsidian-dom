import type { RenderContext } from './types';

/**
 * Simple default dynamic content renderer
 * Shows placeholder text for unhandled dynamic keys
 */
export function defaultRenderDynamic(container: HTMLElement, key: string): void {
  const span = document.createElement('span');
  span.className = 'help-dynamic-placeholder';
  span.textContent = `{{${key}}}`;
  container.appendChild(span);
}

/**
 * Utility to create a render context
 * Useful for simple use cases where you don't need a full class
 */
export function createRenderContext(options: {
  app: unknown;
  component: unknown;
  renderDynamic?: (container: HTMLElement, key: string) => void;
  setIcon: (element: HTMLElement, iconId: string) => void;
}): RenderContext {
  return {
    app: options.app,
    component: options.component,
    renderDynamic: options.renderDynamic || defaultRenderDynamic,
    setIcon: options.setIcon,
  };
}
