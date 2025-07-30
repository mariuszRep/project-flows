import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/card';
import { X, Save, Palette } from 'lucide-react';
import { useMCP } from '@/contexts/MCPContext';
import { Project } from '@/types/project';

interface ProjectFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: Project) => void;
  project?: Project; // For editing existing project
  mode?: 'create' | 'edit';
}

const COLOR_OPTIONS = [
  '#3b82f6', // Blue
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#8b5cf6', // Purple
  '#06b6d4', // Cyan
  '#84cc16', // Lime
  '#f97316', // Orange
  '#ec4899', // Pink
  '#6366f1', // Indigo
];

export default function ProjectForm({ 
  isOpen, 
  onClose, 
  onSuccess, 
  project, 
  mode = 'create' 
}: ProjectFormProps) {
  const { callTool, isConnected } = useMCP();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || '#3b82f6'
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleColorSelect = (color: string) => {
    setFormData(prev => ({
      ...prev,
      color
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected || !callTool) {
      setError('MCP not connected');
      return;
    }

    if (!formData.name.trim()) {
      setError('Project name is required');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (mode === 'create') {
        const result = await callTool('create_project', {
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color
        });

        if (result && result.content && result.content[0]) {
          console.log('Project created:', result.content[0].text);
          
          // Create a mock project object for the callback
          const newProject: Project = {
            id: Date.now(), // Temporary ID
            name: formData.name.trim(),
            description: formData.description.trim(),
            color: formData.color,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_by: 'user@example.com',
            updated_by: 'user@example.com'
          };
          
          onSuccess(newProject);
          
          // Reset form
          setFormData({
            name: '',
            description: '',
            color: '#3b82f6'
          });
        }
      } else if (mode === 'edit' && project) {
        const result = await callTool('update_project', {
          project_id: project.id,
          name: formData.name.trim(),
          description: formData.description.trim() || undefined,
          color: formData.color
        });

        if (result && result.content && result.content[0]) {
          console.log('Project updated:', result.content[0].text);
          
          const updatedProject: Project = {
            ...project,
            name: formData.name.trim(),
            description: formData.description.trim(),
            color: formData.color,
            updated_at: new Date().toISOString()
          };
          
          onSuccess(updatedProject);
        }
      }
    } catch (err) {
      console.error('Error with project:', err);
      setError(err instanceof Error ? err.message : `Failed to ${mode} project`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    setError(null);
    if (mode === 'create') {
      setFormData({
        name: '',
        description: '',
        color: '#3b82f6'
      });
    } else {
      setFormData({
        name: project?.name || '',
        description: project?.description || '',
        color: project?.color || '#3b82f6'
      });
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg font-semibold">
            {mode === 'create' ? 'Create Project' : 'Edit Project'}
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCancel}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3">
                <p className="text-red-800 text-sm">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name *</Label>
              <Input
                id="project-name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Enter project name"
                disabled={isSubmitting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="project-description">Description</Label>
              <Textarea
                id="project-description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Enter project description"
                disabled={isSubmitting}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Project Color</Label>
              <div className="flex items-center gap-2 mb-2">
                <Palette className="h-4 w-4 text-muted-foreground" />
                <div 
                  className="w-6 h-6 rounded-full border-2 border-white shadow-sm"
                  style={{ backgroundColor: formData.color }}
                />
                <span className="text-sm text-muted-foreground">{formData.color}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {COLOR_OPTIONS.map(color => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => handleColorSelect(color)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      formData.color === color 
                        ? 'border-gray-400 scale-110 shadow-md' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    style={{ backgroundColor: color }}
                    disabled={isSubmitting}
                  />
                ))}
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !isConnected || !formData.name.trim()}
              className="flex-1"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {mode === 'create' ? 'Creating...' : 'Updating...'}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  {mode === 'create' ? 'Create Project' : 'Update Project'}
                </div>
              )}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}