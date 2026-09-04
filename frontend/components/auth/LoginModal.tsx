'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StateBlock } from '@/components/ui/state-block';
import { Eye, EyeOff } from 'lucide-react';

export function LoginModal() {
  const router = useRouter();
  const { showLoginModal, setShowLoginModal, setShowRegisterModal, login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isEmailNotVerified, setIsEmailNotVerified] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsEmailNotVerified(false);
    setIsLoading(true);

    try {
      await login(email, password);
      setEmail('');
      setPassword('');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(errorMessage);
      // Check if error is about email verification
      if (errorMessage.toLowerCase().includes('verify your email')) {
        setIsEmailNotVerified(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchToRegister = () => {
    setShowLoginModal(false);
    setShowRegisterModal(true);
  };

  const handleForgotPassword = () => {
    setShowLoginModal(false);
    router.push('/reset-password');
  };

  const handleResendVerification = () => {
    setShowLoginModal(false);
    router.push('/verify-email');
  };

  return (
    <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Sign In</DialogTitle>
          <DialogDescription>
            Enter your email and password to sign in to your account.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-4">
          {error && (
            <StateBlock variant="error">
              {error}
              {isEmailNotVerified && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  className="mt-2 flex min-h-11 items-center font-medium underline underline-offset-2 md:min-h-0"
                >
                  Resend verification email
                </button>
              )}
            </StateBlock>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="pr-12 md:pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center text-foreground/60 hover:text-foreground"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="text-right">
              <button
                type="button"
                onClick={handleForgotPassword}
                className="inline-flex min-h-11 items-center text-sm text-primary hover:underline md:min-h-0"
              >
                Forgot password?
              </button>
            </div>
          </div>
          <Button
            type="submit"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
            disabled={isLoading}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
          <div className="text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <button
              type="button"
              onClick={switchToRegister}
              className="inline-flex min-h-11 items-center text-primary hover:underline font-medium md:min-h-0"
            >
              Create one
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
