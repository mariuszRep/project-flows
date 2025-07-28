import React from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Wifi, WifiOff, Loader2, AlertCircle, CheckCircle, RotateCcw } from 'lucide-react';
import { ConnectionState, ConnectionProgress } from '@/services/connectionService';

interface ConnectionStatusProps {
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  toolCount: number;
  serverUrl: string;
  autoConnect: boolean;
  connectionState: ConnectionState;
  connectionProgress: ConnectionProgress | null;
  onConnect: () => void;
  onDisconnect: () => void;
  onServerUrlChange: (url: string) => void;
  onAutoConnectChange: (enabled: boolean) => void;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isConnected,
  isLoading,
  error,
  toolCount,
  serverUrl,
  autoConnect,
  connectionState,
  connectionProgress,
  onConnect,
  onDisconnect,
  onServerUrlChange,
  onAutoConnectChange,
}) => {
  const getStatusBadge = () => {
    switch (connectionState) {
      case ConnectionState.CONNECTED:
        return <Badge variant="default">Connected</Badge>;
      case ConnectionState.CONNECTING:
        return <Badge variant="secondary">Connecting...</Badge>;
      case ConnectionState.RECONNECTING:
        return <Badge variant="secondary">Reconnecting...</Badge>;
      case ConnectionState.CONNECTION_LOST:
        return <Badge variant="destructive">Connection Lost</Badge>;
      case ConnectionState.FAILED:
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Disconnected</Badge>;
    }
  };

  const getConnectionIcon = () => {
    if (isLoading) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }
    return isConnected ? (
      <Wifi className="w-5 h-5 text-green-500" />
    ) : (
      <WifiOff className="w-5 h-5 text-muted-foreground" />
    );
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getConnectionIcon()}
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

        <div className="flex items-center justify-between">
          <Label htmlFor="auto-connect" className="text-sm font-medium">
            Auto-connect on startup
          </Label>
          <Switch
            id="auto-connect"
            checked={autoConnect}
            onCheckedChange={onAutoConnectChange}
            disabled={isLoading}
          />
        </div>
        
        <div className="flex items-center gap-2">
          {getStatusBadge()}
          {isConnected && (
            <Badge variant="outline">
              {toolCount} tools available
            </Badge>
          )}
          {connectionProgress && connectionProgress.state === ConnectionState.RECONNECTING && (
            <Badge variant="outline">
              Attempt {connectionProgress.attempt}/{connectionProgress.maxAttempts}
              {connectionProgress.nextRetryIn && (
                <span className="ml-1">
                  (retry in {Math.ceil(connectionProgress.nextRetryIn / 1000)}s)
                </span>
              )}
            </Badge>
          )}
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error}
              {connectionProgress && connectionProgress.state === ConnectionState.RECONNECTING && (
                <div className="mt-2 text-sm">
                  Retrying connection... (attempt {connectionProgress.attempt}/{connectionProgress.maxAttempts})
                </div>
              )}
            </AlertDescription>
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
            <>
              <Button 
                onClick={onConnect}
                disabled={isLoading || !serverUrl}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    {connectionState === ConnectionState.RECONNECTING ? 'Reconnecting...' : 'Connecting...'}
                  </>
                ) : (
                  <>
                    <Wifi className="w-4 h-4 mr-2" />
                    Connect
                  </>
                )}
              </Button>
              {connectionState === ConnectionState.FAILED && (
                <Button 
                  onClick={onConnect}
                  variant="outline"
                  disabled={isLoading}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};