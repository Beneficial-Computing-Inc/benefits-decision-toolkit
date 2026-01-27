/**
 * Enriched Results Display component.
 * Shows eligibility results with FEEL translations, citations, and links to check details.
 */

import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Code,
  BookOpen,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { EnrichedEligibilityResult, EnrichedCheckResult } from '@/lib/screener/result-enricher';

interface EnrichedResultsDisplayProps {
  result: EnrichedEligibilityResult;
  mode?: 'sme' | 'claimant';
  onStartOver?: () => void;
}

export function EnrichedResultsDisplay({
  result,
  mode = 'sme',
  onStartOver,
}: EnrichedResultsDisplayProps) {
  const [showFeel, setShowFeel] = useState(false);
  const [expandedChecks, setExpandedChecks] = useState<Set<string>>(
    new Set(result.checks.filter((c) => c.result === false).map((c) => c.checkKey))
  );

  // Determine overall status
  const status =
    result.isEligible === true
      ? 'eligible'
      : result.isEligible === false
      ? 'ineligible'
      : 'undetermined';

  const toggleCheck = (checkKey: string) => {
    const newExpanded = new Set(expandedChecks);
    if (newExpanded.has(checkKey)) {
      newExpanded.delete(checkKey);
    } else {
      newExpanded.add(checkKey);
    }
    setExpandedChecks(newExpanded);
  };

  return (
    <div className="space-y-6">
      {/* Overall Result Banner */}
      <div
        className={`p-6 rounded-lg ${
          status === 'eligible'
            ? 'bg-green-50 border border-green-200'
            : status === 'ineligible'
            ? 'bg-red-50 border border-red-200'
            : 'bg-yellow-50 border border-yellow-200'
        }`}
      >
        <div className="flex items-start gap-4">
          {status === 'eligible' && (
            <CheckCircle className="w-10 h-10 text-green-600 shrink-0" />
          )}
          {status === 'ineligible' && (
            <XCircle className="w-10 h-10 text-red-600 shrink-0" />
          )}
          {status === 'undetermined' && (
            <AlertCircle className="w-10 h-10 text-yellow-600 shrink-0" />
          )}
          <div className="flex-1">
            <h2
              className={`text-xl font-semibold mb-2 ${
                status === 'eligible'
                  ? 'text-green-800'
                  : status === 'ineligible'
                  ? 'text-red-800'
                  : 'text-yellow-800'
              }`}
            >
              {status === 'eligible' && 'Potentially Eligible for SSI'}
              {status === 'ineligible' && 'May Not Currently Be Eligible'}
              {status === 'undetermined' && 'Unable to Determine Eligibility'}
            </h2>
            <p
              className={`${
                status === 'eligible'
                  ? 'text-green-700'
                  : status === 'ineligible'
                  ? 'text-red-700'
                  : 'text-yellow-700'
              }`}
            >
              {status === 'eligible' &&
                'Based on the information provided, you may meet the basic SSI eligibility requirements.'}
              {status === 'ineligible' &&
                'Based on the information provided, one or more eligibility requirements may not be met.'}
              {status === 'undetermined' &&
                'Some information is missing or could not be fully evaluated.'}
            </p>

            {/* Summary Stats */}
            <div className="mt-4 flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-700">
                <CheckCircle className="w-4 h-4" />
                {result.summary.passed} passed
              </span>
              <span className="flex items-center gap-1 text-red-700">
                <XCircle className="w-4 h-4" />
                {result.summary.failed} failed
              </span>
              {result.summary.undetermined > 0 && (
                <span className="flex items-center gap-1 text-yellow-700">
                  <AlertCircle className="w-4 h-4" />
                  {result.summary.undetermined} undetermined
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="font-medium text-orange-800 mb-2 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            Evaluation Notes
          </h3>
          <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
            {result.errors.slice(0, 5).map((err, i) => (
              <li key={i}>{err.length > 150 ? err.slice(0, 150) + '...' : err}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Controls */}
      {mode === 'sme' && (
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-lg">Check Details</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFeel(!showFeel)}
            className="gap-2"
          >
            <Code className="w-4 h-4" />
            {showFeel ? 'Hide Code' : 'Show Code'}
          </Button>
        </div>
      )}

      {/* Individual Check Results */}
      <div className="space-y-3">
        {result.checks.map((check) => (
          <EnrichedCheckRow
            key={check.checkKey}
            check={check}
            showFeel={showFeel}
            isExpanded={expandedChecks.has(check.checkKey)}
            onToggle={() => toggleCheck(check.checkKey)}
            mode={mode}
          />
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between items-center pt-4 border-t">
        {onStartOver && (
          <Button variant="outline" onClick={onStartOver}>
            Start Over
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a
              href="https://www.ssa.gov/benefits/ssi/"
              target="_blank"
              rel="noopener noreferrer"
              className="gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              Learn About SSI
            </a>
          </Button>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg p-4">
        <p className="font-medium mb-1">Important Disclaimer:</p>
        <p>
          This is an informational pre-screening tool and does not constitute an
          official eligibility determination. Actual eligibility is determined by
          the Social Security Administration through a formal application process.
          We encourage you to apply regardless of this screening result, as
          individual circumstances may vary.
        </p>
      </div>
    </div>
  );
}

interface EnrichedCheckRowProps {
  check: EnrichedCheckResult;
  showFeel: boolean;
  isExpanded: boolean;
  onToggle: () => void;
  mode: 'sme' | 'claimant';
}

function EnrichedCheckRow({
  check,
  showFeel,
  isExpanded,
  onToggle,
  mode,
}: EnrichedCheckRowProps) {
  return (
    <div
      className={`border rounded-lg overflow-hidden ${
        check.result === true
          ? 'border-green-200'
          : check.result === false
          ? 'border-red-200'
          : 'border-gray-200'
      }`}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className={`w-full px-4 py-3 flex items-center justify-between text-left ${
          check.result === true
            ? 'bg-green-50 hover:bg-green-100'
            : check.result === false
            ? 'bg-red-50 hover:bg-red-100'
            : 'bg-gray-50 hover:bg-gray-100'
        }`}
      >
        <div className="flex items-center gap-3">
          {check.result === true && (
            <CheckCircle className="w-5 h-5 text-green-600 shrink-0" />
          )}
          {check.result === false && (
            <XCircle className="w-5 h-5 text-red-600 shrink-0" />
          )}
          {check.result === null && (
            <HelpCircle className="w-5 h-5 text-gray-400 shrink-0" />
          )}
          <span
            className={`font-medium ${
              check.result === true
                ? 'text-green-800'
                : check.result === false
                ? 'text-red-800'
                : 'text-gray-600'
            }`}
          >
            {check.name}
          </span>
          {check.confidence && mode === 'sme' && showFeel && (
            <Badge
              variant="outline"
              className={`text-xs ${
                check.confidence === 'high'
                  ? 'border-green-300 text-green-700'
                  : check.confidence === 'medium'
                  ? 'border-yellow-300 text-yellow-700'
                  : 'border-gray-300 text-gray-500'
              }`}
              title="Translation confidence: How accurately the decision logic was translated to plain English"
            >
              {check.confidence === 'high' ? 'exact' : check.confidence === 'medium' ? 'interpreted' : 'summary'}
            </Badge>
          )}
        </div>
        <span className="text-muted-foreground">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5" />
          ) : (
            <ChevronRight className="w-5 h-5" />
          )}
        </span>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-4 py-3 bg-white border-t space-y-3">
          {/* Plain Language Explanation */}
          <div>
            <p className="text-sm text-gray-700">{check.plainLanguage}</p>
          </div>

          {/* Undetermined Check Details */}
          {check.result === null ? (
            <UndeterminedDetails
              missingDataHints={check.missingDataHints}
              missingFieldsAnalyzed={check.missingFieldsAnalyzed}
              undeterminedSubChecks={check.undeterminedSubChecks}
            />
          ) : null}

          {/* FEEL Expression (SME mode only) */}
          {showFeel && check.feelExpression && (
            <div className="bg-slate-50 rounded p-3">
              <p className="text-xs font-medium text-slate-500 mb-1">
                Decision Logic (FEEL):
              </p>
              <code className="text-xs text-slate-700 block whitespace-pre-wrap font-mono">
                {check.feelExpression}
              </code>
              {check.explanation !== check.plainLanguage && (
                <>
                  <p className="text-xs font-medium text-slate-500 mt-2 mb-1">
                    Translation:
                  </p>
                  <p className="text-xs text-slate-700">{check.explanation}</p>
                </>
              )}
            </div>
          )}

          {/* Sub-Checks with Links */}
          {check.details?.subChecks && (
            <SubChecksDisplay
              subChecks={(check.details.subChecks as { items?: SubCheckItem[] }).items || []}
            />
          )}

          {/* Calculation Details */}
          {check.details && Object.keys(check.details).filter(k => k !== 'subChecks').length > 0 && (
            <div className="bg-blue-50 rounded p-3">
              <p className="text-xs font-medium text-blue-700 mb-2">
                Calculation Details:
              </p>
              <table className="text-xs w-full">
                <tbody>
                  {Object.entries(check.details)
                    .filter(([key]) => key !== 'subChecks')
                    .map(([key, value]) => (
                    <tr key={key}>
                      <td className="py-1 pr-4 text-blue-600">{formatKey(key)}:</td>
                      <td className="py-1 font-mono">{formatValue(value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Citations */}
          {check.citations.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
                <BookOpen className="w-3 h-3" />
                Policy References:
              </p>
              <div className="flex flex-wrap gap-2">
                {check.citations.map((citation, i) => (
                  <a
                    key={i}
                    href={citation.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-600 hover:underline font-mono flex items-center gap-1"
                  >
                    {citation.raw}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Link to Check Detail */}
          {check.detailUrl && mode === 'sme' && (
            <div className="pt-2 border-t">
              <Link
                to={check.detailUrl}
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                View full rule details
                <ExternalLink className="w-3 h-3" />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Displays helpful information for undetermined checks.
 */
function UndeterminedDetails({
  missingDataHints,
  missingFieldsAnalyzed,
  undeterminedSubChecks,
}: {
  missingDataHints?: string[];
  missingFieldsAnalyzed?: boolean;
  undeterminedSubChecks?: string[];
}): ReactNode {
  const hasHints = missingDataHints && missingDataHints.length > 0;
  const hasUndeterminedSubs = undeterminedSubChecks && undeterminedSubChecks.length > 0;

  if (!hasHints && !hasUndeterminedSubs) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded p-3 space-y-2">
      <p className="text-xs font-medium text-amber-800 flex items-center gap-1">
        <AlertCircle className="w-3.5 h-3.5" />
        {missingFieldsAnalyzed ? 'Empty Form Fields' : 'Missing Information'}
      </p>

      {hasUndeterminedSubs && (
        <div>
          <p className="text-xs text-amber-700 mb-1">
            These rules could not be evaluated:
          </p>
          <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
            {undeterminedSubChecks.map((name, i) => (
              <li key={i}>{name}</li>
            ))}
          </ul>
        </div>
      )}

      {hasHints && (
        <div>
          <p className="text-xs text-amber-700 mb-1">
            {missingFieldsAnalyzed
              ? 'You did not enter:'
              : 'To complete this check, provide:'}
          </p>
          <ul className="text-xs text-amber-600 list-disc list-inside space-y-0.5">
            {missingDataHints.map((hint, i) => (
              <li key={i}>{hint}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Sub-check item from transform.
 */
interface SubCheckItem {
  name: string;
  checkId: string;
  result: boolean | null;
  details?: Record<string, unknown>;
}

/**
 * Displays sub-checks with links to the audit tool.
 */
function SubChecksDisplay({ subChecks }: { subChecks: SubCheckItem[] }) {
  if (subChecks.length === 0) return null;

  return (
    <div className="bg-slate-50 rounded p-3">
      <p className="text-xs font-medium text-slate-600 mb-2">
        Individual Rule Results:
      </p>
      <div className="space-y-1">
        {subChecks.map((sc, idx) => (
          <div key={idx} className="flex items-center justify-between text-xs">
            <Link
              to={`/check/${sc.checkId}`}
              target="_blank"
              className="flex items-center gap-1 text-blue-600 hover:underline"
            >
              {sc.name}
              <ExternalLink className="w-3 h-3" />
            </Link>
            <span className="flex items-center gap-1">
              {sc.result === true && (
                <>
                  <CheckCircle className="w-3 h-3 text-green-600" />
                  <span className="text-green-700">Met</span>
                </>
              )}
              {sc.result === false && (
                <>
                  <XCircle className="w-3 h-3 text-red-600" />
                  <span className="text-red-700">Not Met</span>
                </>
              )}
              {sc.result === null && (
                <>
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                  <span className="text-gray-500">Unknown</span>
                </>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatKey(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

function formatValue(value: unknown): string {
  if (typeof value === 'number') {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (value === null || value === undefined) {
    return 'N/A';
  }
  return String(value);
}

export default EnrichedResultsDisplay;
