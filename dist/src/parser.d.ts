import type { HelpNode, InlineNode } from './types';
/**
 * Parser for converting markdown to AST nodes
 * Supports:
 * - Headings (# to ######)
 * - Paragraphs
 * - Ordered and unordered lists (with nesting)
 * - Tables (GFM style)
 * - Code blocks (fenced)
 * - Blockquotes (>)
 * - Callouts (> [!note], > [!warning], etc.)
 * - Horizontal rules (---, ***, ___)
 * - Dynamic placeholders ({{dynamic:key}})
 * - Internal links ([[pageId]] or [[pageId|text]])
 * - Images (![alt](src) or ![alt](src "title"))
 * - HTML blocks
 * - Inline formatting (bold, italic, strikethrough, code, links)
 */
export declare class Parser {
    /**
     * Parse markdown content into AST nodes
     */
    parse(content: string): HelpNode[];
    /**
     * Parse inline formatting within text
     * Public for use by Generator for table cell parsing
     */
    parseInline(text: string): InlineNode[];
    /**
     * Parse a list (ordered or unordered) with support for nesting
     */
    private parseList;
    /**
     * Parse a blockquote (> prefix)
     */
    private parseBlockquote;
    /**
     * Parse an Obsidian-style callout (> [!type] title)
     */
    private parseCallout;
    /**
     * Parse a GFM table
     */
    private parseTable;
    /**
     * Parse a single table row
     */
    private parseTableRow;
    /**
     * Check if a line should break paragraph continuation
     */
    private isParagraphBreak;
}
//# sourceMappingURL=parser.d.ts.map