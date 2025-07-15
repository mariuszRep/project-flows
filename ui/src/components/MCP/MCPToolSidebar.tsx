import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Wrench, ChevronRight, Wifi, WifiOff, Loader2 } from 'lucide-react';

interface Tool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface MCPToolSidebarProps {
  tools: Tool[];
  onToolSelect: (tool: Tool) => void;
  selectedTool?: Tool | null;
  isCollapsed?: boolean;
  isConnected: boolean;
  isLoading: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

export const MCPToolSidebar: React.FC<MCPToolSidebarProps> = ({ 
  tools, 
  onToolSelect, 
  selectedTool,
  isCollapsed = false,
  isConnected,
  isLoading,
  onConnect,
  onDisconnect
}) => {
  if (tools.length === 0) {
    return (
      <div className="p-3">
        {/* Connection buttons */}
        <div className="mb-3">
          {isConnected ? (
            <Button 
              onClick={onDisconnect}
              variant="outline"
              size="sm"
              className="w-full"
              disabled={isLoading}
            >
              <WifiOff className="w-4 h-4 mr-2" />
              {!isCollapsed && "Disconnect"}
            </Button>
          ) : (
            <Button 
              onClick={onConnect}
              size="sm"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {!isCollapsed && "Connecting..."}
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  {!isCollapsed && "Connect"}
                </>
              )}
            </Button>
          )}
        </div>

        <div className="text-center">
          <Wrench className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          {!isCollapsed && (
            <>
              <p className="text-sm text-muted-foreground">No tools available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Connect to an MCP server
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3">
      {/* Connection buttons */}
      <div className="mb-3">
        {isConnected ? (
          <Button 
            onClick={onDisconnect}
            variant="outline"
            size="sm"
            className="w-full"
            disabled={isLoading}
          >
            <WifiOff className="w-4 h-4 mr-2" />
            {!isCollapsed && "Disconnect"}
          </Button>
        ) : (
          <Button 
            onClick={onConnect}
            size="sm"
            className="w-full"
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {!isCollapsed && "Connecting..."}
              </>
            ) : (
              <>
                <Wifi className="w-4 h-4 mr-2" />
                {!isCollapsed && "Connect"}
              </>
            )}
          </Button>
        )}
      </div>

      {!isCollapsed && (
        <div className="px-1 mb-3">
          <h3 className="text-sm font-medium text-muted-foreground">Tools</h3>
        </div>
      )}
      
      <div className="space-y-1">
        {tools.map((tool) => (
          <Button
            key={tool.name}
            variant={selectedTool?.name === tool.name ? "secondary" : "ghost"}
            className={`w-full justify-start text-left h-auto p-2 ${
              isCollapsed ? 'px-2' : 'px-3'
            }`}
            onClick={() => onToolSelect(tool)}
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <Wrench className="w-4 h-4 flex-shrink-0" />
              
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{tool.name}</div>
                    {tool.description && (
                      <div className="text-xs text-muted-foreground truncate mt-0.5">
                        {tool.description}
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Badge variant="outline" className="text-xs px-1.5 py-0.5">
                      {Object.keys(tool.inputSchema?.properties || {}).length}
                    </Badge>
                    {selectedTool?.name === tool.name && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                </>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
};