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
    <div className="flex flex-col items-center justify-center h-64 text-center">
      <div className="mb-4 text-muted-foreground">
        {icon || <AlertCircle className="h-12 w-12" />}
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">{description}</p>
      {action && (
        <Button onClick={action.onClick} variant="outline">
          {action.label}
        </Button>
      )}
    </div>
  );
}

export function MCPDisconnectedState() {
  return (
    <EmptyState
      icon={<WifiOff className="h-12 w-12" />}
      title="MCP Server Not Connected"
      description="Connect to the MCP server to view and manage your tasks. Please ensure the MCP server is running and accessible."
    />
  );
}

export function NoTasksState() {
  return (
    <EmptyState
      icon={<AlertCircle className="h-12 w-12" />}
      title="No Tasks Found"
      description="You don't have any tasks yet. Create your first task to get started with your project board."
    />
  );
}