/**
 * FuncLib v4 - JSDoc & Comment Parser
 * Dokümantasyon ve yorum extraction
 */

export interface JSDocInfo {
  description: string;
  params: JSDocParam[];
  returns: JSDocReturn | null;
  throws: JSDocThrows[];
  examples: string[];
  see: string[];
  deprecated: boolean;
  deprecationMessage?: string;
  since?: string;
  author?: string;
  tags: Record<string, string>;
}

export interface JSDocParam {
  name: string;
  type: string;
  description: string;
  optional: boolean;
  defaultValue?: string;
}

export interface JSDocReturn {
  type: string;
  description: string;
}

export interface JSDocThrows {
  type: string;
  description: string;
}

export interface CodeMarker {
  type: 'TODO' | 'FIXME' | 'HACK' | 'NOTE' | 'XXX' | 'BUG' | 'OPTIMIZE';
  text: string;
  line: number;
  author?: string;
  priority?: 'low' | 'medium' | 'high';
}

export interface Comment {
  type: 'line' | 'block' | 'jsdoc';
  text: string;
  line: number;
  endLine: number;
}

export class JSDocParser {
  /**
   * JSDoc comment'ini parse et
   */
  parse(comment: string): JSDocInfo {
    const info: JSDocInfo = {
      description: '',
      params: [],
      returns: null,
      throws: [],
      examples: [],
      see: [],
      deprecated: false,
      tags: {},
    };

    // Comment'i temizle
    const cleaned = this.cleanComment(comment);
    const lines = cleaned.split('\n');

    let inDescription = true;
    let currentExample = '';
    let inExample = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Tag başlangıcı
      if (trimmed.startsWith('@')) {
        inDescription = false;
        
        // @example özel: çok satırlı
        if (inExample && !trimmed.startsWith('@example')) {
          if (currentExample) {
            info.examples.push(currentExample.trim());
          }
          inExample = false;
          currentExample = '';
        }

        const tagMatch = trimmed.match(/^@(\w+)\s*(.*)?$/);
        if (!tagMatch) continue;

        const [, tag, rest] = tagMatch;
        const value = rest || '';

        switch (tag) {
          case 'param':
          case 'arg':
          case 'argument':
            info.params.push(this.parseParam(value));
            break;

          case 'returns':
          case 'return':
            info.returns = this.parseReturn(value);
            break;

          case 'throws':
          case 'throw':
          case 'exception':
            info.throws.push(this.parseThrows(value));
            break;

          case 'example':
            inExample = true;
            currentExample = value;
            break;

          case 'see':
            info.see.push(value);
            break;

          case 'deprecated':
            info.deprecated = true;
            info.deprecationMessage = value || undefined;
            break;

          case 'since':
            info.since = value;
            break;

          case 'author':
            info.author = value;
            break;

          default:
            info.tags[tag] = value;
        }
      } else if (inExample) {
        currentExample += '\n' + trimmed;
      } else if (inDescription && trimmed) {
        info.description += (info.description ? ' ' : '') + trimmed;
      }
    }

    // Son example
    if (inExample && currentExample) {
      info.examples.push(currentExample.trim());
    }

