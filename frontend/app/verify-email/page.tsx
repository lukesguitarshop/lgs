'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Loader2, CheckCircle, XCircle, Mail } from 'lucide-react';
import { verifyEmail, resendVerification } from '@/lib/auth';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  // Verification state
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationSuccess, setVerificationSuccess] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Resend state
  const [email, setEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendError, setResendError] = useState<string | null>(null);

  // Auto-verify if token is present
  useEffect(() => {
    if (token && !isVerifying && !verificationSuccess && !verificationError) {
      handleVerify();
    }
  }, [token]);

  const handleVerify = async () => {
    if (!token) return;

    setIsVerifying(true);
    setVerificationError(null);

    try {
      await verifyEmail(token);
      setVerificationSuccess(true);
    } catch (err) {
      setVerificationError(err instanceof Error ? err.message : 'Failed to verify email. The link may have expired.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setIsResending(true);

    try {
      await resendVerification(email);
      setResendSent(true);
    } catch (err) {
      setResendError(err instanceof Error ? err.message : 'Failed to send verification email. Please try again.');
    } finally {
      setIsResending(false);
    }
  };

  // Show verification in progress
  if (token && isVerifying) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Loader2 className="h-16 w-16 text-[#df5e15] mx-auto animate-spin" />
                <h2 className="text-xl font-semibold">Verifying your email...</h2>
                <p className="text-muted-foreground">
                  Please wait while we verify your email address.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show verification success
  if (token && verificationSuccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
                <h2 className="text-xl font-semibold">Email Verified!</h2>
                <p className="text-muted-foreground">
                  Your email has been verified successfully. You can now sign in to your account.
                </p>
                <Button
                  onClick={() => router.push('/')}
                  className="w-full bg-[#df5e15] hover:bg-[#c74d12]"
                >
                  Go to Home and Sign In
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show verification error
  if (token && verificationError) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <XCircle className="h-16 w-16 text-red-500 mx-auto" />
                <h2 className="text-xl font-semibold">Verification Failed</h2>
                <p className="text-muted-foreground">
                  {verificationError}
                </p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setVerificationError(null);
                      router.push('/verify-email');
                    }}
                    className="w-full"
                  >
                    Request New Verification Link
                  </Button>
                  <Link href="/">
                    <Button variant="ghost" className="w-full">
                      Back to Home
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show resend success
  if (resendSent) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Mail className="h-16 w-16 text-[#df5e15] mx-auto" />
                <h2 className="text-xl font-semibold">Check Your Email</h2>
                <p className="text-muted-foreground">
                  If an account exists with <strong>{email}</strong>, we&apos;ve sent a verification link. Please check your inbox and spam folder.
                </p>
                <p className="text-sm text-muted-foreground">
                  The link will expire in 24 hours.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setResendSent(false);
                    setEmail('');
                  }}
                  className="w-full"
                >
                  Send Another Link
                </Button>
                <Link href="/">
                  <Button variant="ghost" className="w-full">
                    Back to Home
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show resend form (no token)
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-md mx-auto">
        <Link
          href="/"
          className="inline-flex items-center text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>

        <Card>
          <CardHeader>
            <CardTitle>Resend Verification Email</CardTitle>
            <CardDescription>
              Enter your email address and we&apos;ll send you a new verification link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleResend} className="space-y-4">
              {resendError && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                  {resendError}
                </div>
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
                  disabled={isResending}
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#df5e15] hover:bg-[#c74d12]"
                disabled={isResending}
              >
                {isResending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sending...
                  </>
                ) : (
                  'Send Verification Link'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    }>
      <VerifyEmailContent />
    </Suspense>
  );
}
