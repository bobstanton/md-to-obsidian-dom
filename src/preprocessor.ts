import * as fs from 'fs';
import * as path from 'path';
import { HelpPageMeta, PreprocessResult } from './types';

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
export class Preprocessor {
  private inputDir: string;
  private processedIncludes: Set<string> = new Set();

  constructor(inputDir: string) {
    this.inputDir = inputDir;
  }

  /**
   * Process a markdown file and resolve all includes
   */
  async processFile(filePath: string): Promise<PreprocessResult> {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(this.inputDir, filePath);
    const content = await fs.promises.readFile(absolutePath, 'utf-8');

    // Reset processed includes for each top-level file
    this.processedIncludes.clear();

    return this.processContent(content, absolutePath);
  }

  /**
   * Process markdown content string
   */
  private async processContent(content: string, currentFilePath: string): Promise<PreprocessResult> {
    // Extract front matter
    const { meta, body } = this.extractFrontMatter(content);

    // Track this file to prevent circular includes
    this.processedIncludes.add(currentFilePath);

    // Resolve includes
    const resolvedContent = await this.resolveIncludes(body, path.dirname(currentFilePath));

    // Find dynamic placeholders
    const dynamicKeys = this.findDynamicKeys(resolvedContent);

    // Find internal links
    const linkedPages = this.findLinkedPages(resolvedContent);

    return {
      content: resolvedContent,
      meta,
      dynamicKeys,
      linkedPages,
    };
  }

