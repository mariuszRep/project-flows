import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import Dashboard from "./pages/Dashboard";
import Layout from "./pages/Layout";
import Template from "./pages/Template";
import Tools from "./pages/Tools";
import Settings from "./pages/Settings";
import TaskBoard from "./pages/TaskBoard";
import TaskList from "./pages/TaskList";
import Workflows from "./pages/Workflows";
import { SessionProvider } from "./contexts/SessionContext";
import { MCPProvider } from "./contexts/MCPContext";
import { ProjectProvider } from "./contexts/ProjectContext";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionProvider>
          <MCPProvider>
            <ProjectProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/template" element={<Template />} />
                  <Route path="/tools" element={<Tools />} />
                  <Route path="/workflows" element={<Workflows />} />
                  <Route path="/layout" element={<Layout />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/task-board" element={<TaskBoard />} />
                  <Route path="/task-list" element={<TaskList />} />
                </Routes>
              </BrowserRouter>
            </ProjectProvider>
          </MCPProvider>
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;