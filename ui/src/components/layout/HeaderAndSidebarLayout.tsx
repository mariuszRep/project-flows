import { ReactNode, useState, cloneElement, isValidElement } from 'react';
import { Sidebar } from '@/components/ui/sidebar';
import { Header } from '@/components/layout/Header';

interface HeaderAndSidebarLayoutProps {
  children: ReactNode;
  selectedSession?: any;
  titleInput?: string;
  editingTitle?: boolean;
  setTitleInput?: (title: string) => void;
  setEditingTitle?: (editing: boolean) => void;
  handleUpdateTitle?: () => void;
  handleSignOut: () => void;
  refreshSessions?: () => void;
  onSettingsClick?: () => void;
  sidebarContent?: ReactNode;
}

export function HeaderAndSidebarLayout({
  children,
  handleSignOut,
  onSettingsClick,
  sidebarContent
}: HeaderAndSidebarLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Clone the sidebar content and inject the isCollapsed prop if it's a valid React element
  const sidebarContentWithProps = isValidElement(sidebarContent) 
    ? cloneElement(sidebarContent, { isCollapsed } as any)
    : sidebarContent;

  return (
    <div className="h-screen bg-background flex overflow-hidden">
      {/* Sidebar */}
      <Sidebar 
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        onSettingsClick={onSettingsClick}
      >
        {sidebarContentWithProps}
      </Sidebar>

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header
          handleSignOut={handleSignOut}
        />

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto">
          <div className="container mx-auto p-6">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
