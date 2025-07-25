import { Toaster } from "./components/ui/toaster";
import { Toaster as Sonner } from "./components/ui/sonner";
import { TooltipProvider } from "./components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from 'next-themes';
import Dashboard from "./pages/Dashboard";
import Layout from "./pages/Layout";
import Template from "./pages/Template";
import Tools from "./pages/Tools";
import Settings from "./pages/Settings";
import Board from "./pages/Board";
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
                <Route path="/" element={<Dashboard />} />
                <Route path="/template" element={<Template />} />
                <Route path="/tools" element={<Tools />} />
                <Route path="/layout" element={<Layout />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/board" element={<Board />} />
              </Routes>
            </BrowserRouter>
          </MCPProvider>
        </SessionProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;