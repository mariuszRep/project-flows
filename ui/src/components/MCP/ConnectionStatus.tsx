import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Wifi, WifiOff, Loader2, AlertCircle, CheckCircle } from 'lucide-react';

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  toolCount: number;
  serverUrl: string;
  onConnect: () => void;
  onDisconnect: () => void;
  onServerUrlChange: (url: string) => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isLoading,
  error,
  toolCount,
  serverUrl,
  onConnect,
  onDisconnect,
  onServerUrlChange
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isConnected ? (
            <Wifi className="w-5 h-5 text-green-500" />
          ) : (
            <WifiOff className="w-5 h-5 text-muted-foreground" />
          )}
          MCP Server Connection
        </CardTitle>
        <CardDescription>
          Connect to an MCP server to access available tools
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="server-url">Server URL</Label>
          <Input
            id="server-url"
            value={serverUrl}
            onChange={(e) => onServerUrlChange(e.target.value)}
            placeholder="http://localhost:3001/sse"
            disabled={isConnected || isLoading}
          />
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={isConnected ? "default" : "secondary"}>
            {isConnected ? "Connected" : "Disconnected"}
          </Badge>
          {isConnected && (
            <Badge variant="outline">
              {toolCount} tools available
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isConnected && !error && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              Successfully connected to MCP server with {toolCount} tools available
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          {isConnected ? (
            <Button 
              onClick={onDisconnect}
              variant="outline"
              disabled={isLoading}
            >
              <WifiOff className="w-4 h-4 mr-2" />
              Disconnect
            </Button>
          ) : (
            <Button 
              onClick={onConnect}
              disabled={isLoading || !serverUrl}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Wifi className="w-4 h-4 mr-2" />
                  Connect
                </>
              )}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};