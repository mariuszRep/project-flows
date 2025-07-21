import { createContext, useContext, useState, ReactNode } from 'react';

interface Session {
  id: string;
  title: string;
  created_at: string;
  user_id: string;
}

interface SessionContextType {
  selectedSession: Session | null;
  setSelectedSession: (session: Session | null) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  return (
    <SessionContext.Provider value={{ selectedSession, setSelectedSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
