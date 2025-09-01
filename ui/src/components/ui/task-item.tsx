import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TaskStage } from '@/types/task';
import { UnifiedEntity } from '@/types/unified-entity';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface TaskItemProps {
  task: UnifiedEntity;
  getStageColor?: (stage: TaskStage) => string;
  stages?: { key: TaskStage; title: string; color: string }[];
  onDoubleClick?: () => void;
}

const defaultStageColor = (stage: TaskStage) => {
  switch (stage) {
    case 'draft':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'backlog':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200';
    case 'doing':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200';
    case 'review':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200';
    case 'completed':
      return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200';
    default:
      return 'bg-gray-100 text-gray-800';
  }
};

const defaultStages = [
  { key: 'draft' as TaskStage, title: 'Draft', color: defaultStageColor('draft') },
  { key: 'backlog' as TaskStage, title: 'Backlog', color: defaultStageColor('backlog') },
  { key: 'doing' as TaskStage, title: 'Doing', color: defaultStageColor('doing') },
  { key: 'review' as TaskStage, title: 'Review', color: defaultStageColor('review') },
  { key: 'completed' as TaskStage, title: 'Completed', color: defaultStageColor('completed') }
];

// Get type pill color - same as UnifiedEntityCard
const getTypePillColor = () => {
  return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'; // Task color
};

export const TaskItem: React.FC<TaskItemProps> = ({ 
  task, 
  getStageColor = defaultStageColor,
  stages = defaultStages,
  onDoubleClick
}) => {
  return (
    <Card 
      className="card-hover w-full cursor-pointer select-none"
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick && onDoubleClick();
      }}
    >
      <CardContent className="p-3 w-full">
        <div className="flex items-center justify-between w-full">
          <div className="flex-1 min-w-0 pr-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-xs">#{task.id}</span>
                <Badge variant="outline" className={`text-xs ${getTypePillColor()}`}>
                  Task
                </Badge>
              </div>
              {/* Stage badge only shown if task has a stage */}
              {task.stage && (
                <Badge variant="secondary" className={`flex-shrink-0 text-xs ${getStageColor(task.stage)}`}>
                  {stages.find(s => s.key === task.stage)?.title || task.stage}
                </Badge>
              )}
            </div>
            <h4 className="text-sm font-semibold truncate mb-1">
              {task.title}
            </h4>
            {task.summary && (
              <div className="line-clamp-2 text-xs text-muted-foreground prose dark:prose-invert max-w-none prose-p:mb-0 prose-headings:mb-0 prose-headings:mt-0 prose-lists:mb-0">
                <MarkdownRenderer content={task.summary} />
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
