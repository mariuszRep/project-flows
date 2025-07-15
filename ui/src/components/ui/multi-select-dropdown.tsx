import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Option {
  id: string | number;
  label: string;
}

export interface MultiSelectDropdownProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange'> {
  options: Option[];
  selectedOptions: Option[];
  onChange: (selected: Option[]) => void;
  placeholder?: string;
}

const MultiSelectDropdown = React.forwardRef<HTMLDivElement, MultiSelectDropdownProps>(
  ({ className, options, selectedOptions, onChange, placeholder = "Select", ...props }, ref) => {
    const [isOpen, setIsOpen] = React.useState(false);
    
    const toggleDropdown = () => setIsOpen(!isOpen);
    
    const toggleOption = (option: Option) => {
      if (selectedOptions.some(item => item.id === option.id)) {
        onChange(selectedOptions.filter(item => item.id !== option.id));
      } else {
        onChange([...selectedOptions, option]);
      }
    };
    
    const removeOption = (option: Option, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent dropdown from toggling
      onChange(selectedOptions.filter(item => item.id !== option.id));
    };
    
    return (
      <div className={cn("w-full", className)} ref={ref} {...props}>
        <div className="relative">
          <button
            type="button"
            onClick={toggleDropdown}
            className="shared-ui w-full flex items-center justify-between px-4 py-2 bg-background border border-border rounded-md shadow-sm text-left min-h-10"
          >
            <div className="flex flex-wrap gap-1 items-center flex-1 mr-2">
              {selectedOptions.length > 0 ? (
                selectedOptions.map(option => (
                  <div 
                    key={option.id} 
                    className="flex items-center bg-primary text-primary-foreground px-2 py-1 rounded-md text-sm my-1"
                  >
                    {option.label}
                    <button 
                      type="button"
                      onClick={(e) => removeOption(option, e)} 
                      className="ml-1 focus:outline-none"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-muted-foreground">{placeholder}</span>
              )}
            </div>
            <ChevronDown 
              size={20} 
              className={cn(
                "transform transition-transform", 
                isOpen ? "rotate-180" : ""
              )} 
            />
          </button>
          
          {isOpen && (
            <div className="shared-ui absolute z-10 mt-1 w-full bg-background border border-border rounded-md shadow-md">
              <ul className="py-1">
                {options.map(option => {
                  const isSelected = selectedOptions.some(item => item.id === option.id);
                  const isFirst = option.id === options[0].id;
                  const isLast = option.id === options[options.length - 1].id;
                  
                  return (
                    <li 
                      key={option.id} 
                      onClick={() => toggleOption(option)}
                      className={cn(
                        "px-4 py-2 cursor-pointer flex items-center justify-between",
                        "hover:bg-surface transition-colors",
                        isSelected ? "bg-surface text-primary" : "text-foreground",
                        isFirst ? "rounded-t-md" : "",
                        isLast ? "rounded-b-md" : ""
                      )}
                    >
                      <span>{option.label}</span>
                      {isSelected && (
                        <Check size={16} className="text-primary" />
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }
);

MultiSelectDropdown.displayName = "MultiSelectDropdown";

export { MultiSelectDropdown };
export default MultiSelectDropdown;
