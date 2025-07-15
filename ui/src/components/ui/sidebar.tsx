import { ReactNode } from 'react';
import { Menu, Settings, Home } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface SidebarProps {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  onSettingsClick?: () => void;
  children?: ReactNode;
  className?: string;
}

export function Sidebar({ 
  isCollapsed, 
  setIsCollapsed, 
  onSettingsClick, 
  children,
  className = ''
}: SidebarProps) {
  const navigate = useNavigate();

  return (
    <div className={`${isCollapsed ? 'w-13' : 'w-64'} h-screen bg-surface border-r border-border flex-shrink-0 flex flex-col transition-all ${className}`}>
      {/* Header with Menu Toggle and Home Button */}
      <div className="p-3">
        <div className={`flex ${isCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
          <Button 
            variant="primary" 
            size="icon"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            <Menu className="h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>
          <Button
            variant="primary"
            size="icon"
            onClick={() => navigate('/dashboard')}
            className="flex-shrink-0"
          >
            <Home className="h-[1.2rem] w-[1.2rem]" />
          </Button>
        </div>
      </div>

      {/* Custom Content Area */}
      <div className="flex-1 overflow-y-auto">
        {children}
      </div>
      
      {/* Settings Button */}
      <div className="px-3 mb-3">
        <Button
          variant="primary"
          className={`relative ${isCollapsed ? 'h-9 w-9 p-0 rounded-full flex items-center justify-center' : 'h-9 pl-9 pr-3'} text-sm`}
          onClick={onSettingsClick}
        >
          <Settings 
            className={`h-[1.2rem] w-[1.2rem] ${isCollapsed ? '' : 'absolute left-2.5'}`}
          />
          {!isCollapsed && <span>Settings</span>}
        </Button>
      </div>
    </div>
  );
}