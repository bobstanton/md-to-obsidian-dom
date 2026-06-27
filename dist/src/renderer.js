"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultRenderDynamic = defaultRenderDynamic;
exports.createRenderContext = createRenderContext;
/**
 * Simple default dynamic content renderer
 * Shows placeholder text for unhandled dynamic keys
 */
function defaultRenderDynamic(container, key) {
    const span = document.createElement('span');
    span.className = 'help-dynamic-placeholder';
    span.textContent = `{{${key}}}`;
    container.appendChild(span);
}
/**
 * Utility to create a render context
 * Useful for simple use cases where you don't need a full class
 */
function createRenderContext(options) {
    return {
        app: options.app,
        component: options.component,
        renderDynamic: options.renderDynamic || defaultRenderDynamic,
        setIcon: options.setIcon,
    };
}
//# sourceMappingURL=renderer.js.map