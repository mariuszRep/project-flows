import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code2, Type } from 'lucide-react';

export interface PreviousStep {
  name: string;
  variables: string[];
  type?: string;
}

export interface ParameterSelectorProps {
  value: string | boolean;
  onChange: (value: string | boolean) => void;
  propertyKey: string;
  propertyType?: string;
  propertyDescription?: string;
  workflowParameters: string[];
  previousSteps: PreviousStep[];
  placeholder?: string;
}

type SelectionMode = 'previous_step' | 'manual';

export function ParameterSelector({
  value,
  onChange,
  propertyKey,
  propertyType = 'text',
  propertyDescription,
  workflowParameters,
  previousSteps,
  placeholder = 'Enter value...'
}: ParameterSelectorProps) {
  // Determine initial mode based on value
  const [mode, setMode] = useState<SelectionMode>(() => {
    if (value === true || value === false) return 'manual';
    if (typeof value === 'string' && (value.includes('{{') || value === '')) {
      return 'previous_step';
    }
    return 'manual';
  });

  const [manualValue, setManualValue] = useState<string>(() => {
    if (typeof value === 'string' && !value.includes('{{')) {
      return value;
    }
    return '';
  });

  const [selectedStepPath, setSelectedStepPath] = useState<string>(() => {
    if (typeof value === 'string' && value.includes('{{')) {
      // Extract the path from {{steps.stepName.var}} or {{input.var}}
      const match = value.match(/\{\{(.*?)\}\}/);
      if (match) {
        return match[1];
      }
    }
    return '';
  });

  // Update parent when mode or values change
  useEffect(() => {
    if (mode === 'manual') {
      onChange(manualValue || true);
    } else {
      if (selectedStepPath) {
        onChange(`{{${selectedStepPath}}}`);
      } else {
        onChange('');
      }
    }
  }, [mode, manualValue, selectedStepPath]);

  const handleModeToggle = () => {
    const newMode = mode === 'previous_step' ? 'manual' : 'previous_step';
    setMode(newMode);

    if (newMode === 'manual') {
      setManualValue('');
    } else {
      setSelectedStepPath('');
    }
  };

  // Build unified list of available parameters (workflow parameters + previous steps)
  const availableParameters: { label: string; value: string; group: string }[] = [];

  // Add workflow parameters (from start node)
  workflowParameters.forEach(param => {
    availableParameters.push({
      label: param,
      value: `steps.input.${param}`,
      group: 'Workflow Parameters'
    });
  });

  // Add previous step outputs
  previousSteps.forEach(step => {
    step.variables.forEach(variable => {
      availableParameters.push({
        label: `${step.name}.${variable}`,
        value: `steps.${step.name}.${variable}`,
        group: 'Previous Steps'
      });
    });
  });

  return (
    <div className="space-y-2">
      {/* Mode Toggle Buttons */}
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === 'previous_step' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('previous_step')}
          className="flex-1 h-8 text-xs"
        >
          <Code2 className="h-3 w-3 mr-1" />
          Reference Parameter
        </Button>
        <Button
          type="button"
          variant={mode === 'manual' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setMode('manual')}
          className="flex-1 h-8 text-xs"
        >
          <Type className="h-3 w-3 mr-1" />
          Manual Value
        </Button>
      </div>

      {/* Property Info */}
      <div className="flex items-center gap-2">
        <Label className="text-sm font-medium">{propertyKey}</Label>
        {propertyType && (
          <Badge variant="outline" className="text-xs">
            {propertyType}
          </Badge>
        )}
      </div>
      {propertyDescription && (
        <p className="text-xs text-muted-foreground">{propertyDescription}</p>
      )}

      {/* Mode-specific Input */}
      {mode === 'previous_step' ? (
        <div className="space-y-1">
          <Select value={selectedStepPath} onValueChange={setSelectedStepPath}>
            <SelectTrigger className="h-9 text-sm font-mono">
              <SelectValue placeholder="Select a parameter..." />
            </SelectTrigger>
            <SelectContent className="max-h-[300px]">
              {availableParameters.length === 0 ? (
                <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No parameters available
                </div>
              ) : (
                <>
                  {/* Group by Workflow Parameters */}
                  {availableParameters.some(p => p.group === 'Workflow Parameters') && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Workflow Parameters
                      </div>
                      {availableParameters
                        .filter(p => p.group === 'Workflow Parameters')
                        .map(param => (
                          <SelectItem key={param.value} value={param.value}>
                            <span className="font-mono text-xs">{param.label}</span>
                          </SelectItem>
                        ))}
                    </>
                  )}

                  {/* Group by Previous Steps */}
                  {availableParameters.some(p => p.group === 'Previous Steps') && (
                    <>
                      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                        Previous Steps
                      </div>
                      {availableParameters
                        .filter(p => p.group === 'Previous Steps')
                        .map(param => (
                          <SelectItem key={param.value} value={param.value}>
                            <span className="font-mono text-xs">{param.label}</span>
                          </SelectItem>
                        ))}
                    </>
                  )}
                </>
              )}
            </SelectContent>
          </Select>
          {selectedStepPath && (
            <p className="text-xs text-muted-foreground">
              Will use: <span className="font-mono">{`{{${selectedStepPath}}}`}</span>
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-1">
          <Input
            value={manualValue}
            onChange={(e) => setManualValue(e.target.value)}
            placeholder={placeholder}
            className="h-9 text-sm font-mono"
          />
          <p className="text-xs text-muted-foreground">
            Enter a static value for this property
          </p>
        </div>
      )}
    </div>
  );
}
