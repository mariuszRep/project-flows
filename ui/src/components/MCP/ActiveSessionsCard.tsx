import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, X, RefreshCw } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface SessionInfo {
  sessionId: string;
  clientId: string;
  connectedAt: string;
  duration: number; // in seconds
}

interface ActiveSessionsCardProps {
  serverUrl?: string;
  refreshInterval?: number; // in milliseconds
}

export const ActiveSessionsCard: React.FC<ActiveSessionsCardProps> = ({
  serverUrl = 'http://localhost:3001',
  refreshInterval = 5000, // 5 seconds
}) => {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState<Set<string>>(new Set());

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${serverUrl}/api/sessions`);
      const data = await response.json();

      if (data.success) {
        setSessions(data.sessions);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch sessions');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    setDisconnecting(prev => new Set(prev).add(sessionId));

    try {
      const response = await fetch(`${serverUrl}/api/sessions/${sessionId}/disconnect`, {
        method: 'POST',
      });

      const data = await response.json();

      if (data.success) {
        // Refresh the session list
        await fetchSessions();
      } else {
        setError(data.error || 'Failed to disconnect session');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setDisconnecting(prev => {
        const next = new Set(prev);
        next.delete(sessionId);
        return next;
      });
    }
  };

  const formatDuration = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  };

  const truncateSessionId = (sessionId: string): string => {
    return `${sessionId.substring(0, 8)}...`;
  };

  useEffect(() => {
    fetchSessions();

    const interval = setInterval(fetchSessions, refreshInterval);

    return () => clearInterval(interval);
  }, [serverUrl, refreshInterval]);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              Active MCP Sessions
              <Badge variant="secondary">{sessions.length}</Badge>
            </CardTitle>
            <CardDescription>
              Connected clients with active sessions
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchSessions}
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isLoading && sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            Loading sessions...
          </div>
        ) : sessions.length === 0 ? (
          <div className="text-center text-muted-foreground py-4">
            No active sessions
          </div>
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <div
                key={session.sessionId}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="font-medium">{session.clientId}</span>
                  </div>
                  <div className="text-sm text-muted-foreground space-y-0.5">
                    <div className="font-mono">
                      Session: {truncateSessionId(session.sessionId)}
                    </div>
                    <div>
                      Connected: {formatDuration(session.duration)}
                    </div>
                  </div>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDisconnect(session.sessionId)}
                  disabled={disconnecting.has(session.sessionId)}
                  title="Disconnect session"
                >
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
