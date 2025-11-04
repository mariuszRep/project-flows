import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { workflowStorageService, WorkflowDefinition } from '@/services/workflowStorageService';
import { Save, X, AlertCircle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WorkflowEditorProps {
  workflow: WorkflowDefinition | null;
  onSave: (workflow: WorkflowDefinition) => void;
  onCancel: () => void;
}

const EXAMPLE_WORKFLOW = {
  name: "example_workflow",
  description: "Example workflow that creates a task using an agent",
  inputSchema: {
    type: "object",
    properties: {
      task_title: {
        type: "string",
        description: "Title for the task to create"
      }
    },
    required: ["task_title"]
  },
  steps: [
    {
      name: "analyze_task",
      type: "agent",
      instructions: [
        "Analyze the task title: {{input.task_title}}",
        "Generate a detailed description for this task"
      ]
    },
    {
      name: "create_task",
      type: "create_object",
      templateId: 1,
      properties: {
        Title: "{{input.task_title}}",
        Description: "{{steps.analyze_task.output}}"
      },
      stage: "draft",
      resultVariable: "created_task"
    }
  ]
};

export function WorkflowEditor({ workflow, onSave, onCancel }: WorkflowEditorProps) {
  const { toast } = useToast();
  const [jsonInput, setJsonInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    if (workflow) {
      setJsonInput(JSON.stringify(workflow, null, 2));
    } else {
      setJsonInput(JSON.stringify(EXAMPLE_WORKFLOW, null, 2));
    }
  }, [workflow]);

  useEffect(() => {
    validateWorkflow();
  }, [jsonInput]);

  const validateWorkflow = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      const validation = workflowStorageService.validateWorkflow(parsed);
      
      setValidationErrors(validation.errors);
      setIsValid(validation.valid);
    } catch (error) {
      setValidationErrors(['Invalid JSON: ' + (error as Error).message]);
      setIsValid(false);
    }
  };

  const handleSave = () => {
    if (!isValid) {
      toast({
        title: 'Validation Error',
        description: 'Please fix validation errors before saving',
        variant: 'destructive',
      });
      return;
    }

    try {
      const parsed = JSON.parse(jsonInput);
      
      // Check if workflow name already exists (only for new workflows)
      if (!workflow && workflowStorageService.workflowExists(parsed.name)) {
        toast({
          title: 'Error',
          description: `Workflow '${parsed.name}' already exists`,
          variant: 'destructive',
        });
        return;
      }

      onSave(parsed);
    } catch (error) {
      toast({
        title: 'Error',
        description: (error as Error).message,
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Workflow Definition</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="workflow-json">JSON Definition</Label>
            <Textarea
              id="workflow-json"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              className="font-mono text-sm min-h-[400px]"
              placeholder="Enter workflow JSON..."
            />
          </div>

          {validationErrors.length > 0 && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="font-semibold mb-2">Validation Errors:</div>
                <ul className="list-disc list-inside space-y-1">
                  {validationErrors.map((error, index) => (
                    <li key={index} className="text-sm">{error}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {isValid && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Workflow definition is valid and ready to save
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={!isValid}>
              <Save className="w-4 h-4 mr-2" />
              Save Workflow
            </Button>
            <Button variant="outline" onClick={onCancel}>
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Workflow Schema Reference</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <div>
              <h4 className="font-semibold mb-2">Required Fields:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">name</code> - Unique workflow identifier</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">description</code> - Human-readable description</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">inputSchema</code> - JSON Schema for input validation</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">steps</code> - Array of workflow steps</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Step Types:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">agent</code> - AI agent execution with instructions</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">create_object</code> - Create objects (Task, Project, Epic, Rule)</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">load_object</code> - Load object property schemas</li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Variable Interpolation:</h4>
              <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">{'{{input.fieldName}}'}</code> - Access workflow input parameter</li>
                <li><code className="text-xs bg-muted px-1 py-0.5 rounded">{'{{steps.stepName.output}}'}</code> - Access previous step result</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
