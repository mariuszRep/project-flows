import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Play, CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface Tool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface ToolExecutorProps {
  tool: Tool;
  onExecute: (toolName: string, args: any) => Promise<any>;
  isLoading?: boolean;
}

export const ToolExecutor: React.FC<ToolExecutorProps> = ({ 
  tool, 
  onExecute, 
  isLoading = false 
}) => {
  const [args, setArgs] = useState<Record<string, any>>({});
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);

  const properties = tool.inputSchema?.properties || {};
  const required = tool.inputSchema?.required || [];

  const handleInputChange = (paramName: string, value: any) => {
    setArgs(prev => ({
      ...prev,
      [paramName]: value
    }));
  };

  const handleExecute = async () => {
    setExecuting(true);
    setError(null);
    setResult(null);

    try {
      const response = await onExecute(tool.name, args);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  const canExecute = () => {
    return required.every(param => args[param] !== undefined && args[param] !== '');
  };

  const renderInput = (paramName: string, schema: any) => {
    const isRequired = required.includes(paramName);
    const type = schema.type || 'string';
    
    if (schema.enum) {
      return (
        <Select 
          value={args[paramName] || ''} 
          onValueChange={(value) => handleInputChange(paramName, value)}
        >
          <SelectTrigger>
            <SelectValue placeholder={`Select ${paramName}`} />
          </SelectTrigger>
          <SelectContent>
            {schema.enum.map((option: string) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (type === 'number') {
      return (
        <Input
          type="number"
          value={args[paramName] || ''}
          onChange={(e) => handleInputChange(paramName, parseFloat(e.target.value) || 0)}
          placeholder={schema.description}
        />
      );
    }

    if (type === 'boolean') {
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            id={paramName}
            checked={args[paramName] || false}
            onCheckedChange={(checked) => handleInputChange(paramName, checked)}
          />
          <Label htmlFor={paramName} className="text-sm">
            {schema.description || paramName}
          </Label>
        </div>
      );
    }

    if (type === 'string' && (schema.description?.includes('body') || schema.description?.includes('content'))) {
      return (
        <Textarea
          value={args[paramName] || ''}
          onChange={(e) => handleInputChange(paramName, e.target.value)}
          placeholder={schema.description}
          rows={4}
        />
      );
    }

    return (
      <Input
        value={args[paramName] || ''}
        onChange={(e) => handleInputChange(paramName, e.target.value)}
        placeholder={schema.description}
      />
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Execute Tool: {tool.name}
        </CardTitle>
        {tool.description && (
          <CardDescription>{tool.description}</CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {Object.entries(properties).map(([paramName, schema]: [string, any]) => (
          <div key={paramName} className="space-y-2">
            <Label htmlFor={paramName} className="flex items-center gap-2">
              {paramName}
              {required.includes(paramName) && (
                <Badge variant="destructive" className="text-xs">Required</Badge>
              )}
            </Label>
            {renderInput(paramName, schema)}
            {schema.description && (
              <p className="text-xs text-muted-foreground">{schema.description}</p>
            )}
          </div>
        ))}

        <div className="pt-4 border-t">
          <Button
            onClick={handleExecute}
            disabled={!canExecute() || executing || isLoading}
            className="w-full"
          >
            {executing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Executing...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Execute Tool
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {result && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">Result:</p>
                {result.content && result.content.length > 0 && result.content[0].text ? (
                  <div className="text-sm bg-muted p-3 rounded border overflow-x-auto whitespace-pre-wrap">
                    {result.content[0].text}
                  </div>
                ) : (
                  <pre className="text-xs bg-muted p-2 rounded overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(result, null, 2)}
                  </pre>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};