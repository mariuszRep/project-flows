import * as React from "react"
import { cn } from "@/lib/utils"

export interface AutoTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  minRows?: number;
  maxRows?: number;
}

const AutoTextarea = React.forwardRef<HTMLTextAreaElement, AutoTextareaProps>(
  ({ className, minRows = 2, maxRows = 10, value, onChange, ...props }, ref) => {
    const textareaRef = React.useRef<HTMLTextAreaElement>(null);
    
    const adjustHeight = React.useCallback(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      // Reset height to auto to get the correct scrollHeight
      textarea.style.height = 'auto';
      
      // Calculate the line height
      const lineHeight = parseInt(getComputedStyle(textarea).lineHeight, 10) || 20;
      const minHeight = lineHeight * minRows;
      
      // Set height based on content, with no maximum limit - always grow
      const scrollHeight = textarea.scrollHeight;
      const newHeight = Math.max(scrollHeight, minHeight);
      
      textarea.style.height = `${newHeight}px`;
      textarea.style.overflowY = 'hidden'; // Never show scrollbars
    }, [minRows]);

    React.useEffect(() => {
      adjustHeight();
    }, [value, adjustHeight]);

    const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onChange?.(e);
      adjustHeight();
    };

    return (
      <div className="shared-component-wrapper">
        <textarea
          ref={(node) => {
            textareaRef.current = node;
            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              ref.current = node;
            }
          }}
          className={cn(
            "shared-component resize-none",
            className
          )}
          value={value}
          onChange={handleChange}
          {...props}
        />
      </div>
    )
  }
)
AutoTextarea.displayName = "AutoTextarea"

export { AutoTextarea }