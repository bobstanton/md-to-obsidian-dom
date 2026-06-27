# md-to-obsidian-dom

A build-time tool that converts Markdown documentation to TypeScript code using Obsidian's DOM API for building help directly into Obsidian plugins.

## Features

- Converts Markdown to TypeScript using Obsidian's `createEl`, `createDiv`, `createSpan` API
- Supports standard Markdown: headings, paragraphs, lists, tables, code blocks, blockquotes
- Supports Obsidian extensions: callouts, wikilinks, inline formatting
- Include system using Obsidian embed syntax (`![[file.md]]`)
- Dynamic content placeholders for runtime-generated content
- Source map comments linking generated code to original Markdown
- Validation warnings for broken links and missing references
- Zero runtime dependencies - generated code is self-contained

## Usage

### 1. Create Markdown Files

Create help documentation with frontmatter containing `id` and `title` properties:

```markdown
---
id: getting-started
title: Getting Started
---

# Getting Started

Introduction text with **bold** and `code` formatting.

## Configuration

| Setting   | Description                       |
|-----------|-----------------------------------|
| `apiKey`  | API key for authentication        |
| `timeout` | Request timeout in milliseconds   |

> [!tip] Pro Tip
> Callouts render with native Obsidian styling.
```

### 2. Run the Generator

```bash
npx md-to-obsidian-dom ./help-md ./src/generated-help
```

Or use the programmatic API:

```typescript
import { Generator } from 'md-to-obsidian-dom';

const generator = new Generator({
  inputDir: './help-md',
  outputDir: './src/generated-help',
  classPrefix: 'help',
});

await generator.generateAll();
```

### 3. Generated Output

The generator creates the following files:

```
generated-help/
  index.generated.ts      # Exports all pages
  types.generated.ts      # RenderContext interface
  styles.generated.css    # Minimal CSS for fence markers
  getting-started.generated.ts
  ...
```

Example generated code (`getting-started.generated.ts`):

```typescript
import './styles.generated.css';
import type { RenderContext } from './types.generated';

export const pageId = 'getting-started';
export const pageTitle = 'Getting Started';
export const meta = { id: 'getting-started', title: 'Getting Started' };
export const dynamicKeys: string[] = [];
export const linkedPages: string[] = [];

export function render(container: HTMLElement, ctx: RenderContext): void {
  // # Getting Started
  container.createEl('h1', { cls: 'help-heading help-h1', text: 'Getting Started' });

  // Introduction text with **bold** and `code` formatting.
  const para = container.createEl('p', { cls: 'help-paragraph' });
  para.appendText('Introduction text with ');
  para.createEl('strong', { cls: 'help-bold', text: 'bold' });
  para.appendText(' and ');
  para.createEl('code', { cls: 'help-code', text: 'code' });
  para.appendText(' formatting.');

  // ## Configuration
  container.createEl('h2', { cls: 'help-heading help-h2', text: 'Configuration' });

  // Table
  const table = container.createEl('table', { cls: 'help-table' });
  const thead = table.createEl('thead');
  const headerRow = thead.createEl('tr');
  headerRow.createEl('th', { text: 'Setting' });
  headerRow.createEl('th', { text: 'Description' });
  const tbody = table.createEl('tbody');
  const row = tbody.createEl('tr');
  const td = row.createEl('td');
  td.createEl('code', { cls: 'help-code', text: 'apiKey' });
  row.createEl('td', { text: 'API key for authentication' });
  const row1 = tbody.createEl('tr');
  const td1 = row1.createEl('td');
  td1.createEl('code', { cls: 'help-code', text: 'timeout' });
  row1.createEl('td', { text: 'Request timeout in milliseconds' });

  // > [!tip] Pro Tip
  const callout = container.createDiv({
    cls: 'callout',
    attr: { 'data-callout': 'tip', 'data-callout-metadata': '', 'data-callout-fold': '' }
  });
  const header = callout.createDiv({ cls: 'callout-title', attr: { dir: 'auto' } });
  const icon = header.createDiv({ cls: 'callout-icon' });
  ctx.setIcon(icon, 'flame');
  header.createDiv({ cls: 'callout-title-inner', text: 'Pro Tip' });
  const content = callout.createDiv({ cls: 'callout-content' });
  const para1 = content.createEl('p', { cls: 'help-paragraph' });
  para1.appendText('Callouts render with native Obsidian styling.');
}
```

Each page file exports:

```typescript
export const pageId: string;
export const pageTitle: string;
export const meta: { id: string; title: string; [key: string]: unknown };
export const dynamicKeys: string[];
export const linkedPages: string[];
export function render(container: HTMLElement, ctx: RenderContext): void;
```

The index file exports:

```typescript
export const pages: Record<PageId, PageModule>;
export type PageId = 'getting-started' | 'configuration' | ...;
export function getPage(id: PageId): PageModule;
export function getAllPageIds(): PageId[];
```

### 4. Plugin Integration

```typescript
import { pages } from './generated-help';
import type { RenderContext } from './generated-help';
import { Component, setIcon } from 'obsidian';

const component = new Component();
component.load();

const ctx: RenderContext = {
  app: this.app,
  component,
  renderDynamic: (container, key) => {
    // Handle dynamic placeholders like {{dynamic:version}}
    if (key === 'version') {
      container.createSpan({ text: '1.0.0' });
    }
  },
  setIcon: setIcon,
};

pages['getting-started'].render(container, ctx);
```

## Markdown Features

### Standard Markdown

- Headings (h1-h6)
- Paragraphs with inline formatting (bold, italic, strikethrough, code)
- Ordered and unordered lists with nesting
- Tables with header row
- Code blocks with language specification
- Blockquotes
- Horizontal rules
- Links and images

