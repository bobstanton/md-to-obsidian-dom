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

// Types
export type {
  HelpPageMeta,
  HelpNode,
  HeadingNode,
  ParagraphNode,
  ListNode,
  ListItemNode,
  TableNode,
  CodeBlockNode,
  DynamicNode,
  LinkNode,
  HtmlNode,
  BlockquoteNode,
  CalloutNode,
  InlineNode,
  TextNode,
  BoldNode,
  ItalicNode,
  StrikethroughNode,
  CodeNode,
  InlineLinkNode,
  InlineImageNode,
  InlineDynamicNode,
  HelpPage,
  RenderContext,
  GeneratorConfig,
  PreprocessResult,
  SourceLocation,
  ValidationWarning,
  ValidationResult,
} from './types';

// Build-time utilities
export { Preprocessor } from './preprocessor';
export { Parser } from './parser';
export { Generator } from './generator';

// Runtime utilities (optional - generated code doesn't depend on these)
export { defaultRenderDynamic, createRenderContext } from './renderer';
