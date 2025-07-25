import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { LogOut, Activity, Layout as LayoutIcon, Settings as SettingsIcon, Wrench, Kanban, Filter } from "lucide-react";
import { HeaderLayout } from "@/components/layout/HeaderLayout";

const Dashboard = () => {
  const navigate = useNavigate();

  return (
    <HeaderLayout>
      <div>
        <div className="text-center mx-auto max-w-5xl w-full">
          <h1 className="text-4xl font-bold gradient-text mb-4">
            Welcome to Project Flows!
          </h1>
          <p className="text-muted-foreground text-lg mb-8">
            Manage your projects with powerful workflow automation and task management.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {/* Board Card */}
            <Card className="card-hover" onClick={() => navigate('/task-board')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Kanban className="w-5 h-5" />
                  Task Board
                </CardTitle>
                <CardDescription>
                  Organize and track your project tasks with intuitive kanban boards.
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Task Manager Card */}
            <Card className="card-hover" onClick={() => navigate('/task-list')}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="w-5 h-5" />
                  Task Manager
                </CardTitle>
                <CardDescription>
                  Filter and manage tasks by stage with multi-select filtering options.
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
                Design and manage project templates for consistent workflows.
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
                Access powerful MCP tools to enhance your project workflows.
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
                Browse Project Flows UI components and design system.
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
                Configure Project Flows settings and preferences.
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