import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { connectionService, ConnectionState, ConnectionProgress } from '../services/connectionService';
import { useConnectionPersistence } from '../hooks/useConnectionPersistence';
import { changeEventService } from '../services/changeEventService';
import { notificationService } from '../services/notificationService';

interface Tool {
  name: string;
  description?: string;
  inputSchema: any;
}

interface MCPContextState {
  client: Client | null;
  tools: Tool[];
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  serverUrl: string;
  autoConnect: boolean;
  connectionState: ConnectionState;
  connectionProgress: ConnectionProgress | null;
  setServerUrl: (url: string) => void;
  setAutoConnect: (enabled: boolean) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  callTool: (name: string, args?: any) => Promise<any>;
}

const MCPContext = createContext<MCPContextState | null>(null);

interface MCPProviderProps {
  children: ReactNode;
}

export const MCPProvider: React.FC<MCPProviderProps> = ({ children }) => {
  const { settings, updateSettings, updateLastConnection } = useConnectionPersistence();
  const [state, setState] = useState({
    client: null as Client | null,
    tools: [] as Tool[],
    isConnected: false,
    isLoading: false,
    error: null as string | null,
    connectionState: ConnectionState.DISCONNECTED as ConnectionState,
    connectionProgress: null as ConnectionProgress | null,
  });
  const [heartbeatCleanup, setHeartbeatCleanup] = useState<(() => void) | null>(null);

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const result = await connectionService.connectWithRetry(
      settings.serverUrl,
      settings.maxRetryAttempts,
      (progress) => {
        setState(prev => ({ 
          ...prev, 
          connectionState: progress.state,
          connectionProgress: progress,
          isLoading: progress.state === ConnectionState.CONNECTING || progress.state === ConnectionState.RECONNECTING,
          error: progress.error || null,
        }));
      }
    );

    if (result.success && result.client && result.tools) {
      // Setup heartbeat monitoring
      const cleanup = connectionService.createConnectionHeartbeat(
        result.client,
        30000,
        () => {
          setState(prev => ({
            ...prev,
            connectionState: ConnectionState.CONNECTION_LOST,
            error: 'Connection lost to MCP server',
          }));
          // Auto-reconnect if enabled
          if (settings.autoConnect) {
            setTimeout(() => connect(), 2000);
          }
        }
      );
      setHeartbeatCleanup(() => cleanup);
      
      setState(prev => ({
        ...prev,
        client: result.client!,
        tools: result.tools!,
        isConnected: true,
        isLoading: false,
        error: null,
        connectionState: ConnectionState.CONNECTED,
        connectionProgress: null,
      }));
      
      updateLastConnection();
      console.log('Connected to MCP server', { tools: result.tools!.length });
    } else {
      setState(prev => ({
        ...prev,
        isLoading: false,
        isConnected: false,
        connectionState: ConnectionState.FAILED,
        error: result.error || 'Connection failed',
      }));
    }
  }, [settings.serverUrl, settings.maxRetryAttempts, settings.autoConnect, updateLastConnection]);

  const disconnect = useCallback(async () => {
    // Cleanup heartbeat
    if (heartbeatCleanup) {
      heartbeatCleanup();
      setHeartbeatCleanup(null);
    }
    
    if (state.client) {
      try {
        await state.client.close();
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }
    setState(prev => ({
      ...prev,
      client: null,
      tools: [],
      isConnected: false,
      isLoading: false,
      error: null,
      connectionState: ConnectionState.DISCONNECTED,
      connectionProgress: null,
    }));
  }, [state.client, heartbeatCleanup]);

  const callTool = useCallback(async (name: string, args: any = {}) => {
    if (!state.client || !state.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await state.client.callTool({ name, arguments: args });
      
      // Emit appropriate events based on the tool called for direct MCP tool calls
      // This ensures that even direct MCP tool calls (not through useChangeEvents) trigger UI updates
      if (name.includes('task') && (name.includes('create') || name.includes('update') || name.includes('delete'))) {
        console.log('MCP task operation completed, emitting task_changed event');
        changeEventService.emit('task_changed');
        changeEventService.emit('data_changed');
      } else if (name.includes('project') && (name.includes('create') || name.includes('update') || name.includes('delete'))) {
        console.log('MCP project operation completed, emitting project_changed event');
        changeEventService.emit('project_changed');
        changeEventService.emit('data_changed');
      }
      
      return result;
    } catch (error) {
      console.error('Tool call failed:', error);
      throw error;
    }
  }, [state.client, state.isConnected]);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (settings.autoConnect && !state.isConnected && state.connectionState === ConnectionState.DISCONNECTED) {
      console.log('Auto-connecting to MCP server...');
      connect();
    }
  }, [settings.autoConnect, state.isConnected, state.connectionState, connect]);
  
  // Connect to notification service when MCP client is connected
  useEffect(() => {
    if (!state.isConnected || !settings.serverUrl) return;
    
    // Extract base URL from MCP server URL (remove /sse endpoint)
    const baseServerUrl = settings.serverUrl.replace(/\/sse$/, '');
    
    // Connect to notification service
    notificationService.connect(baseServerUrl);
    
    // Cleanup function
    return () => {
      notificationService.disconnect();
    };
  }, [state.isConnected, settings.serverUrl]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (heartbeatCleanup) {
        heartbeatCleanup();
      }
      if (state.client) {
        state.client.close().catch(console.error);
      }
    };
  }, [state.client, heartbeatCleanup]);

  // Listen for browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      if (settings.autoConnect && !state.isConnected) {
        console.log('Browser back online, attempting to reconnect...');
        connect();
      }
    };

    const handleOffline = () => {
      setState(prev => ({
        ...prev,
        connectionState: ConnectionState.CONNECTION_LOST,
        error: 'Browser is offline',
      }));
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [settings.autoConnect, state.isConnected, connect]);

  const setServerUrl = useCallback((url: string) => {
    updateSettings({ serverUrl: url });
  }, [updateSettings]);

  const setAutoConnect = useCallback((enabled: boolean) => {
    updateSettings({ autoConnect: enabled });
  }, [updateSettings]);

  const contextValue: MCPContextState = {
    ...state,
    serverUrl: settings.serverUrl,
    autoConnect: settings.autoConnect,
    setServerUrl,
    setAutoConnect,
    connect,
    disconnect,
    callTool,
  };

  return (
    <MCPContext.Provider value={contextValue}>
      {children}
    </MCPContext.Provider>
  );
};

export const useMCP = (): MCPContextState => {
  const context = useContext(MCPContext);
  if (!context) {
    throw new Error('useMCP must be used within an MCPProvider');
  }
  return context;
};