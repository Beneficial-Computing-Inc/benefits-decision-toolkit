/**
 * Accessible Screener Page.
 * Claimant-facing simplified interface with progressive disclosure.
 */

import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, XCircle, Heart } from 'lucide-react';
import { FormRenderer } from '@/components/screener';
import { Button } from '@/components/ui/button';
import {
  accessibleFormSchema,
  transformAccessibleToStandard,
  transformToSsiRequest,
  parseEligibilityResponse,
  enrichEligibilityResult,
  type FormValues,
  type EnrichedEligibilityResult,
} from '@/lib/screener';
import { useDmnChecks } from '@/hooks/use-dmn-checks';
import { ClaimantResultsDisplay } from '@/components/screener/ClaimantResultsDisplay';

export function AccessibleScreenerPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EnrichedEligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load parsed DMN checks for enrichment
  const { data: dmnData } = useDmnChecks();

  const apiUrl =
    import.meta.env.VITE_LIBRARY_API_URL ||
    '/api/v1/benefits/federal/ssi-eligibility';

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        // Transform accessible form values to standard format
        const standardValues = transformAccessibleToStandard(values);

        // Transform to API request
        const request = transformToSsiRequest(standardValues);

        // Call the library API
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        const data = await response.json();

        // Parse and enrich the response, passing form values for missing field analysis
        const rawResult = parseEligibilityResponse(data);
        const enrichedResult = enrichEligibilityResult(
          rawResult,
          dmnData?.checks || [],
          standardValues
        );

        setResult(enrichedResult);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    },
    [apiUrl, dmnData]
  );

  const handleStartOver = useCallback(() => {
    setResult(null);
    setError(null);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="container mx-auto py-8 px-4 max-w-2xl">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-6">
            <Link to="/">
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Back
              </Button>
            </Link>
          </div>

          {!result && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full mb-4">
                <Heart className="w-8 h-8 text-blue-600" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                SSI Eligibility Check
              </h1>
              <p className="text-gray-600">
                Answer a few questions to see if you might qualify
              </p>
            </div>
          )}
        </header>

        {/* Main Content */}
        <main>
          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-start gap-3">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-red-800">
                    Something went wrong
                  </p>
                  <p className="text-sm text-red-600 mt-1">{error}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleStartOver}
                    className="mt-3"
                  >
                    Try Again
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          {!result && !error && (
            <div className="bg-white rounded-xl shadow-sm border p-6 md:p-8">
              <FormRenderer
                schema={accessibleFormSchema}
                onSubmit={handleSubmit}
                isLoading={isLoading}
              />
            </div>
          )}

          {/* Results */}
          {result && (
            <ClaimantResultsDisplay
              result={result}
              onStartOver={handleStartOver}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="mt-12 text-center text-sm text-gray-500">
          <p>
            This tool is for informational purposes only and is not affiliated
            with the Social Security Administration.
          </p>
          <p className="mt-2">
            <Link to="/screener" className="text-blue-600 hover:underline">
              Switch to full caseworker mode
            </Link>
          </p>
        </footer>
      </div>
    </div>
  );
}

export default AccessibleScreenerPage;
