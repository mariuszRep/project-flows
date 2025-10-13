import * as React from "react";
import { useMCP } from "@/contexts/MCPContext";
import { useToast } from "@/components/ui/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import MultiSelectDropdown from "@/components/ui/multi-select-dropdown";
import type { Option } from "@/components/ui/multi-select-dropdown";
import { Loader2, AlertCircle } from "lucide-react";
import { Label } from "@/components/ui/label";

/**
 * Schema entry defining a relationship field configuration
 */
export interface RelatedSchemaEntry {
  key: string;
  label: string;
  allowed_types: number[]; // Template IDs: 1=Task, 2=Project, 3=Epic, 4=Rule
  cardinality: "single" | "multiple";
  required: boolean;
  order: number;
}

/**
 * Related entry format for storing relationships
 */
export interface RelatedEntry {
  id: number;
  object: "task" | "project" | "epic" | "rule";
}

/**
 * Object data structure from MCP list_objects
 */
interface MCPObject {
  id: number;
  title: string;
  template_id: number;
}

export interface DynamicRelationshipFieldProps {
  schemaEntry: RelatedSchemaEntry;
  value: RelatedEntry[];
  onChange: (value: RelatedEntry[]) => void;
}

/**
 * Maps template IDs to object type names
 */
const TEMPLATE_TO_OBJECT_TYPE: Record<number, RelatedEntry["object"]> = {
  1: "task",
  2: "project",
  3: "epic",
  4: "rule",
};

/**
 * DynamicRelationshipField Component
 *
 * A flexible relationship selector that fetches objects based on allowed_types
 * and renders either a single-select or multi-select dropdown based on cardinality.
 */
