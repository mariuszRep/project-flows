import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Layout from "./pages/Layout";
import Template from "./pages/Template";
import Tools from "./pages/Tools";
import Settings from "./pages/Settings";
import Board from "./pages/Board";
import { AuthCallback } from "./components/Auth/AuthCallback";
import { ProtectedRoute } from "./components/Auth/ProtectedRoute";
import { SessionProvider } from "./contexts/SessionContext";
import { MCPProvider } from "./contexts/MCPContext";


const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SessionProvider>
          <MCPProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/auth/callback" element={<AuthCallback />} />
                <Route path="/dashboard" element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                } />
                <Route path="/template" element={
                  <ProtectedRoute>
                    <Template />
                  </ProtectedRoute>
                } />
                <Route path="/tools" element={
                  <ProtectedRoute>
                    <Tools />
                  </ProtectedRoute>
                } />
                <Route path="/layout" element={<Layout />} />
                <Route path="/settings" element={
                  <ProtectedRoute>
                    <Settings />
                  </ProtectedRoute>
                } />
                <Route path="/board" element={
                  <ProtectedRoute>
                    <Board />
                  </ProtectedRoute>
                } />
              </Routes>
            </BrowserRouter>
          </MCPProvider>
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;