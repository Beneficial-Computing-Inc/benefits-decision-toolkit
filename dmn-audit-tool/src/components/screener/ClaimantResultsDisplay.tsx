/**
 * Claimant-friendly Results Display component.
 * Plain language results with actionable next steps and no technical jargon.
 */

import {
  CheckCircle,
  XCircle,
  AlertCircle,
  ArrowRight,
  Phone,
  MapPin,
  FileText,
  ExternalLink,
  Heart,
  Lightbulb,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EnrichedEligibilityResult } from '@/lib/screener/result-enricher';
import { getNextSteps } from '@/lib/screener/result-enricher';

interface ClaimantResultsDisplayProps {
  result: EnrichedEligibilityResult;
  onStartOver?: () => void;
}

export function ClaimantResultsDisplay({
  result,
  onStartOver,
}: ClaimantResultsDisplayProps) {
  // Determine overall status
  const status =
    result.isEligible === true
      ? 'eligible'
      : result.isEligible === false
      ? 'ineligible'
      : 'undetermined';

  const nextSteps = getNextSteps(result);

  return (
    <div className="space-y-6">
      {/* Main Result Card */}
      <div
        className={`rounded-xl p-6 md:p-8 text-center ${
          status === 'eligible'
            ? 'bg-green-50 border-2 border-green-200'
            : status === 'ineligible'
            ? 'bg-amber-50 border-2 border-amber-200'
            : 'bg-blue-50 border-2 border-blue-200'
        }`}
      >
        <div className="mb-4">
          {status === 'eligible' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full">
              <CheckCircle className="w-10 h-10 text-green-600" />
            </div>
          )}
          {status === 'ineligible' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-100 rounded-full">
              <Lightbulb className="w-10 h-10 text-amber-600" />
            </div>
          )}
          {status === 'undetermined' && (
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-full">
              <AlertCircle className="w-10 h-10 text-blue-600" />
            </div>
          )}
        </div>

        <h2
          className={`text-2xl font-bold mb-3 ${
            status === 'eligible'
              ? 'text-green-800'
              : status === 'ineligible'
              ? 'text-amber-800'
              : 'text-blue-800'
          }`}
        >
          {status === 'eligible' && 'Good News!'}
          {status === 'ineligible' && 'You May Have Options'}
          {status === 'undetermined' && 'We Need More Information'}
        </h2>

        <p
          className={`text-lg mb-4 ${
            status === 'eligible'
              ? 'text-green-700'
              : status === 'ineligible'
              ? 'text-amber-700'
              : 'text-blue-700'
          }`}
        >
          {status === 'eligible' &&
            'Based on your answers, you may be eligible for SSI benefits.'}
          {status === 'ineligible' &&
            'Based on your answers, you may not currently meet all SSI requirements. But don\'t give up!'}
          {status === 'undetermined' &&
            'We couldn\'t determine your eligibility with the information provided.'}
        </p>

        {/* Key Message */}
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
            status === 'eligible'
              ? 'bg-green-200 text-green-800'
              : status === 'ineligible'
              ? 'bg-amber-200 text-amber-800'
              : 'bg-blue-200 text-blue-800'
          }`}
        >
          <Heart className="w-4 h-4" />
          We encourage you to apply regardless
        </div>
      </div>

      {/* What This Means */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-500" />
          What This Means
        </h3>

        {status === 'ineligible' && (
          <div className="space-y-4">
            <p className="text-gray-700">
              Based on your answers, here's what we found:
            </p>
            <ul className="space-y-3">
              {result.checks
                .filter((c) => c.result === false)
                .map((check) => (
                  <li
                    key={check.checkKey}
                    className="flex items-start gap-3 text-gray-600"
                  >
                    <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <span>{check.plainLanguage}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {status === 'eligible' && (
          <div className="space-y-4">
            <p className="text-gray-700">
              You appear to meet the basic requirements:
            </p>
            <ul className="space-y-3">
              {result.checks
                .filter((c) => c.result === true)
                .map((check) => (
                  <li
                    key={check.checkKey}
                    className="flex items-start gap-3 text-gray-600"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                    <span>{check.plainLanguage}</span>
                  </li>
                ))}
            </ul>
          </div>
        )}

        {status === 'undetermined' && (
          <p className="text-gray-700">
            Some information was missing or couldn't be fully evaluated. This
            doesn't mean you're not eligible—it just means you should speak with
            a Social Security representative directly.
          </p>
        )}
      </div>

      {/* Next Steps */}
      <div className="bg-white rounded-xl border p-6">
        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <ArrowRight className="w-5 h-5 text-gray-500" />
          What You Can Do Next
        </h3>

        <ul className="space-y-4">
          {nextSteps.slice(0, 5).map((step, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-medium">
                {i + 1}
              </span>
              <span className="text-gray-700">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Buttons */}
      <div className="bg-blue-600 rounded-xl p-6 text-center text-white">
        <h3 className="font-semibold text-xl mb-2">
          Ready to Apply for SSI?
        </h3>
        <p className="text-blue-100 mb-4">
          You can apply online, by phone, or in person at your local Social
          Security office.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            asChild
            className="bg-white text-blue-600 hover:bg-blue-50 gap-2"
          >
            <a
              href="https://www.ssa.gov/benefits/ssi/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Apply Online
              <ExternalLink className="w-4 h-4" />
            </a>
          </Button>

          <Button
            asChild
            variant="outline"
            className="border-white text-white hover:bg-blue-500 gap-2"
          >
            <a href="tel:1-800-772-1213">
              <Phone className="w-4 h-4" />
              Call 1-800-772-1213
            </a>
          </Button>
        </div>

        <p className="text-blue-200 text-sm mt-4">
          <MapPin className="w-4 h-4 inline mr-1" />
          <a
            href="https://secure.ssa.gov/ICON/main.jsp"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Find your local Social Security office
          </a>
        </p>
      </div>

      {/* Important Disclaimer */}
      <div className="bg-gray-100 rounded-xl p-6">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-gray-500" />
          Important Information
        </h3>
        <div className="text-sm text-gray-600 space-y-2">
          <p>
            <strong>This is not an official eligibility determination.</strong>{' '}
            Only the Social Security Administration can officially determine if
            you qualify for SSI benefits.
          </p>
          <p>
            This tool uses simplified questions and may not capture all the
            factors that affect eligibility. Your actual situation may be
            different.
          </p>
          <p>
            <strong>Apply even if this tool says you may not be eligible.</strong>{' '}
            Many people who initially seem ineligible end up qualifying after a
            full review of their situation.
          </p>
        </div>
      </div>

      {/* Start Over Button */}
      <div className="text-center">
        {onStartOver && (
          <Button variant="outline" onClick={onStartOver}>
            Check Another Scenario
          </Button>
        )}
      </div>
    </div>
  );
}

export default ClaimantResultsDisplay;