    return info;
  }

  /**
   * Kod içindeki marker'ları bul (TODO, FIXME, etc.)
   */
  extractMarkers(content: string): CodeMarker[] {
    const markers: CodeMarker[] = [];
    const lines = content.split('\n');
    
    const markerPattern = /\b(TODO|FIXME|HACK|NOTE|XXX|BUG|OPTIMIZE)\s*[:\-]?\s*(.+)?$/i;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(markerPattern);
      
      if (match) {
        const [, type, text] = match;
        const markerType = type.toUpperCase() as CodeMarker['type'];
        
        markers.push({
          type: markerType,
          text: text?.trim() || '',
          line: i + 1,
          priority: this.inferPriority(markerType, text || ''),
          author: this.extractAuthor(text || ''),
        });
      }
    }

    return markers;
  }

  /**
   * Tüm comment'leri extract et
   */
  extractComments(content: string): Comment[] {
    const comments: Comment[] = [];
    
    // JSDoc comments: /** ... */
    const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
    let match;
    
    while ((match = jsdocPattern.exec(content)) !== null) {
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.getLineNumber(content, match.index + match[0].length);
      
      comments.push({
        type: 'jsdoc',
        text: match[0],
        line: startLine,
        endLine,
      });
    }

    // Block comments: /* ... */
    const blockPattern = /\/\*(?!\*)[\s\S]*?\*\//g;
    
    while ((match = blockPattern.exec(content)) !== null) {
      const startLine = this.getLineNumber(content, match.index);
      const endLine = this.getLineNumber(content, match.index + match[0].length);
      
      comments.push({
        type: 'block',
        text: match[0],
        line: startLine,
        endLine,
      });
    }

    // Line comments: //
    const linePattern = /\/\/.*$/gm;
    
    while ((match = linePattern.exec(content)) !== null) {
      const lineNum = this.getLineNumber(content, match.index);
      
      comments.push({
        type: 'line',
        text: match[0],
        line: lineNum,
        endLine: lineNum,
      });
    }

    return comments.sort((a, b) => a.line - b.line);
  }

  // ========================
  // Private helpers
  // ========================

  private cleanComment(comment: string): string {
    return comment
      .replace(/^\/\*\*?\s*/, '')      // Opening
      .replace(/\s*\*\/$/, '')          // Closing
      .replace(/^\s*\*\s?/gm, '')       // Line starts
      .trim();
  }

  private parseParam(value: string): JSDocParam {
    // {type} [name=default] description
    // {type} name description
    const pattern = /^\{([^}]+)\}\s*(\[([^\]=]+)(?:=([^\]]+))?\]|(\S+))\s*(.*)$/;
    const match = value.match(pattern);

    if (match) {
      const [, type, , optName, defaultValue, reqName, description] = match;
      return {
        name: optName || reqName || '',
        type: type || 'any',
        description: description || '',
        optional: !!optName,
        defaultValue: defaultValue,
      };
    }

    // Simplified: name description
    const simple = value.match(/^(\S+)\s*(.*)$/);
    if (simple) {
      return {
        name: simple[1],
        type: 'any',
        description: simple[2] || '',
        optional: false,
      };
    }

    return {
      name: value,
      type: 'any',
      description: '',
      optional: false,
    };
  }

  private parseReturn(value: string): JSDocReturn {
    // {type} description
    const pattern = /^\{([^}]+)\}\s*(.*)$/;
    const match = value.match(pattern);

    if (match) {
      return {
        type: match[1],
        description: match[2] || '',
      };
    }

    return {
      type: value || 'void',
      description: '',
    };
  }

  private parseThrows(value: string): JSDocThrows {
    // {type} description
    const pattern = /^\{([^}]+)\}\s*(.*)$/;
    const match = value.match(pattern);

    if (match) {
      return {
        type: match[1],
        description: match[2] || '',
      };
    }

    return {
      type: 'Error',
      description: value || '',
    };
  }

  private inferPriority(type: CodeMarker['type'], text: string): CodeMarker['priority'] {
    // Keyword based
    if (type === 'FIXME' || type === 'BUG') return 'high';
    if (type === 'HACK' || type === 'XXX') return 'medium';
    
    // Text based
    const lowerText = text.toLowerCase();
    if (lowerText.includes('urgent') || lowerText.includes('critical') || lowerText.includes('asap')) {
      return 'high';
    }
    if (lowerText.includes('important') || lowerText.includes('soon')) {
      return 'medium';
    }

    return 'low';
  }

  private extractAuthor(text: string): string | undefined {
    const match = text.match(/@(\w+)/);
    return match ? match[1] : undefined;
  }

  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }
}

// Singleton
let jsdocParser: JSDocParser | null = null;

export function getJSDocParser(): JSDocParser {
  if (!jsdocParser) {
    jsdocParser = new JSDocParser();
  }
  return jsdocParser;
}

export default JSDocParser;
