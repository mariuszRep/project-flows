import { ReactNode } from 'react';
import { Header } from '@/components/layout/Header';

interface HeaderLayoutProps {
  children: ReactNode;
  handleSignOut: () => void;
}

export function HeaderLayout({
  children,
  handleSignOut,
}: HeaderLayoutProps) {
  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Header */}
      <Header handleSignOut={handleSignOut} />

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto">
        <div className="container mx-auto p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
