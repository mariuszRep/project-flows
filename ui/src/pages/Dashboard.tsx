import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LogOut, Activity, Layout as LayoutIcon, Settings as SettingsIcon, Wrench, Kanban } from "lucide-react";
import { HeaderLayout } from "@/components/layout/HeaderLayout";

const Dashboard = () => {
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <HeaderLayout handleSignOut={handleSignOut}>
      <div>
        <div className="text-center mx-auto max-w-5xl w-full">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Welcome to the App!
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            You have successfully signed in.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Board Card */}
            <Card className="card-hover" onClick={() => navigate('/board')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Kanban className="w-5 h-5" />
                  Task Board
                </CardTitle>
                <CardDescription>
                  Manage your tasks with drag-and-drop kanban boards.
                </CardDescription>
              </CardHeader>
            </Card>
            
            {/* Template Card */}
            <Card className="card-hover" onClick={() => navigate('/template')}>
              <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Template
              </CardTitle>
              <CardDescription>
                Create and manage workflow automations with visual canvas.
              </CardDescription>
            </CardHeader>
          </Card>
          
          {/* MCP Tools Card */}
          <Card className="card-hover" onClick={() => navigate('/tools')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                MCP Tools
              </CardTitle>
              <CardDescription>
                Connect to Model Context Protocol servers and execute tools.
              </CardDescription>
            </CardHeader>
          </Card>
          
          {/* UI Components Card */}
          <Card className="card-hover" onClick={() => navigate('/layout')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LayoutIcon className="w-5 h-5" />
                UI Components
              </CardTitle>
              <CardDescription>
                Explore the UI component library with interactive examples.
              </CardDescription>
            </CardHeader>
          </Card>
          
          {/* Settings Card */}
          <Card className="card-hover" onClick={() => navigate('/settings')}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5" />
                Settings
              </CardTitle>
              <CardDescription>
                Customize application appearance and preferences.
              </CardDescription>
            </CardHeader>
          </Card>
          </div>
        </div>
      </div>
    </HeaderLayout>
  );
};

export default Dashboard;