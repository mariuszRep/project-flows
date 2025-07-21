import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wrench, ChevronRight } from 'lucide-react';

interface Tool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface MCPToolListProps {
  tools: Tool[];
  onToolSelect: (tool: Tool) => void;
  selectedTool?: Tool | null;
}

export const MCPToolList: React.FC<MCPToolListProps> = ({ 
  tools, 
  onToolSelect, 
  selectedTool 
}) => {
  if (tools.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <Wrench className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">No tools available</p>
            <p className="text-sm text-muted-foreground mt-2">
              Connect to an MCP server to see available tools
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          Available MCP Tools
        </CardTitle>
        <CardDescription>
          {tools.length} tools available from connected MCP server
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-2">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className={`p-3 rounded-lg border cursor-pointer transition-all hover:bg-muted/50 ${
              selectedTool?.name === tool.name 
                ? 'border-primary bg-primary/5' 
                : 'border-border hover:border-muted-foreground/50'
            }`}
            onClick={() => onToolSelect(tool)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{tool.name}</h3>
                {tool.description && (
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                    {tool.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 ml-4">
                <Badge variant="secondary" className="text-xs">
                  {Object.keys(tool.inputSchema?.properties || {}).length} params
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};