import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LogIn, UserPlus } from "lucide-react";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Index = () => {
  const navigate = useNavigate();
  
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold gradient-text">
            Your App
          </h1>
          <div className="flex gap-2 items-center">
            <ThemeToggle />
            <Button 
              variant="primary"
              onClick={() => {
                localStorage.setItem("authMode", "signin");
                navigate("/auth");
              }}
              className="flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
            <Button 
              variant="primary"
              onClick={() => {
                localStorage.setItem("authMode", "signup");
                navigate("/auth");
              }}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="pt-24 min-h-screen flex items-center justify-center p-4">
        <div className="text-center animate-fade-up">
          <h1 className="text-6xl md:text-8xl font-bold gradient-text mb-4">
            Hello World
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Welcome to your beautiful React application. Get started by signing up or logging in to access all features.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              variant="primary"
              onClick={() => {
                localStorage.setItem("authMode", "signin");
                navigate("/auth");
              }}
              className="flex items-center gap-2"
            >
              <LogIn className="w-4 h-4" />
              Sign In
            </Button>
            <Button 
              variant="primary"
              onClick={() => {
                localStorage.setItem("authMode", "signup");
                navigate("/auth");
              }}
              className="flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Sign Up
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;