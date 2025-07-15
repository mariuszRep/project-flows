import { useEffect, useState } from 'react';
import { HeaderAndSidebarLayout } from '@/components/layout/HeaderAndSidebarLayout';
import { useSession } from '@/contexts/SessionContext';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { TaskForm } from '@/components/template/TaskForm';

export default function Template() {
  const navigate = useNavigate();
  const { selectedSession, setSelectedSession } = useSession();
  const [isTaskFormOpen, setIsTaskFormOpen] = useState(false);
  
  // Function to handle navigation to settings page
  const handleSettingsClick = () => {
    navigate('/settings');
  };

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
      handleSignOut={handleSignOut}
      onSettingsClick={handleSettingsClick}
    >
      <div className="flex flex-col items-center justify-center min-h-full p-6">
        <h2 className="text-2xl font-semibold text-center mb-8">Template Page</h2>
        
        <div className="flex gap-6 max-w-4xl w-full">
          {/* Global Card */}
          <Card className="flex-1 cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg text-center">Global</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Global templates and settings
              </p>
            </CardContent>
          </Card>

          {/* Project Card */}
          <Card className="flex-1 cursor-pointer hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="text-lg text-center">Project</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Project-specific templates
              </p>
            </CardContent>
          </Card>

          {/* Task Card */}
          <Card 
            className="flex-1 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => setIsTaskFormOpen(true)}
          >
            <CardHeader>
              <CardTitle className="text-lg text-center">Task</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">
                Create and manage task templates
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Task Form Modal */}
      <TaskForm 
        isOpen={isTaskFormOpen}
        onClose={() => setIsTaskFormOpen(false)}
      />
    </HeaderAndSidebarLayout>
  );
}
