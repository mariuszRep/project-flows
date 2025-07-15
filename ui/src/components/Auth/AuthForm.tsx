import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { GoogleLoginButton } from "./GoogleLoginButton";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const authSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: passwordSchema,
});

const resetSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
});

type AuthFormData = z.infer<typeof authSchema>;
type ResetFormData = z.infer<typeof resetSchema>;

const calculatePasswordStrength = (password: string): number => {
  let strength = 0;
  if (password.length >= 8) strength += 20;
  if (/[A-Z]/.test(password)) strength += 20;
  if (/[a-z]/.test(password)) strength += 20;
  if (/[0-9]/.test(password)) strength += 20;
  if (/[^A-Za-z0-9]/.test(password)) strength += 20;
  return strength;
};

const getStrengthColor = (strength: number): string => {
  if (strength < 40) return "bg-red-500";
  if (strength < 80) return "bg-yellow-500";
  return "bg-green-500";
};

export const AuthForm = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isReset, setIsReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const authMode = localStorage.getItem("authMode");
    if (authMode === "signup") {
      setIsLogin(false);
    } else if (authMode === "signin") {
      setIsLogin(true);
    }
    localStorage.removeItem("authMode");
  }, []);

  const {
    register: registerAuth,
    handleSubmit: handleAuthSubmit,
    watch,
    formState: { errors: authErrors },
  } = useForm<AuthFormData>({
    resolver: zodResolver(authSchema),
    mode: "onChange",
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetSchema),
    mode: "onChange",
  });

  const password = watch("password", "");
  const passwordStrength = calculatePasswordStrength(password);

  const onSubmit = async (data: AuthFormData) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
        });
        if (error) throw error;
        setSuccess("Please check your email for the confirmation link.");
      }
    } catch (error: any) {
      setError(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const onReset = async (data: ResetFormData) => {
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(data.email, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });
      if (error) throw error;
      setSuccess("Please check your email for the password reset link.");
    } catch (error: any) {
      setError(error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (isReset) {
    return (
      <form onSubmit={handleResetSubmit(onReset)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="input-special"
            placeholder="Enter your email"
            {...registerReset("email")}
          />
          {resetErrors.email && (
            <p className="text-sm text-destructive">{resetErrors.email.message}</p>
          )}
        </div>

        <Button 
          type="submit"
          variant="primary"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Processing..." : "Reset Password"}
        </Button>

        <Button
          type="button"
          variant="primary"
          className="w-full"
          onClick={() => setIsReset(false)}
        >
          Back to {isLogin ? "Sign In" : "Sign Up"}
        </Button>
      </form>
    );
  }

  return (
    <div className="space-y-6">
      <GoogleLoginButton />

      <div className="relative flex items-center justify-center text-xs uppercase">
        <span className="text-foreground px-2">
          Or continue with
        </span>
      </div>

      <form onSubmit={handleAuthSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            className="input-special"
            placeholder="Enter your email"
            {...registerAuth("email")}
          />
          {authErrors.email && (
            <p className="text-sm text-destructive">{authErrors.email.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              className="input-special"
              placeholder="Enter your password"
              {...registerAuth("password")}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="button-secondary absolute right-2 top-1/2 -translate-y-1/2 p-2"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {authErrors.password && (
            <p className="text-sm text-destructive">
              {authErrors.password.message}
            </p>
          )}
          {!isLogin && password && (
            <div className="space-y-2">
              <Progress
                value={passwordStrength}
                className={`h-1 ${getStrengthColor(passwordStrength)}`}
              />
              <p className="text-xs text-muted-foreground">
                Password strength: {passwordStrength}%
              </p>
            </div>
          )}
        </div>

        <Button
          type="submit"
          variant="secondary"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Processing..." : (isLogin ? "Sign In" : "Sign Up")}
        </Button>

        <div className="flex justify-between">
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              setIsLogin(!isLogin);
              localStorage.setItem("authMode", isLogin ? "signup" : "signin");
            }}
          >
            {isLogin ? "Create account" : "Already have an account?"}
          </Button>

          {isLogin && (
            <Button
              type="button"
              variant="primary"
              onClick={() => setIsReset(true)}
            >
              Forgot password?
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};
