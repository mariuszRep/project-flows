import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Edit, Trash2, ArrowRight } from 'lucide-react';
import { Task, TaskStage } from '@/types/task';
import { Project } from '@/types/project';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId?: number, newStage?: string) => void;
  onDelete: () => void;
  isDragging?: boolean;
  projects: Project[];
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onUpdate, 
  onDelete, 
  isDragging = false,
  projects
}) => {
  const [isMoving, setIsMoving] = useState(false);

  const handleStageMove = async (newStage: TaskStage) => {
    try {
      setIsMoving(true);
      await onUpdate(task.id, newStage);
    } catch (error) {
      console.error('Error moving task:', error);
    } finally {
      setIsMoving(false);
    }
  };

  const handleEdit = () => {
    // In a real app, this would open an edit modal
    console.log('Edit task:', task.id);
  };

  const handleDelete = () => {
    // In a real app, this would open a delete confirmation modal
    console.log('Delete task:', task.id);
    onDelete();
  };

  const getProject = (projectId?: number) => {
    return projects.find(p => p.id === projectId);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getStageColor = (stage: TaskStage) => {
    switch (stage) {
      case 'backlog': return 'bg-muted text-muted-foreground';
      case 'doing': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300';
      case 'review': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
      case 'completed': return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const project = getProject(task.project_id);

  return (
    <Card className={`group hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing bg-card border border-border ${
      isDragging ? 'shadow-xl ring-2 ring-primary ring-opacity-50' : ''
    }`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-card-foreground line-clamp-2">
              {task.title}
            </CardTitle>
            {project && (
              <div className="flex items-center gap-2 mt-1">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: project.color }}
                />
                <span className="text-xs text-muted-foreground">{project.name}</span>
              </div>
            )}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                disabled={isMoving}
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit
              </DropdownMenuItem>
              {task.stage !== 'doing' && (
                <DropdownMenuItem onClick={() => handleStageMove('doing')}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to Doing
                </DropdownMenuItem>
              )}
              {task.stage !== 'review' && (
                <DropdownMenuItem onClick={() => handleStageMove('review')}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to Review
                </DropdownMenuItem>
              )}
              {task.stage !== 'completed' && (
                <DropdownMenuItem onClick={() => handleStageMove('completed')}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to Completed
                </DropdownMenuItem>
              )}
              {task.stage !== 'backlog' && (
                <DropdownMenuItem onClick={() => handleStageMove('backlog')}>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Move to Backlog
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={handleDelete} className="text-red-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      {task.body && (
        <CardContent className="pt-0 pb-3">
          <p className="text-sm text-muted-foreground line-clamp-3">
            {task.body}
          </p>
        </CardContent>
      )}
      
      <CardFooter className="pt-0 pb-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Badge 
              variant="secondary" 
              className={`text-xs ${getStageColor(task.stage)}`}
            >
              {task.stage}
            </Badge>
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(task.created_at)}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};