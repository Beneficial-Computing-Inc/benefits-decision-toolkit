/**
 * Auto SSI Screener component.
 *
 * Similar to SsiScreener but accepts the form schema as a prop,
 * allowing for auto-generated schemas.
 */

import { useState, useCallback, useRef } from 'react';
import { XCircle, HelpCircle } from 'lucide-react';
import { FormRenderer } from './FormRenderer';
import { EnrichedResultsDisplay } from './EnrichedResultsDisplay';
import {
  transformToSsiRequest,
  parseEligibilityResponse,
  enrichEligibilityResult,
  type FormSchema,
  type FormValues,
  type EnrichedEligibilityResult,
} from '../../lib/screener';
import { useDmnChecks } from '../../hooks/use-dmn-checks';

interface AutoSsiScreenerProps {
  /** The form schema to render */
  schema: FormSchema;
  /** Library API endpoint URL */
  apiUrl?: string;
  /** Mode: 'sme' for full form, 'claimant' for simplified */
  mode?: 'sme' | 'claimant';
}

export function AutoSsiScreener({
  schema,
  apiUrl = '/api/v1/benefits/federal/ssi-eligibility',
  mode = 'sme',
}: AutoSsiScreenerProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<EnrichedEligibilityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  // Load parsed DMN checks for enrichment
  const { data: dmnData } = useDmnChecks();

  const handleSubmit = useCallback(
    async (values: FormValues) => {
      setIsLoading(true);
      setError(null);
      setResult(null);

      try {
        // Transform form values to API request
        const request = transformToSsiRequest(values);

        // Call the library API
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(request),
        });

        const data = await response.json();

        // Parse the response
        const rawResult = parseEligibilityResponse(data);

        // Enrich with DMN data if available, passing form values for missing field analysis
        const enrichedResult = enrichEligibilityResult(
          rawResult,
          dmnData?.checks || [],
          values
        );

        setResult(enrichedResult);

        // Scroll to results after a brief delay to ensure render
        setTimeout(() => {
          resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
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
    <div className="max-w-6xl mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form Panel */}
        <div className="bg-white rounded-lg shadow p-6">
          <FormRenderer
            schema={schema}
            onSubmit={handleSubmit}
            isLoading={isLoading}
          />
        </div>

        {/* Results Panel */}
        <div ref={resultsRef} className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">
            Eligibility Results
          </h2>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="flex items-start gap-2">
                <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                <div>
                  <p className="font-medium text-red-800">Error</p>
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              </div>
            </div>
          )}

          {!result && !error && (
            <div className="text-center py-12 text-gray-500">
              <HelpCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Enter information and click "Check Eligibility"</p>
              <p className="text-sm">to see results here</p>
            </div>
          )}

          {result && (
            <EnrichedResultsDisplay
              result={result}
              mode={mode}
              onStartOver={handleStartOver}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export default AutoSsiScreener;
