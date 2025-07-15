import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

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
  setServerUrl: (url: string) => void;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  callTool: (name: string, args?: any) => Promise<any>;
}

const MCPContext = createContext<MCPContextState | null>(null);

interface MCPProviderProps {
  children: ReactNode;
}

export const MCPProvider: React.FC<MCPProviderProps> = ({ children }) => {
  const [serverUrl, setServerUrl] = useState<string>('http://localhost:3001/sse');
  const [state, setState] = useState({
    client: null as Client | null,
    tools: [] as Tool[],
    isConnected: false,
    isLoading: false,
    error: null as string | null,
  });

  const connect = useCallback(async () => {
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      // Add client identification for audit tracking
      const urlWithClient = new URL(serverUrl);
      urlWithClient.searchParams.set('client', 'ui-client');
      
      const transport = new SSEClientTransport(urlWithClient);
      const client = new Client(
        { name: 'ui-client', version: '1.0.0' }, 
        { capabilities: { tools: {} } }
      );
      
      await client.connect(transport);
      
      // List available tools
      const toolsResponse = await client.listTools();
      const tools = toolsResponse.tools || [];
      
      setState(prev => ({
        ...prev,
        client,
        tools,
        isConnected: true,
        isLoading: false,
        error: null,
      }));
      
      console.log('Connected to MCP server', { tools: tools.length });
    } catch (error) {
      console.error('Failed to connect to MCP server:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  }, [serverUrl]);

  const disconnect = useCallback(async () => {
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
    }));
  }, [state.client]);

  const callTool = useCallback(async (name: string, args: any = {}) => {
    if (!state.client || !state.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    try {
      const result = await state.client.callTool({ name, arguments: args });
      return result;
    } catch (error) {
      console.error('Tool call failed:', error);
      throw error;
    }
  }, [state.client, state.isConnected]);

  useEffect(() => {
    return () => {
      if (state.client) {
        state.client.close().catch(console.error);
      }
    };
  }, [state.client]);

  const contextValue: MCPContextState = {
    ...state,
    serverUrl,
    setServerUrl,
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