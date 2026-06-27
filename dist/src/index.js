"use strict";
/**
 * md-to-obsidian-dom
 *
 * Convert Markdown to Obsidian DOM API code for plugin help documentation
 *
 * This package provides:
 * - A preprocessor for resolving includes and detecting dynamic placeholders
 * - A parser for converting markdown to AST
 * - A generator for converting AST to TypeScript code using Obsidian's DOM API
 * - Utilities for runtime help rendering
 *
 * Usage:
 * 1. Create markdown files with front matter:
 *    ```markdown
 *    ---
 *    id: getting-started
 *    title: Getting Started
 *    ---
 *
 *    # Getting Started
 *    ...
 *    ```
 *
 * 2. Run the generator:
 *    ```bash
 *    npx md-to-obsidian-dom ./help-md ./src/generated-help
 *    ```
 *
 * 3. Plugin integration:
 *    ```typescript
 *    import { pages } from './generated-help';
 *    import type { RenderContext } from './generated-help';
 *    import { Component, setIcon } from 'obsidian';
 *
 *    const component = new Component();
 *    const ctx: RenderContext = {
 *      app: this.app,
 *      component,
 *      renderDynamic: (container, key) => { ... },
 *      setIcon,
 *    };
 *
 *    pages['getting-started'].render(container, ctx);
 *    ```
 *
 * Note: The generated files include their own RenderContext type,
 * so there's no runtime dependency on this package.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRenderContext = exports.defaultRenderDynamic = exports.Generator = exports.Parser = exports.Preprocessor = void 0;
// Build-time utilities
var preprocessor_1 = require("./preprocessor");
Object.defineProperty(exports, "Preprocessor", { enumerable: true, get: function () { return preprocessor_1.Preprocessor; } });
var parser_1 = require("./parser");
Object.defineProperty(exports, "Parser", { enumerable: true, get: function () { return parser_1.Parser; } });
var generator_1 = require("./generator");
Object.defineProperty(exports, "Generator", { enumerable: true, get: function () { return generator_1.Generator; } });
// Runtime utilities (optional - generated code doesn't depend on these)
var renderer_1 = require("./renderer");
Object.defineProperty(exports, "defaultRenderDynamic", { enumerable: true, get: function () { return renderer_1.defaultRenderDynamic; } });
Object.defineProperty(exports, "createRenderContext", { enumerable: true, get: function () { return renderer_1.createRenderContext; } });
//# sourceMappingURL=index.js.map