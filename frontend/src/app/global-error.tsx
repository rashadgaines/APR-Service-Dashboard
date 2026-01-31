'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-semibold text-slate-900">
              Application Error
            </h1>
            <p className="text-slate-600 text-sm">
              A critical error occurred. Please refresh the page.
            </p>
          </div>

          {error.message && (
            <div className="bg-slate-100 rounded-lg p-3 text-left">
              <p className="text-xs text-slate-600 font-mono break-all">
                {error.message}
              </p>
            </div>
          )}

          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh Page
          </button>
        </div>
      </body>
    </html>
  );
}
