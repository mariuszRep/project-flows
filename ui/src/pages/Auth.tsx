import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "@/components/Auth/AuthForm";
import { ResetPasswordForm } from "@/components/Auth/ResetPasswordForm";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ThemeToggle } from "@/components/ui/theme-toggle";

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);

  useEffect(() => {
    // Check for success message from password reset
    if (location.state?.message) {
      setSuccess(location.state.message);
      setIsPasswordRecovery(false);
      window.history.replaceState({}, document.title);
    }

    // Check if user is already authenticated
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // Redirect to the attempted protected route or dashboard
        const from = location.state?.from?.pathname || '/dashboard';
        navigate(from);
      }
    };
    
    checkAuth();
  }, [location, navigate]);

  useEffect(() => {
    // Handle error messages from URL
    const errorCode = searchParams.get("error_code");
    const errorDescription = searchParams.get("error_description");
    if (errorCode === "otp_expired") {
      setError("The password reset link has expired. Please request a new one.");
      setIsPasswordRecovery(false);
    } else if (errorDescription) {
      setError(decodeURIComponent(errorDescription).replace(/\+/g, ' '));
    }
  }, [searchParams]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session);
      
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
        setError(null);
        setSuccess(null);
        return;
      }

      if (isPasswordRecovery) {
        return;
      }

      if (event === 'SIGNED_IN') {
        navigate('/dashboard');
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [navigate, isPasswordRecovery]);

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation Bar */}
      <nav className="fixed top-0 left-0 right-0 p-4 bg-background/80 backdrop-blur-sm border-b border-border z-50">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold gradient-text">
            Your App
          </h1>
          <ThemeToggle />
        </div>
      </nav>

      <div className="container mx-auto flex items-center justify-center min-h-screen p-4">
        <Card className="">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold">
              {isPasswordRecovery ? "Reset Password" : (localStorage.getItem("authMode") === "signin" ? "Sign In" : "Sign Up")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert className="mb-4 bg-green-500/10 text-green-500 dark:bg-green-500/20">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}
            {isPasswordRecovery ? (
              <ResetPasswordForm setError={setError} setSuccess={setSuccess} />
            ) : (
              <AuthForm setError={setError} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;