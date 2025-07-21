import React from 'react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import { Moon, Sun, Monitor } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { HeaderLayout } from '@/components/layout/HeaderLayout';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { ConnectionStatus } from '@/components/MCP/ConnectionStatus';
import { useMCP } from '@/contexts/MCPContext';

function Settings() {
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const {
    isConnected,
    isLoading,
    error,
    serverUrl,
    setServerUrl,
    connect,
    disconnect,
    tools
  } = useMCP();
  
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/auth');
  };
  
  const handleSettingsClick = () => {
    // Already on settings page, no need to navigate
  };

  return (
    <HeaderLayout
      handleSignOut={handleSignOut}
    >
      <div>
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="text-2xl font-bold mb-6">Settings</h1>
          
          <Card className="mb-6 text-left">
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Customize how the application looks</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium mb-3">Theme</h3>
                <div className="flex flex-wrap gap-4">
                  <Button
                    variant={theme === 'light' ? 'default' : 'outline'}
                    className="flex items-center gap-2 px-4"
                    onClick={() => setTheme('light')}
                  >
                    <Sun className="h-5 w-5" />
                    Light
                  </Button>
                  <Button
                    variant={theme === 'dark' ? 'default' : 'outline'}
                    className="flex items-center gap-2 px-4"
                    onClick={() => setTheme('dark')}
                  >
                    <Moon className="h-5 w-5" />
                    Dark
                  </Button>
                  <Button
                    variant={theme === 'system' ? 'default' : 'outline'}
                    className="flex items-center gap-2 px-4"
                    onClick={() => setTheme('system')}
                  >
                    <Monitor className="h-5 w-5" />
                    System
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
          </Card>

          <Card className="mb-6 text-left">
            <CardHeader>
              <CardTitle>MCP Server Connection</CardTitle>
              <CardDescription>Configure your MCP server connection</CardDescription>
            </CardHeader>
            <CardContent>
              <ConnectionStatus
                isConnected={isConnected}
                isLoading={isLoading}
                error={error}
                toolCount={tools.length}
                serverUrl={serverUrl}
                onConnect={connect}
                onDisconnect={disconnect}
                onServerUrlChange={setServerUrl}
              />
            </CardContent>
          </Card>

          {/* Additional settings sections can be added here */}
        </div>
      </div>
    </HeaderLayout>
  );
}

export default Settings;
