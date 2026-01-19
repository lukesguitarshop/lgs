'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, Play, CheckCircle, XCircle, Lock } from 'lucide-react';

interface ScraperResponse {
  success: boolean;
  message: string;
  output?: string[];
  errors?: string[];
  error?: string;
}

const ADMIN_USERNAME = 'lukeydude17';
const ADMIN_PASSWORD = 'DallasCowboys88!';

export default function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScraperResponse | null>(null);

  useEffect(() => {
    const auth = sessionStorage.getItem('adminAuth');
    if (auth === 'true') {
      setIsAuthenticated(true);
    }
    setCheckingAuth(false);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
      sessionStorage.setItem('adminAuth', 'true');
      setIsAuthenticated(true);
    } else {
      setLoginError('Invalid username or password');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('adminAuth');
    setIsAuthenticated(false);
    setUsername('');
    setPassword('');
  };

  const runScraper = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await api.post<ScraperResponse>('/admin/run-scraper');
      setResult(response);
    } catch (err) {
      setResult({
        success: false,
        message: 'Failed to run scraper',
        error: err instanceof Error ? err.message : 'Unknown error',
      });
    } finally {
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gray-100 p-3 rounded-full">
              <Lock className="h-8 w-8 text-gray-600" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 text-center mb-2">Admin Login</h1>
          <p className="text-gray-600 text-center mb-6">Enter your credentials to access the admin portal</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
                Username
              </label>
              <input
                type="text"
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none transition-all"
                placeholder="Enter username"
                required
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#df5e15] focus:border-transparent outline-none transition-all"
                placeholder="Enter password"
                required
              />
            </div>

            {loginError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {loginError}
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-[#df5e15] hover:bg-[#c54d0a] text-white font-semibold py-3"
            >
              Sign In
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Home
        </Link>
        <button
          onClick={handleLogout}
          className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
        >
          Logout
        </button>
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Portal</h1>
      <p className="text-gray-600 mb-8">Manage your guitar listings database</p>

      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Reverb Scraper</h2>
        <p className="text-gray-600 mb-6">
          Manually trigger the scraper to refresh your listings from Reverb. This will fetch all
          current listings and update the database.
        </p>

        <Button
          onClick={runScraper}
          disabled={loading}
          className="bg-[#df5e15] hover:bg-[#c54d0a] text-white font-semibold px-6 py-3"
        >
          {loading ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Running Scraper...
            </>
          ) : (
            <>
              <Play className="h-5 w-5 mr-2" />
              Run Scraper
            </>
          )}
        </Button>

        {result && (
          <div className="mt-6">
            <div
              className={`flex items-center gap-2 p-4 rounded-lg ${
                result.success
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {result.success ? (
                <CheckCircle className="h-5 w-5 flex-shrink-0" />
              ) : (
                <XCircle className="h-5 w-5 flex-shrink-0" />
              )}
              <span className="font-medium">{result.message}</span>
            </div>

            {result.output && result.output.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">Output:</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto max-h-96 overflow-y-auto">
                  {result.output.join('\n')}
                </pre>
              </div>
            )}

            {result.errors && result.errors.length > 0 && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-red-700 mb-2">Errors:</h3>
                <pre className="bg-red-900 text-red-100 p-4 rounded-lg text-sm overflow-x-auto max-h-48 overflow-y-auto">
                  {result.errors.join('\n')}
                </pre>
              </div>
            )}

            {result.error && (
              <div className="mt-4">
                <h3 className="text-sm font-semibold text-red-700 mb-2">Error Details:</h3>
                <pre className="bg-red-50 text-red-800 p-4 rounded-lg text-sm">{result.error}</pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
