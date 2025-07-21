import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
  .regex(/[a-z]/, "Password must contain at least one lowercase letter")
  .regex(/[0-9]/, "Password must contain at least one number")
  .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character");

const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

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

export const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
  });

  const password = watch("password", "");
  const passwordStrength = calculatePasswordStrength(password);

  const onSubmit = async (data: ResetPasswordFormData) => {
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: data.password
      });

      if (error) throw error;

      // Sign out the user after password reset to ensure a clean state
      await supabase.auth.signOut();

      // Remove the reset=true parameter and redirect to login
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('reset');
      window.history.replaceState({}, '', newUrl.toString());

      // Navigate to login with success message
      navigate("/auth", { 
        replace: true,
        state: { message: "Password has been reset successfully. Please log in with your new password." }
      });
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError(err.message || "An error occurred while resetting your password");
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = () => {
    // Remove the reset=true parameter
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('reset');
    window.history.replaceState({}, '', newUrl.toString());
    
    // Navigate to login
    navigate("/auth", { replace: true });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="password">New Password</Label>
        <div className="relative">
          <Input
            id="password"
            type={showPassword ? "text" : "password"}
            {...register("password")}
            placeholder="Enter your new password"
            className={errors.password ? "border-red-500 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {showPassword ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
        <div className="space-y-2">
          <Progress
            value={passwordStrength}
            className={`h-2 ${getStrengthColor(passwordStrength)}`}
          />
          <p className="text-sm text-gray-500">
            Password strength: {passwordStrength}%
          </p>
        </div>
        {errors.password && (
          <p className="text-sm text-red-500">{errors.password.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password</Label>
        <div className="relative">
          <Input
            id="confirmPassword"
            type={showConfirmPassword ? "text" : "password"}
            {...register("confirmPassword")}
            placeholder="Confirm your new password"
            className={errors.confirmPassword ? "border-red-500 pr-10" : "pr-10"}
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2"
          >
            {showConfirmPassword ? (
              <EyeOff className="h-4 w-4 text-gray-500" />
            ) : (
              <Eye className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
        {errors.confirmPassword && (
          <p className="text-sm text-red-500">{errors.confirmPassword.message}</p>
        )}
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Button type="submit" variant="primary" className="w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>

      <p className="text-center text-sm">
        <Button
          type="button"
          variant="primary"
          onClick={handleBackToLogin}
          className="text-blue-500 hover:underline"
        >
          Back to login
        </Button>
      </p>
    </form>
  );
};