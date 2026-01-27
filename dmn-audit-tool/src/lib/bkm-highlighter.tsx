/**
 * BKM Highlighter utility.
 * Detects BKM function calls in FEEL expressions and wraps them with tooltips.
 */

import React from 'react';
import { BkmTooltip } from '../components/BkmTooltip';
import type { CheckAnnotations } from './annotations';

/**
 * BKM call pattern.
 * Matches patterns like: Age.as of date(, BDT.spouse id(, PersonMinAge.PersonMinAgeService(
 */
const BKM_CALL_PATTERN = /([A-Z][a-zA-Z]*(?:\s[a-zA-Z]+)*)\.([a-zA-Z][a-zA-Z\s]*)\s*\(/g;

/**
 * BKM annotations lookup interface.
 */
export interface BkmAnnotationsLookup {
  [bkmKey: string]: {
    description: string;
    parameters?: string[];
  };
}

/**
 * Creates a lookup map from annotations for BKM functions.
 */
export function createBkmLookup(
  annotations: Record<string, CheckAnnotations>
): BkmAnnotationsLookup {
  const lookup: BkmAnnotationsLookup = {};

  for (const checkAnnotations of Object.values(annotations)) {
    // Add model-level annotation
    if (checkAnnotations.modelAnnotation) {
      const key = checkAnnotations.checkId;
      lookup[key] = {
        description: checkAnnotations.modelAnnotation.plainLanguageSummary ||
          checkAnnotations.modelAnnotation.explanation,
      };
    }

    // Add decision-level annotations
    for (const [decisionName, annotation] of Object.entries(
      checkAnnotations.decisionAnnotations
    )) {
      const key = `${checkAnnotations.checkId}.${decisionName}`;
      lookup[key] = {
        description: annotation.plainLanguageSummary || annotation.explanation,
      };
    }
  }

  return lookup;
}

/**
 * Highlights BKM calls in a FEEL expression with interactive tooltips.
 */
export function highlightBkmCalls(
  feelExpression: string,
  annotations: BkmAnnotationsLookup
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  // Reset regex state
  BKM_CALL_PATTERN.lastIndex = 0;

  while ((match = BKM_CALL_PATTERN.exec(feelExpression)) !== null) {
    const [fullMatch, namespace, functionName] = match;
    const matchIndex = match.index;

    // Add text before the match
    if (matchIndex > lastIndex) {
      parts.push(feelExpression.slice(lastIndex, matchIndex));
    }

    // Build BKM key variations to check
    const bkmKey = `${namespace}.${functionName.trim()}`;
    const serviceKey = `${namespace}.${namespace}Service`;
    const simpleKey = namespace;

    // Look up annotation
    const annotation =
      annotations[bkmKey] ||
      annotations[serviceKey] ||
      annotations[simpleKey];

    // Add the BKM call with tooltip
    const callText = fullMatch.slice(0, -1); // Remove trailing (
    parts.push(
      <BkmTooltip
        key={`bkm-${matchIndex}`}
        bkmName={bkmKey}
        description={annotation?.description || null}
        parameters={annotation?.parameters}
      >
        {callText}
      </BkmTooltip>
    );
    parts.push('(');

    lastIndex = matchIndex + fullMatch.length;
  }

  // Add remaining text
  if (lastIndex < feelExpression.length) {
    parts.push(feelExpression.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [feelExpression];
}

/**
 * React component that renders FEEL expression with BKM tooltips.
 */
interface HighlightedFeelProps {
  expression: string;
  annotations: BkmAnnotationsLookup;
  className?: string;
}

export function HighlightedFeel({
  expression,
  annotations,
  className = '',
}: HighlightedFeelProps) {
  const highlighted = highlightBkmCalls(expression, annotations);

  return (
    <code className={`font-mono text-sm ${className}`}>
      {highlighted}
    </code>
  );
}

export default HighlightedFeel;
