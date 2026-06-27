import { PreprocessResult } from './types';
/**
 * Preprocessor for help markdown files
 * Handles:
 * - Front matter extraction (YAML between --- delimiters)
 * - Include resolution (![[path/to/file.md]] - Obsidian embed syntax)
 *   - Heading embeds: ![[file.md#Heading]]
 *   - Block ID embeds: ![[file.md#^block-id]]
 * - Dynamic placeholder detection ({{dynamic:keyName}})
 * - Internal link detection ([[pageId]] or [[pageId|text]])
 */
export declare class Preprocessor {
    private inputDir;
    private processedIncludes;
    constructor(inputDir: string);
    /**
     * Process a markdown file and resolve all includes
     */
    processFile(filePath: string): Promise<PreprocessResult>;
    /**
     * Process markdown content string
     */
    private processContent;
    /**
     * Extract YAML front matter from markdown
     */
    private extractFrontMatter;
    /**
     * Resolve all ![[path]] embed directives (Obsidian embed syntax)
     * Supports:
     * - ![[file.md]] - embed whole file
     * - ![[folder/file.md]] - path-based embeds
     * - ![[file.md#Section]] - embed from heading to next same-level heading
     */
    private resolveIncludes;
    /**
     * Extract a section or block from markdown content
     * - For headings: returns content from heading to next same-level heading
     * - For block IDs (^block-id): returns the block containing that ID
     */
    private extractSection;
    /**
     * Extract a block by its block ID (^block-id)
     * Handles: paragraphs, lists, blockquotes, code blocks, tables, callouts
     *
     * Block IDs can appear:
     * - At end of a line: "Some text ^block-id"
     * - On own line after complex blocks (tables): "^block-id"
     */
    private extractBlock;
    /**
     * Extract the block above a standalone block ID line
     * Used for complex blocks like tables where ^block-id is on its own line
     */
    private extractBlockAbove;
    /**
     * Extract a block that contains the block ID on the same line
     */
    private extractBlockContaining;
    /**
     * Check if a line is inside a fenced code block
     */
    private isInsideCodeBlock;
    /**
     * Extract a paragraph block (text between blank lines)
     */
    private extractParagraphBlock;
    /**
     * Extract a list block (entire list including nested items)
     */
    private extractListBlock;
    /**
     * Extract a blockquote or callout block
     */
    private extractBlockquoteBlock;
    /**
     * Extract a table block
     */
    private extractTableBlock;
    /**
     * Extract a code block that ends at the given line
     */
    private extractCodeBlockEnding;
    /**
     * Extract a code block containing the given line
     */
    private extractCodeBlockContaining;
    /**
     * Get the indentation level of a line
     */
    private getIndent;
    /**
     * Remove block ID from content
     */
    private removeBlockId;
    /**
     * Find all {{dynamic:key}} placeholders
     */
    private findDynamicKeys;
    /**
     * Find all [[pageId]] or [[pageId|text]] internal links
     * Excludes links inside fenced code blocks
     */
    private findLinkedPages;
}
//# sourceMappingURL=preprocessor.d.ts.map