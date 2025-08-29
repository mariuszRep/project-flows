import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { Epic, EpicStage } from '@/types/epic';
import { Task, TaskStage } from '@/types/task';
import { SlidableTaskCard } from '@/components/ui/slidable-task-card';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface EpicCardProps {
  epic: Epic;
  tasks: Task[];
  initialExpanded?: boolean;
  onEpicUpdate?: (epicId: number, newStage: EpicStage) => void;
  onTaskUpdate?: (taskId: number, newStage: TaskStage) => void;
  onEpicDoubleClick?: () => void;
  onTaskDoubleClick?: (task: Task) => void;
  activeFilters?: Set<string>;
  getStageColor: (stage: TaskStage | EpicStage) => string;
  taskStages: { key: TaskStage; title: string; color: string }[];
  epicStages: { key: EpicStage; title: string; color: string }[];
  getPreviousTaskStage: (currentStage: TaskStage) => TaskStage;
  getNextTaskStage: (currentStage: TaskStage) => TaskStage;
}

export const EpicCard: React.FC<EpicCardProps> = ({
  epic,
  tasks,
  initialExpanded = false,
  onEpicUpdate,
  onTaskUpdate,
  onEpicDoubleClick,
  onTaskDoubleClick,
  activeFilters,
  getStageColor,
  taskStages,
  epicStages,
  getPreviousTaskStage,
  getNextTaskStage,
}) => {
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  // Calculate progress
  const completedTasks = tasks.filter(t => t.stage === 'completed').length;
  const totalTasks = tasks.length;
  const progress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  // Filter tasks based on active filters
  const filteredTasks = activeFilters && activeFilters.size > 0
    ? tasks.filter(task => activeFilters.has(task.stage))
    : tasks;

  // Don't render if filtered out
  if (activeFilters && activeFilters.size > 0 && filteredTasks.length === 0) {
    return null;
  }

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const getEpicTitle = () => {
    return epic.blocks?.Title || epic.title || epic.Title || `Epic #${epic.id}`;
  };

  const getEpicDescription = () => {
    return epic.blocks?.Description || epic.body || epic.Description || '';
  };

  const getEpicPriority = () => {
    return epic.blocks?.Priority || epic.Priority;
  };

  return (
    <Card className="card-hover mb-4">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={handleToggleExpand}
        onDoubleClick={onEpicDoubleClick}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Button variant="ghost" size="sm" className="p-1 h-auto">
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
              <CardTitle className="text-lg font-semibold truncate">
                <span className="text-muted-foreground">#{epic.id}</span> {getEpicTitle()}
              </CardTitle>
              <Badge 
                variant="outline" 
                className={`flex-shrink-0 bg-purple-50 text-purple-700 dark:bg-purple-900 dark:text-purple-300`}
              >
                Epic
              </Badge>
              {epic.stage && (
                <Badge 
                  variant="secondary" 
                  className={`flex-shrink-0 ${getStageColor(epic.stage)}`}
                >
                  {epicStages.find(s => s.key === epic.stage)?.title || epic.stage}
                </Badge>
              )}
              {getEpicPriority() && (
                <Badge 
                  variant="outline" 
                  className={`flex-shrink-0 ${
                    getEpicPriority() === 'High' ? 'text-red-700 border-red-300' :
                    getEpicPriority() === 'Medium' ? 'text-yellow-700 border-yellow-300' :
                    'text-green-700 border-green-300'
                  }`}
                >
                  {getEpicPriority()}
                </Badge>
              )}
            </div>
            {getEpicDescription() && (
              <CardDescription className="line-clamp-2 prose dark:prose-invert max-w-none prose-p:mb-0">
                <MarkdownRenderer content={getEpicDescription()} />
              </CardDescription>
            )}
          </div>
          <div className="flex items-center gap-4 ml-4">
            <div className="text-right">
              <div className="text-sm font-medium">
                {completedTasks} / {totalTasks} tasks
              </div>
              <div className="text-xs text-muted-foreground">
                {Math.round(progress)}% complete
              </div>
            </div>
            <div className="w-24">
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="border-t border-muted pt-4">
            {filteredTasks.length > 0 ? (
              <div className="space-y-3">
                {filteredTasks.map(task => (
                  <SlidableTaskCard
                    key={task.id}
                    task={task}
                    onStageChange={onTaskUpdate || (() => {})}
                    onDoubleClick={() => onTaskDoubleClick?.(task)}
                    getStageColor={getStageColor}
                    stages={taskStages}
                    getPreviousStage={getPreviousTaskStage}
                    getNextStage={getNextTaskStage}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {tasks.length === 0 ? (
                  <div>
                    <p className="text-lg font-medium mb-2">No tasks in this epic</p>
                    <p className="text-sm">Create your first task to get started.</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-lg font-medium mb-2">No tasks match current filters</p>
                    <p className="text-sm">Adjust your filters to see tasks in this epic.</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
};