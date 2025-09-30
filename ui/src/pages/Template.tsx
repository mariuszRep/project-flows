import { useEffect, useState } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import NewTemplateForm from '@/components/forms/TemplateForm';
import { useMCP } from '@/contexts/MCPContext';

interface Template {
  id: number;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  updated_by: string;
}

export default function Template() {
  const navigate = useNavigate();
  const { selectedSession, setSelectedSession } = useSession();
  const { callTool, isConnected, connect, isLoading: mcpLoading, error: mcpError } = useMCP();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Function to handle navigation to settings page
  const handleSettingsClick = () => {
    navigate('/settings');
  };

  // Function to fetch templates from MCP server
  const fetchTemplates = async () => {
    if (!isConnected) {
      setError('Not connected to MCP server');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await callTool('list_templates');
      
      if (result.content && result.content[0] && result.content[0].text) {
        const templatesData = JSON.parse(result.content[0].text);
        setTemplates(templatesData);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to fetch templates');
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  // Function to handle card click
  const handleCardClick = (templateId: number) => {
    setSelectedTemplateId(templateId);
    setIsTaskFormOpen(true);
  };

  useEffect(() => {
    if (isConnected) {
      fetchTemplates();
    } else if (!isConnected && !mcpLoading && !mcpError) {
      // Auto-connect to MCP server if not connected
      connect();
    }
  }, [isConnected, mcpLoading, mcpError, connect]);

  // These are placeholder props that HeaderAndSidebarLayout component requires
  // but aren't needed for the Template page functionality
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
      onSettingsClick={handleSettingsClick}
    >
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <h2 className="text-2xl font-semibold text-center mb-8">Template Page</h2>
        
        {loading && (
          <div className="text-center">
            <p>Loading templates...</p>
          </div>
        )}
        
        {(error || mcpError) && (
          <div className="text-center text-red-500 mb-4">
            <p>{error || mcpError}</p>
            {error && (
              <Button onClick={fetchTemplates} variant="outline" className="mt-2 mr-2">
                Retry
              </Button>
            )}
            {mcpError && (
              <Button onClick={connect} variant="outline" className="mt-2">
                Connect to MCP Server
              </Button>
            )}
          </div>
        )}
        
        {!isConnected && mcpLoading && (
          <div className="text-center text-muted-foreground mb-4">
            <p>Connecting to MCP server...</p>
          </div>
        )}
        
        {!isConnected && !mcpLoading && !mcpError && (
          <div className="text-center mb-4">
            <p className="text-muted-foreground mb-2">Not connected to MCP server</p>
            <Button onClick={connect} variant="outline">
              Connect to MCP Server
            </Button>
          </div>
        )}
        
        {!loading && !error && templates.length === 0 && (
          <div className="text-center text-muted-foreground">
            <p>No templates found</p>
          </div>
        )}
        
        {!loading && !error && templates.length > 0 && (
          <div className="grid gap-6 max-w-4xl w-full grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <Card 
                key={template.id}
                className="cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => handleCardClick(template.id)}
              >
                <CardHeader>
                  <CardTitle className="text-lg text-center">{template.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground text-center">
                    {template.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Template Form Modal */}
      <NewTemplateForm
        isOpen={isTaskFormOpen}
        onClose={() => {
          setIsTaskFormOpen(false);
          setSelectedTemplateId(null);
        }}
        templateId={selectedTemplateId}
      />
    </HeaderAndSidebarLayout>
  );
}
