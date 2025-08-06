import React from 'react';

// TypeScript interfaces for parsed markdown elements
interface MarkdownElement {
  type: string;
  content?: string;
  items?: string[];
  isTaskList?: boolean;
  taskItems?: { text: string; checked: boolean }[];
  language?: string;
  key: string;
}

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, className = "" }) => {
  // Parse markdown content into structured elements
  const parseMarkdown = (text: string): MarkdownElement[] => {
    if (!text) return [];
    
    const lines = text.split('\n');
    const elements: MarkdownElement[] = [];
    let i = 0;
    
    while (i < lines.length) {
      const line = lines[i];
      
      // Code blocks (```language)
      if (line.startsWith('```')) {
        const language = line.slice(3).trim();
        const codeLines: string[] = [];
        i++;
        
        while (i < lines.length && !lines[i].startsWith('```')) {
          codeLines.push(lines[i]);
          i++;
        }
        
        elements.push({
          type: 'codeblock',
          language,
          content: codeLines.join('\n'),
          key: `code-${elements.length}`
        });
        i++;
        continue;
      }
      
      // Headers (# ## ### etc.)
      const headerMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headerMatch) {
        const level = headerMatch[1].length;
        const text = headerMatch[2].trim();
        elements.push({
          type: `h${level}`,
          content: text,
          key: `header-${elements.length}`
        });
        i++;
        continue;
      }
      
      // Task lists (- [x] or - [ ] )
      const taskListMatch = line.match(/^[\s]*[-*+]\s\[([ xX]?)\]\s(.+)$/);
      if (taskListMatch) {
        const taskItems: { text: string; checked: boolean }[] = [];
        
        while (i < lines.length) {
          const currentLine = lines[i];
          const taskItemMatch = currentLine.match(/^[\s]*[-*+]\s\[([ xX]?)\]\s(.+)$/);
          
          if (taskItemMatch) {
            const isChecked = taskItemMatch[1].toLowerCase() === 'x';
            taskItems.push({
              text: taskItemMatch[2],
              checked: isChecked
            });
            i++;
          } else if (currentLine.trim() === '') {
            i++;
            break;
          } else {
            break;
          }
        }
        
        elements.push({
          type: 'ul',
          isTaskList: true,
          taskItems: taskItems,
          key: `task-list-${elements.length}`
        });
        continue;
      }
      
      // Regular lists (-, *, +, or numbered)
      const listMatch = line.match(/^[\s]*[-*+]\s(.+)$/) || line.match(/^[\s]*\d+\.\s(.+)$/);
      if (listMatch) {
        const listItems: string[] = [];
        const isOrdered = line.match(/^[\s]*\d+\.\s/) !== null;
        
        while (i < lines.length) {
          const currentLine = lines[i];
          const itemMatch = currentLine.match(/^[\s]*[-*+]\s(.+)$/) || currentLine.match(/^[\s]*\d+\.\s(.+)$/);
          
          if (itemMatch) {
            listItems.push(itemMatch[1]);
            i++;
          } else if (currentLine.trim() === '') {
            i++;
            break;
          } else {
            break;
          }
        }
        
        elements.push({
          type: isOrdered ? 'ol' : 'ul',
          items: listItems,
          key: `list-${elements.length}`
        });
        continue;
      }
      
      // Blockquotes (> text)
      if (line.startsWith('>')) {
        const quoteLines: string[] = [];
        while (i < lines.length && (lines[i].startsWith('>') || lines[i].trim() === '')) {
          const currentLine = lines[i];
          if (currentLine.startsWith('>')) {
            quoteLines.push(currentLine.slice(1).trim());
          }
          i++;
        }
        
        elements.push({
          type: 'blockquote',
          content: quoteLines.join(' '),
          key: `quote-${elements.length}`
        });
        continue;
      }
      
      // Empty lines (create breaks)
      if (line.trim() === '') {
        if (elements.length > 0 && elements[elements.length - 1].type !== 'break') {
          elements.push({
            type: 'break',
            key: `break-${elements.length}`
          });
        }
        i++;
        continue;
      }
      
      // Regular paragraphs
      const paragraphLines: string[] = [];
      while (i < lines.length) {
        const currentLine = lines[i];
        
        // Stop if we hit a special markdown element
        if (currentLine.trim() === '' || 
            currentLine.match(/^#{1,6}\s/) || 
            currentLine.startsWith('>') || 
            currentLine.startsWith('```') ||
            currentLine.match(/^[\s]*[-*+\d.]\s/)) {
          break;
        }
        
        paragraphLines.push(currentLine);
        i++;
      }
      
      if (paragraphLines.length > 0) {
        elements.push({
          type: 'p',
          content: paragraphLines.join(' '),
          key: `p-${elements.length}`
        });
      }
    }
    
    return elements;
  };
  
  // Parse inline formatting (bold, italic, code, links)
  const parseInlineFormatting = (text: string): string => {
    if (!text) return text;
    
    let result = text;
    
    // Links [text](url)
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$1</a>');
    
    // Code spans `code`
    result = result.replace(/`([^`]+)`/g, '<code class="bg-muted text-foreground rounded px-1 py-0.5 text-sm font-mono">$1</code>');
    
    // Bold **text** or __text__
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
    result = result.replace(/__([^_]+)__/g, '<strong class="font-semibold text-foreground">$1</strong>');
    
    // Italic *text* or _text_ (but not inside words)
    result = result.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, '<em class="italic">$1</em>');
    result = result.replace(/(?<!\w)_([^_]+)_(?!\w)/g, '<em class="italic">$1</em>');
    
    return result;
  };
  
  const elements = parseMarkdown(content);
  
  return (
    <div className={`markdown-renderer ${className}`}>
      {elements.map((element) => {
        switch (element.type) {
          case 'h1':
            return (
              <h1 
                key={element.key}
                className="text-2xl font-semibold text-foreground mt-6 mb-3 pb-2 border-b border-border"
                dangerouslySetInnerHTML={{ 
                  __html: parseInlineFormatting(element.content || '') 
                }}
              />
            );
            
          case 'h2':
            return (
              <h2 
                key={element.key}
                className="text-xl font-semibold text-foreground mt-5 mb-2"
                dangerouslySetInnerHTML={{ 
                  __html: parseInlineFormatting(element.content || '') 
                }}
              />
            );
            
          case 'h3':
            return (
              <h3 
                key={element.key}
                className="text-lg font-semibold text-foreground mt-4 mb-2"
                dangerouslySetInnerHTML={{ 
                  __html: parseInlineFormatting(element.content || '') 
                }}
              />
            );
            
          case 'h4':
          case 'h5':
          case 'h6':
            return (
              <h4 
                key={element.key}
                className="text-base font-semibold text-foreground mt-3 mb-2"
                dangerouslySetInnerHTML={{ 
                  __html: parseInlineFormatting(element.content || '') 
                }}
              />
            );
            
          case 'p':
            return (
              <p 
                key={element.key}
                className="text-muted-foreground mb-3 leading-relaxed"
                dangerouslySetInnerHTML={{ 
                  __html: parseInlineFormatting(element.content || '') 
                }}
              />
            );
            
          case 'ul':
            if (element.isTaskList && element.taskItems) {
              return (
                <ul key={element.key} className="list-none mb-3 text-muted-foreground space-y-2 pl-0">
                  {element.taskItems.map((task, index) => (
                    <li key={index} className="flex items-start">
                      <input 
                        type="checkbox" 
                        checked={task.checked}
                        readOnly
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary mr-2"
                      />
                      <span 
                        className={`leading-relaxed flex-1 ${task.checked ? 'line-through text-muted-foreground/60' : ''}`}
                        dangerouslySetInnerHTML={{ 
                          __html: parseInlineFormatting(task.text)
                        }}
                      />
                    </li>
                  ))}
                </ul>
              );
            }
            return (
              <ul key={element.key} className="list-disc list-inside mb-3 text-muted-foreground space-y-1">
                {element.items?.map((item, index) => (
                  <li 
                    key={index}
                    className="leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: parseInlineFormatting(item) 
                    }}
                  />
                ))}
              </ul>
            );
            
          case 'ol':
            return (
              <ol key={element.key} className="list-decimal list-inside mb-3 text-muted-foreground space-y-1">
                {element.items?.map((item, index) => (
                  <li 
                    key={index}
                    className="leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: parseInlineFormatting(item) 
                    }}
                  />
                ))}
              </ol>
            );
            
          case 'blockquote':
            return (
              <blockquote 
                key={element.key}
                className="border-l-4 border-border bg-muted px-4 py-2 mb-3 text-muted-foreground italic rounded-r"
                dangerouslySetInnerHTML={{ 
                  __html: parseInlineFormatting(element.content || '') 
                }}
              />
            );
            
          case 'codeblock':
            return (
              <div key={element.key} className="mb-3 border border-gray-300 dark:border-gray-600 rounded-[var(--radius-m)] overflow-hidden" style={{ borderWidth: '1px' }}>
                {element.language && (
                  <div className="bg-muted text-muted-foreground text-xs px-3 py-1 border-b border-gray-300 dark:border-gray-600 font-mono">
                    {element.language}
                  </div>
                )}
                <pre className={`bg-muted overflow-x-auto p-3 font-mono text-sm text-foreground m-0`}>
                  <code>{element.content}</code>
                </pre>
              </div>
            );
            
          case 'break':
            return <div key={element.key} className="h-3" />;
            
          default:
            return null;
        }
      })}
    </div>
  );
};

export default MarkdownRenderer;