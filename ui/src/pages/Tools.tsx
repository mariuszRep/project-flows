import { useEffect, useState } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useMCP } from '@/contexts/MCPContext';
import { MCPToolSidebar } from '@/components/MCP/MCPToolSidebar';
import { ToolExecutor } from '@/components/MCP/ToolExecutor';

interface Tool {
  name: string;
  description?: string;
  inputSchema: any;
}

export default function Tools() {
  const navigate = useNavigate();
  const { selectedSession, setSelectedSession } = useSession();
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  
  const { 
    isConnected, 
    isLoading, 
    error, 
    tools, 
    serverUrl,
    setServerUrl,
    connect, 
    disconnect, 
    callTool 
  } = useMCP();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
      }
    };

    checkAuth();
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleToolSelect = (tool: Tool) => {
    setSelectedTool(tool);
  };

  const handleToolExecute = async (toolName: string, args: any) => {
    return await callTool(toolName, args);
  };

  // Placeholder props for HeaderAndSidebarLayout
  const placeholderProps = {
    selectedSession: selectedSession,
    titleInput: '',
    editingTitle: false,
    setTitleInput: () => {},
    setEditingTitle: () => {},
    handleUpdateTitle: () => {},
    refreshSessions: () => {},
  };

  return (
    <HeaderAndSidebarLayout
      {...placeholderProps}
      handleSignOut={handleSignOut}
      onSettingsClick={handleSettingsClick}
      sidebarContent={
        <MCPToolSidebar
          tools={tools}
          onToolSelect={handleToolSelect}
          selectedTool={selectedTool}
          isConnected={isConnected}
          isLoading={isLoading}
          onConnect={connect}
          onDisconnect={disconnect}
        />
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">MCP Tools</h1>
            <p className="text-muted-foreground">
              Connect to Model Context Protocol servers and execute tools
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <div>
            {selectedTool ? (
              <ToolExecutor
                tool={selectedTool}
                onExecute={handleToolExecute}
                isLoading={isLoading}
              />
            ) : (
              <div className="flex items-center justify-center h-64 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                <div className="text-center">
                  <p className="text-muted-foreground">Select a tool to execute</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Choose a tool from the list to see its parameters and execute it
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </HeaderAndSidebarLayout>
  );
}