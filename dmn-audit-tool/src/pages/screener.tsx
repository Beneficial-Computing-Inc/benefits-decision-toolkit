/**
 * Caseworker/SME Screener Page.
 * Full form with all SSI eligibility fields and detailed results.
 */

import { Link } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';
import { SsiScreener } from '@/components/screener';
import { Button } from '@/components/ui/button';

export function ScreenerPage() {
  const apiUrl =
    import.meta.env.VITE_LIBRARY_API_URL ||
    '/api/v1/benefits/federal/ssi-eligibility';

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
          </h1>
          <p className="text-muted-foreground">
            Caseworker / Subject-Matter Expert Mode — Enter data to test SSI eligibility rules
          </p>
        </div>
      </header>

      {/* Screener Component */}
      <SsiScreener apiUrl={apiUrl} mode="sme" />

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t text-center text-sm text-muted-foreground">
        <p className="mb-2">
          <Link to="/screener/auto" className="text-blue-600 hover:underline">
            Switch to auto-generated screener (experimental)
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

export default ScreenerPage;
