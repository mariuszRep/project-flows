import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Task, TaskStage } from '@/types/task';
import { Project } from '@/types/project';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface TaskCardProps {
  task: Task;
  onUpdate: (taskId?: number, newStage?: string) => void;
  onDelete: () => void;
  onEdit: () => void;
  isDragging?: boolean;
  projects: Project[];
}

export const TaskCard: React.FC<TaskCardProps> = ({ 
  task, 
  onUpdate, 
  onDelete, 
  onEdit,
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
    console.log('Edit task:', task.id);
    onEdit();
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

  const getProjectColor = (project: Project | undefined) => {
    if (!project) return 'bg-muted text-muted-foreground';
    
    // Use a consistent color scheme for project badges
    const colors = [
      'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300',
      'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300',
      'bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-300',
      'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300',
    ];
    
    // Use project ID to consistently assign colors
    return colors[project.id % colors.length];
  };

  const project = getProject(task.project_id);

  return (
    <Card 
      className={`group hover:shadow-md transition-all duration-200 cursor-grab active:cursor-grabbing bg-card border border-border ${
        isDragging ? 'shadow-xl ring-2 ring-primary ring-opacity-50' : ''
      }`}
      onDoubleClick={handleEdit}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-card-foreground line-clamp-2">
              <span className="text-muted-foreground">#{task.id}</span> {task.title}
            </CardTitle>
          </div>
        </div>
      </CardHeader>
      
      {task.body && (
        <CardContent className="pt-0 pb-3">
          <div className="text-sm text-muted-foreground line-clamp-3 prose dark:prose-invert max-w-none prose-p:mb-0 prose-headings:mb-0 prose-headings:mt-0 prose-lists:mb-0">
            <MarkdownRenderer content={task.body} />
          </div>
        </CardContent>
      )}
      
      <CardFooter className="pt-0 pb-3">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            {project && (
              <Badge 
                variant="secondary" 
                className={`text-xs ${getProjectColor(project)}`}
              >
                {project.name}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDate(task.created_at)}
          </div>
        </div>
      </CardFooter>
    </Card>
  );
};