  /**
   * Extract YAML front matter from markdown
   */
  private extractFrontMatter(content: string): { meta: HelpPageMeta; body: string } {
    const frontMatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/;
    const match = content.match(frontMatterRegex);

    if (!match) {
      throw new Error('Help file must have front matter with at least id and title');
    }

    const yamlContent = match[1];
    const body = content.slice(match[0].length);

    // Simple YAML parsing for key: value pairs
    const meta: HelpPageMeta = { id: '', title: '' };
    const lines = yamlContent.split('\n');

    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.slice(0, colonIndex).trim();
        let value = line.slice(colonIndex + 1).trim();

        // Remove quotes if present
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        meta[key] = value;
      }
    }

    if (!meta.id || !meta.title) {
      throw new Error('Front matter must include id and title');
    }

    return { meta, body };
  }

  /**
   * Resolve all ![[path]] embed directives (Obsidian embed syntax)
   * Supports:
   * - ![[file.md]] - embed whole file
   * - ![[folder/file.md]] - path-based embeds
   * - ![[file.md#Section]] - embed from heading to next same-level heading
   */
  private async resolveIncludes(content: string, currentDir: string): Promise<string> {
    // Match ![[path]] or ![[path#section]] but not regular links [[path]]
    const includeRegex = /!\[\[([^\]#|]+?)(?:#([^\]|]+))?(?:\|[^\]]+)?\]\]/g;
    let result = content;
    let match: RegExpExecArray | null;

    // Find all includes first to avoid regex state issues
    const includes: Array<{ full: string; path: string; section?: string }> = [];
    while ((match = includeRegex.exec(content)) !== null) {
      includes.push({ full: match[0], path: match[1].trim(), section: match[2]?.trim() });
    }

    // Process each include
    for (const inc of includes) {
      const includePath = path.isAbsolute(inc.path) ? inc.path : path.join(currentDir, inc.path);

      // Check for circular includes
      if (this.processedIncludes.has(includePath + (inc.section || ''))) {
        console.warn(`Circular include detected: ${includePath}${inc.section ? '#' + inc.section : ''}`);
        result = result.replace(inc.full, `<!-- Circular include: ${inc.path} -->`);
        continue;
      }

      try {
        this.processedIncludes.add(includePath + (inc.section || ''));
        let includeContent = await fs.promises.readFile(includePath, 'utf-8');

        // Extract section if specified
        if (inc.section) {
          includeContent = this.extractSection(includeContent, inc.section);
        }

        // Recursively process includes in the included file
        const processedInclude = await this.resolveIncludes(includeContent, path.dirname(includePath));

        result = result.replace(inc.full, processedInclude);
      } catch (error) {
        console.error(`Failed to include file: ${includePath}`, error);
        result = result.replace(inc.full, `<!-- Failed to include: ${inc.path} -->`);
      }
    }

    return result;
  }

  /**
   * Extract a section or block from markdown content
   * - For headings: returns content from heading to next same-level heading
   * - For block IDs (^block-id): returns the block containing that ID
   */
  private extractSection(content: string, sectionName: string): string {
    // Handle block ID references (start with ^)
    if (sectionName.startsWith('^')) {
      return this.extractBlock(content, sectionName);
    }

    // Handle heading references
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    let inSection = false;
    let sectionLevel = 0;
    const sectionLines: string[] = [];

    for (const line of lines) {
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const text = headingMatch[2].trim();

        if (!inSection) {
          // Check if this is our target heading
          if (text.toLowerCase() === sectionName.toLowerCase()) {
            inSection = true;
            sectionLevel = level;
            sectionLines.push(line);
          }
        } else {
          // We're in the section - check if we've hit a same or higher level heading
          if (level <= sectionLevel) {
            // End of section
            break;
          }
          sectionLines.push(line);
        }
      } else if (inSection) {
        sectionLines.push(line);
      }
    }

    return sectionLines.join('\n');
  }

  /**
   * Extract a block by its block ID (^block-id)
   * Handles: paragraphs, lists, blockquotes, code blocks, tables, callouts
   *
   * Block IDs can appear:
   * - At end of a line: "Some text ^block-id"
   * - On own line after complex blocks (tables): "^block-id"
   */
  private extractBlock(content: string, blockId: string): string {
    const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const blockIdPattern = new RegExp(`\\s+\\${blockId}$|^\\${blockId}$`);

    // Find the line containing the block ID
    let blockIdLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      if (blockIdPattern.test(lines[i])) {
        blockIdLineIndex = i;
        break;
      }
    }

    if (blockIdLineIndex === -1) {
      return '';
    }

    const blockIdLine = lines[blockIdLineIndex];

    // Check if block ID is on its own line (for complex blocks like tables)
    if (blockIdLine.trim() === blockId) {
      // Find the block above this line
      return this.extractBlockAbove(lines, blockIdLineIndex);
    }

    // Block ID is at end of a line - determine block type and extract
    return this.extractBlockContaining(lines, blockIdLineIndex, blockId);
  }

  /**
   * Extract the block above a standalone block ID line
   * Used for complex blocks like tables where ^block-id is on its own line
   */
  private extractBlockAbove(lines: string[], blockIdLineIndex: number): string {
    // Find the end of the block above (skip empty lines)
    let blockEnd = blockIdLineIndex - 1;
    while (blockEnd >= 0 && lines[blockEnd].trim() === '') {
      blockEnd--;
    }

    if (blockEnd < 0) {
      return '';
    }

    // Determine block type and find start
    const endLine = lines[blockEnd];

    // Check for table (ends with |)
    if (endLine.includes('|')) {
      return this.extractTableBlock(lines, blockEnd);
    }

    // Check for code block (ends with ```)
    if (endLine.trim() === '```' || endLine.trim().startsWith('```')) {
      return this.extractCodeBlockEnding(lines, blockEnd);
    }

    // Check for blockquote/callout
    if (endLine.startsWith('>')) {
      return this.extractBlockquoteBlock(lines, blockEnd);
    }

    // Default: extract as paragraph block
    return this.extractParagraphBlock(lines, blockEnd, null);
  }

  /**
   * Extract a block that contains the block ID on the same line
   */
  private extractBlockContaining(lines: string[], lineIndex: number, blockId: string): string {
    const line = lines[lineIndex];

    // Check for list item
    if (line.match(/^(\s*)([-*+]|\d+\.)\s/)) {
      return this.extractListBlock(lines, lineIndex, blockId);
    }

    // Check for blockquote/callout
    if (line.startsWith('>')) {
      return this.extractBlockquoteBlock(lines, lineIndex, blockId);
    }

    // Check for code block (inside fenced block)
    if (this.isInsideCodeBlock(lines, lineIndex)) {
      return this.extractCodeBlockContaining(lines, lineIndex, blockId);
    }

    // Check for table row
    if (line.includes('|')) {
      return this.extractTableBlock(lines, lineIndex, blockId);
    }

    // Default: paragraph
    return this.extractParagraphBlock(lines, lineIndex, blockId);
  }

  /**
   * Check if a line is inside a fenced code block
   */
  private isInsideCodeBlock(lines: string[], lineIndex: number): boolean {
    let insideCodeBlock = false;
    for (let i = 0; i < lineIndex; i++) {
      if (lines[i].trim().startsWith('```') || lines[i].trim().startsWith('~~~')) {
        insideCodeBlock = !insideCodeBlock;
      }
    }
    return insideCodeBlock;
  }

  /**
   * Extract a paragraph block (text between blank lines)
   */
  private extractParagraphBlock(lines: string[], lineIndex: number, blockId: string | null): string {
    // Find start of paragraph (first non-empty line after a blank line or start)
    let start = lineIndex;
    while (start > 0 && lines[start - 1].trim() !== '') {
      start--;
    }

    // Find end of paragraph (last non-empty line before a blank line or end)
    let end = lineIndex;
    while (end < lines.length - 1 && lines[end + 1].trim() !== '') {
      end++;
    }

    // Extract and remove block ID
    const blockLines = lines.slice(start, end + 1);
    return this.removeBlockId(blockLines.join('\n'), blockId);
  }

  /**
   * Extract a list block (entire list including nested items)
   */
  private extractListBlock(lines: string[], lineIndex: number, blockId: string): string {
    const lineIndent = this.getIndent(lines[lineIndex]);

    // Find start of list
    let start = lineIndex;
    while (start > 0) {
      const prevLine = lines[start - 1];
      if (prevLine.trim() === '') break;
      // Continue if it's a list item or continuation
      if (!prevLine.match(/^(\s*)([-*+]|\d+\.)\s/) && this.getIndent(prevLine) <= lineIndent) {
        break;
      }
      start--;
    }

    // Find end of list
    let end = lineIndex;
    while (end < lines.length - 1) {
      const nextLine = lines[end + 1];
      if (nextLine.trim() === '') break;
      // Continue if it's a list item or indented continuation
      if (!nextLine.match(/^(\s*)([-*+]|\d+\.)\s/) && this.getIndent(nextLine) <= lineIndent && nextLine.trim() !== '') {
        break;
      }
      end++;
    }

    const blockLines = lines.slice(start, end + 1);
    return this.removeBlockId(blockLines.join('\n'), blockId);
  }

  /**
   * Extract a blockquote or callout block
   */
  private extractBlockquoteBlock(lines: string[], lineIndex: number, blockId?: string | null): string {
    // Find start of blockquote
    let start = lineIndex;
    while (start > 0 && lines[start - 1].startsWith('>')) {
      start--;
    }

    // Find end of blockquote
    let end = lineIndex;
    while (end < lines.length - 1 && lines[end + 1].startsWith('>')) {
      end++;
    }

    const blockLines = lines.slice(start, end + 1);
    return this.removeBlockId(blockLines.join('\n'), blockId ?? null);
  }

  /**
   * Extract a table block
   */
  private extractTableBlock(lines: string[], lineIndex: number, blockId?: string | null): string {
    // Find start of table (first line with |)
    let start = lineIndex;
    while (start > 0 && lines[start - 1].includes('|')) {
      start--;
    }

    // Find end of table (last line with |)
    let end = lineIndex;
    while (end < lines.length - 1 && lines[end + 1].includes('|')) {
      end++;
    }

    const blockLines = lines.slice(start, end + 1);
    return this.removeBlockId(blockLines.join('\n'), blockId ?? null);
  }

  /**
   * Extract a code block that ends at the given line
   */
  private extractCodeBlockEnding(lines: string[], endIndex: number): string {
    // Find the opening fence
    let start = endIndex - 1;
    while (start >= 0) {
      if (lines[start].trim().startsWith('```') || lines[start].trim().startsWith('~~~')) {
        break;
      }
      start--;
    }

    if (start < 0) {
      return '';
    }

    return lines.slice(start, endIndex + 1).join('\n');
  }

  /**
   * Extract a code block containing the given line
   */
  private extractCodeBlockContaining(lines: string[], lineIndex: number, blockId: string): string {
    // Find opening fence
    let start = lineIndex - 1;
    while (start >= 0 && !lines[start].trim().startsWith('```') && !lines[start].trim().startsWith('~~~')) {
      start--;
    }

    // Find closing fence
    let end = lineIndex + 1;
    while (end < lines.length && !lines[end].trim().startsWith('```') && !lines[end].trim().startsWith('~~~')) {
      end++;
    }

    const blockLines = lines.slice(start, end + 1);
    return this.removeBlockId(blockLines.join('\n'), blockId);
  }

  /**
   * Get the indentation level of a line
   */
  private getIndent(line: string): number {
    const match = line.match(/^(\s*)/);
    return match ? match[1].length : 0;
  }

  /**
   * Remove block ID from content
   */
  private removeBlockId(content: string, blockId: string | null): string {
    if (!blockId) return content;
    // Remove block ID with preceding whitespace
    return content.replace(new RegExp(`\\s+\\${blockId}$`, 'm'), '');
  }

  /**
   * Find all {{dynamic:key}} placeholders
   */
  private findDynamicKeys(content: string): string[] {
    const dynamicRegex = /\{\{dynamic:([^}]+)\}\}/g;
    const keys: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = dynamicRegex.exec(content)) !== null) {
      const key = match[1].trim();
      if (!keys.includes(key)) {
        keys.push(key);
      }
    }

    return keys;
  }

  /**
   * Find all [[pageId]] or [[pageId|text]] internal links
   * Excludes links inside fenced code blocks
   */
  private findLinkedPages(content: string): string[] {
    // Strip fenced code blocks first to avoid false positives
    const contentWithoutCode = content.replace(/```[\s\S]*?```/g, '');

    const linkRegex = /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g;
    const pages: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(contentWithoutCode)) !== null) {
      const pageId = match[1].trim();
      if (!pages.includes(pageId)) {
        pages.push(pageId);
      }
    }

    return pages;
  }
}
