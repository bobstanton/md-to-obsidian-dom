import type { RenderContext } from './types';
/**
 * Simple default dynamic content renderer
 * Shows placeholder text for unhandled dynamic keys
 */
export declare function defaultRenderDynamic(container: HTMLElement, key: string): void;
/**
 * Utility to create a render context
 * Useful for simple use cases where you don't need a full class
 */
export declare function createRenderContext(options: {
    app: unknown;
    component: unknown;
    renderDynamic?: (container: HTMLElement, key: string) => void;
    setIcon: (element: HTMLElement, iconId: string) => void;
}): RenderContext;
//# sourceMappingURL=renderer.d.ts.map