export const DynamicRelationshipField: React.FC<DynamicRelationshipFieldProps> = ({
  schemaEntry,
  value,
  onChange,
}) => {
  const { callTool } = useMCP();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [availableObjects, setAvailableObjects] = React.useState<MCPObject[]>([]);

  // Fetch available objects based on allowed_types
  React.useEffect(() => {
    const fetchObjects = async () => {
      setIsLoading(true);
      setError(null);

      console.log(`[RelationshipSelector] Fetching objects for ${schemaEntry.label}`);
      console.log(`[RelationshipSelector] Allowed types:`, schemaEntry.allowed_types);
      console.log(`[RelationshipSelector] Current value:`, value);

      try {
        const allObjects: MCPObject[] = [];

        // Fetch objects for each allowed template type
        for (const templateId of schemaEntry.allowed_types) {
          console.log(`[RelationshipSelector] Fetching template_id=${templateId}`);
          const result = await callTool("list_objects", {
            template_id: templateId,
          });

          console.log(`[RelationshipSelector] Result for template ${templateId}:`, result);

          if (result?.content?.[0]?.text) {
            try {
              const parsed = JSON.parse(result.content[0].text);
              console.log(`[RelationshipSelector] Parsed data for template ${templateId}:`, parsed);

              // Handle the response format: { count: number, objects: Array }
              let objectsArray: any[] = [];
              if (Array.isArray(parsed)) {
                objectsArray = parsed;
              } else if (parsed && Array.isArray(parsed.objects)) {
                objectsArray = parsed.objects;
              }

              console.log(`[RelationshipSelector] Objects array:`, objectsArray);

              if (objectsArray.length > 0) {
                // Add objects with their template_id for type mapping
                const objectsWithType = objectsArray.map((obj: any) => ({
                  id: obj.id,
                  title: obj.Title || obj.title || `Object ${obj.id}`,
                  template_id: templateId,
                }));
                console.log(`[RelationshipSelector] Processed objects:`, objectsWithType);
                allObjects.push(...objectsWithType);
              }
            } catch (parseError) {
              console.error(`Failed to parse objects for template ${templateId}:`, parseError);
            }
          }
        }

        console.log(`[RelationshipSelector] Total available objects:`, allObjects);
        setAvailableObjects(allObjects);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to fetch objects";
        console.error(`[RelationshipSelector] Error:`, err);
        setError(errorMessage);
        toast({
          variant: "destructive",
          title: "Error loading relationships",
          description: errorMessage,
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchObjects();
  }, [schemaEntry.allowed_types, callTool, toast, schemaEntry.label, value]);

  // Convert MCPObject[] to Option[] for dropdown
  const options: Option[] = availableObjects.map((obj) => ({
    id: obj.id,
    label: obj.title,
  }));

  console.log(`[RelationshipSelector] Generated options for ${schemaEntry.label}:`, options);

  // Convert RelatedEntry[] to Option[] for selected values
  // Include all value entries, even if we haven't loaded their details yet
  const selectedOptions: Option[] = React.useMemo(() => {
    const selected = value.map((entry) => {
      const obj = availableObjects.find((o) => o.id === entry.id);
      // If object is loaded, use its title; otherwise use a placeholder
      return {
        id: entry.id,
        label: obj ? obj.title : `${entry.object} #${entry.id}`,
      };
    });
    console.log(`[RelationshipSelector] Selected options for ${schemaEntry.label}:`, selected);
    return selected;
  }, [value, availableObjects, schemaEntry.label]);

  // Handle single select change
  const handleSingleSelectChange = (selectedId: string) => {
    if (!selectedId) {
      onChange([]);
      return;
    }

    const numericId = parseInt(selectedId, 10);
    const obj = availableObjects.find((o) => o.id === numericId);

    if (obj) {
      const objectType = TEMPLATE_TO_OBJECT_TYPE[obj.template_id];
      onChange([{ id: obj.id, object: objectType }]);
    }
  };

  // Handle multi select change
  const handleMultiSelectChange = (selected: Option[]) => {
    const relatedEntries: RelatedEntry[] = selected
      .map((option) => {
        const obj = availableObjects.find((o) => o.id === option.id);
        if (obj) {
          const objectType = TEMPLATE_TO_OBJECT_TYPE[obj.template_id];
          return { id: obj.id, object: objectType };
        }
        return null;
      })
      .filter((entry): entry is RelatedEntry => entry !== null);

    onChange(relatedEntries);
  };

  // Render loading state
  if (isLoading) {
    return (
      <div className="space-y-2">
        <Label>
          {schemaEntry.label}
          {schemaEntry.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="flex items-center justify-center h-10 border border-border rounded-md bg-background" role="status" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          <span className="sr-only">Loading {schemaEntry.label}...</span>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="space-y-2">
        <Label>
          {schemaEntry.label}
          {schemaEntry.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <div className="flex items-center gap-2 h-10 px-3 border border-destructive rounded-md bg-destructive/10 text-destructive" role="alert">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  // Render single select
  if (schemaEntry.cardinality === "single") {
    return (
      <div className="space-y-2">
        <Label htmlFor={`relationship-${schemaEntry.key}`}>
          {schemaEntry.label}
          {schemaEntry.required && <span className="text-destructive ml-1">*</span>}
        </Label>
        <Select
          value={value[0]?.id?.toString() || ""}
          onValueChange={handleSingleSelectChange}
        >
          <SelectTrigger id={`relationship-${schemaEntry.key}`}>
            <SelectValue placeholder={`Select ${schemaEntry.label.toLowerCase()}`} />
          </SelectTrigger>
          <SelectContent>
            {options.length === 0 ? (
              <SelectItem value="__empty__" disabled>
                No options available
              </SelectItem>
            ) : (
              options.map((option) => (
                <SelectItem key={option.id} value={option.id.toString()}>
                  {option.label}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
      </div>
    );
  }

  // Render multi select
  return (
    <div className="space-y-2">
      <Label>
        {schemaEntry.label}
        {schemaEntry.required && <span className="text-destructive ml-1">*</span>}
      </Label>
      <MultiSelectDropdown
        options={options}
        selectedOptions={selectedOptions}
        onChange={handleMultiSelectChange}
        placeholder={`Select ${schemaEntry.label.toLowerCase()}`}
      />
    </div>
  );
};

export default DynamicRelationshipField;
