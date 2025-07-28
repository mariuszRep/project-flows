import React from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, Wifi, WifiOff } from 'lucide-react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-64 text-center p-6 border border-dashed rounded-lg bg-muted/10">
      <div className="mb-4 text-muted-foreground bg-muted/20 p-4 rounded-full">
        {icon || <AlertCircle className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="default">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function MCPDisconnectedState() {
  return (
    <EmptyState
      icon={<WifiOff className="h-12 w-12 text-amber-500" />}
      title="MCP Server Not Connected"
      description="To view and manage your tasks, you need to connect to the MCP server. Tasks are only available when connected to the server. Please check that the server is running at the correct address and port, then try refreshing the page or configure connection settings."
      action={{
        label: "Configure Connection",
        onClick: () => window.location.href = "/settings"
      }}
    />
  );
}

export function NoTasksState() {
  return (
    <EmptyState
      icon={<AlertCircle className="h-12 w-12 text-blue-500" />}
      title="No Tasks Available"
      description="You're connected to the MCP server, but no tasks were found. Click the 'Add Task' button above to create your first task and get started organizing your project workflow."
      action={{
        label: "Create First Task",
        onClick: () => {
          // Find the Add Task button by looking for buttons that contain the text
          const buttons = Array.from(document.querySelectorAll('button'));
          const addTaskButton = buttons.find(button => 
            button.textContent?.includes('Add Task')
          );
          if (addTaskButton) {
            addTaskButton.click();
          }
        }
      }}
    />
  );
}