### Obsidian Extensions

#### Callouts

```markdown
> [!note] Custom Title
> Callout content with **formatting**.

> [!warning]
> Warning without custom title.
```

Supported callout types: `note`, `tip`, `warning`, `danger`, `important`, `caution`, `info`, `success`, `question`, `quote`, `example`, `bug`, `abstract`, `todo`, `failure`

#### Wikilinks

```markdown
See [[other-page]] for details.
See [[other-page|custom text]] for details.
```

### Code Block Rendering Modes

#### Standard Mode (``` fences)

Uses Obsidian's `MarkdownRenderer` for native reading view rendering:

````markdown
```yaml
setting: value
```
````

#### Display Mode (~~~ fences)

Renders with visible fence markers like source/edit view:

````markdown
~~~yaml
setting: value
~~~
````

This is useful for showing example code blocks for custom block types (e.g., `places`, `vaultquery`).

#### Prism Syntax Highlighting for Custom Block Types

When using display mode with custom block types, register them with Prism for syntax highlighting in reading view:

```typescript
import { loadPrism } from 'obsidian';

// In the plugin's onload():
void loadPrism().then((Prism) => {
  // Define a grammar for key-value syntax
  const customLanguage = {
    'keyword': {
      pattern: /^[a-zA-Z][a-zA-Z0-9_-]*(?=\s*:)/m,
      greedy: true
    },
    'string': {
      pattern: /(:[\t ]*)[^\n#]+/,
      lookbehind: true,
      greedy: true
    },
    'punctuation': /:/
  };

  // Register custom block types
  Prism.languages['my-plugin'] = customLanguage;
  Prism.languages['my-plugin-chart'] = customLanguage;
});
```

Without Prism registration, code inside display-mode blocks renders as plain text.

### Include System

Include content from other files using [Obsidian embed syntax](https://help.obsidian.md/embeds):

```markdown
![[shared/common-settings.md]]
```

#### Heading Embeds

Embed content from a specific heading to the next same-level heading:

```markdown
![[shared/common-settings.md#Configuration]]
```

#### Block ID Embeds

Embed specific blocks using block IDs. Block IDs are added at the end of a line with a space:

```markdown
This is an important paragraph. ^important-note

![[file.md#^important-note]]
```

For complex blocks like tables, place the block ID on its own line after the block:

```markdown
| Column 1 | Column 2 |
|----------|----------|
| Data     | Data     |

^my-table
```

Supported block types:
- Paragraphs
- Lists (including nested items)
- Blockquotes and callouts
- Code blocks
- Tables

Include files are resolved relative to the current file's directory. Circular includes are detected and prevented.

### Dynamic Content

Insert runtime-generated content using the `{{dynamic:key}}` syntax:

```markdown
Current version: {{dynamic:version}}

{{dynamic:settings-table}}
```

Dynamic keys are passed to `ctx.renderDynamic` at render time. Block-level placeholders (on their own line) and inline placeholders (within paragraphs) are both supported.

## Configuration

```typescript
interface GeneratorConfig {
  /** Input directory containing markdown files */
  inputDir: string;

  /** Output directory for generated TypeScript */
  outputDir: string;

  /** CSS class prefix for generated elements (default: 'help') */
  classPrefix?: string;

  /** File extension for output (default: '.generated.ts') */
  outputExtension?: string;
}
```

## RenderContext Interface

```typescript
interface RenderContext {
  /** Obsidian App instance used for native markdown rendering */
  app: App;

  /** Component used for rendered markdown lifecycle management */
  component: Component;

  /** Render dynamic content by key */
  renderDynamic: (container: HTMLElement, key: string) => void;

  /** Set an icon on an element (for callout icons) */
  setIcon: (element: HTMLElement, iconId: string) => void;
}
```

## Validation

The generator validates and reports warnings for:

| Warning Type             | Description                              |
|--------------------------|------------------------------------------|
| `broken-link`            | Wikilinks to non-existent pages          |
| `undefined-dynamic-key`  | Dynamic placeholders with no handler     |
| `missing-image`          | Image references to missing files        |

Warnings are reported to the console during generation.

## Runtime Utilities

Optional utilities for simple plugin integration (generated code does not depend on these):

### defaultRenderDynamic

Placeholder handler that displays `{{key}}` for unhandled keys:

```typescript
import { defaultRenderDynamic } from 'md-to-obsidian-dom';

// Shows {{settings}} if no custom handler provided
renderDynamic: defaultRenderDynamic
```

### createRenderContext

Factory function for creating a RenderContext with defaults:

```typescript
import { createRenderContext } from 'md-to-obsidian-dom';
import { Component, setIcon } from 'obsidian';

const ctx = createRenderContext({
  app: this.app,
  component: new Component(),
  setIcon,
  renderDynamic: (container, key) => {
    // Custom handler, falls back to defaultRenderDynamic when omitted
  }
});
```

## API Reference

### Generator

```typescript
class Generator {
  constructor(config: GeneratorConfig);

  /** Generate all markdown files in input directory */
  generateAll(): Promise<ValidationWarning[]>;

  /** Generate a single file */
  generateFile(filename: string): Promise<void>;
}
```

### Preprocessor

```typescript
class Preprocessor {
  constructor(inputDir: string);

  /** Process a file, resolving includes and extracting metadata */
  processFile(filePath: string): Promise<PreprocessResult>;
}
```

### Parser

```typescript
class Parser {
  /** Parse markdown content to AST */
  parse(content: string): HelpNode[];

  /** Parse inline content */
  parseInline(text: string): InlineNode[];
}
```
