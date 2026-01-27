/**
 * Auto-Generated Screener Page.
 *
 * Uses form schema auto-generated from OpenAPI spec instead of
 * the hardcoded ssi-form-schema.ts.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAutoFormSchema } from '@/hooks/use-auto-form-schema';
import { AutoSsiScreener } from '@/components/screener/AutoSsiScreener';

export function AutoScreenerPage() {
  const openApiUrl = import.meta.env.VITE_OPENAPI_URL || '/q/openapi';
  const apiUrl =
    import.meta.env.VITE_LIBRARY_API_URL ||
    '/api/v1/benefits/federal/ssi-eligibility';

  const { schema, isLoading, error } = useAutoFormSchema(openApiUrl);

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link to="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Catalog
            </Button>
          </Link>
        </div>

        <div>
          <h1 className="text-3xl font-bold mb-1 flex items-center gap-3">
            <FileText className="w-8 h-8" />
            SSI Eligibility Screener
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              <Sparkles className="w-3 h-3" />
              Auto-Generated
            </span>
          </h1>
          <p className="text-muted-foreground">
            Form schema auto-generated from OpenAPI spec — fields update automatically when DMN changes
          </p>
        </div>
      </header>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <Loader2 className="w-12 h-12 mx-auto mb-4 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">Loading form schema from OpenAPI...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-8">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 mt-0.5" />
            <div>
              <h2 className="font-semibold text-red-800 mb-1">
                Failed to Load Form Schema
              </h2>
              <p className="text-red-600 mb-4">{error}</p>
              <p className="text-sm text-red-600">
                Make sure library-api is running at the expected URL.
                <br />
                OpenAPI URL: <code className="bg-red-100 px-1 rounded">{openApiUrl}</code>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Screener Component */}
      {schema && <AutoSsiScreener schema={schema} apiUrl={apiUrl} mode="sme" />}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
        <p className="mb-2">
          <Link to="/screener" className="text-blue-600 hover:underline">
            Switch to manual screener (original)
          </Link>
          {' | '}
          <Link to="/screener/accessible" className="text-blue-600 hover:underline">
            Quick screener (simplified)
          </Link>
        </p>
        <p>
          This tool uses{' '}
          <a
            href="https://github.com/usds/benefits-decision-toolkit"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Benefits Decision Toolkit
          </a>
        </p>
      </footer>
    </div>
  );
}

export default AutoScreenerPage;
