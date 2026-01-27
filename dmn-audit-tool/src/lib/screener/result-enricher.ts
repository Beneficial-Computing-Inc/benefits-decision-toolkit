/**
 * Result enricher for SSI eligibility results.
 * Adds FEEL translations, POMS citations, and check metadata from parsed DMN data.
 */

import type { ParsedCheck, Citation } from '../types';
import { translateFeel, type TranslationResult } from '../feel-translator';
import { extractCitations } from '../citation-extractor';

/**
 * Maps API check names to DMN check IDs.
 * API returns: categoricalEligible, citizenshipEligible, residenceEligible, resourceEligible, incomeEligible
 * DMN uses: CategoricalEligibility, CitizenshipEligibility, etc.
 */
const CHECK_NAME_TO_DMN_ID: Record<string, string[]> = {
  categoricalEligible: ['CategoricalEligibility', 'categorical-eligibility'],
  citizenshipEligible: ['CitizenshipEligibility', 'citizenship-eligibility'],
  residenceEligible: ['SsiResidenceRequirement', 'ssi-residence-requirement'],
  resourceEligible: ['SsiResourceLimit', 'ssi-resource-limit', 'CalculateCountableResources'],
  incomeEligible: ['SsiIncomeLimit', 'ssi-income-limit', 'CalculateCountableIncome'],
};

/**
 * Human-readable names for checks.
 */
const CHECK_DISPLAY_NAMES: Record<string, string> = {
  categoricalEligible: 'Categorical Eligibility',
  citizenshipEligible: 'Citizenship & Immigration',
  residenceEligible: 'Residence Requirement',
  resourceEligible: 'Resource Limit',
  incomeEligible: 'Income Limit',
};

/**
 * Plain language explanations for check results (claimant mode).
 */
const PLAIN_LANGUAGE_EXPLANATIONS: Record<string, { fail: string; pass: string; undetermined: string }> = {
  categoricalEligible: {
    fail: 'SSI requires being age 65 or older, blind, or disabled. Based on the information provided, this requirement may not be met.',
    pass: 'You meet the categorical eligibility requirement (age 65+, blind, or disabled).',
    undetermined: 'We need more information to determine if the categorical requirement is met.',
  },
  citizenshipEligible: {
    fail: 'SSI has specific citizenship and immigration requirements. Based on the information provided, this requirement may not be met.',
    pass: 'You meet the citizenship/immigration eligibility requirement.',
    undetermined: 'We need more information about citizenship or immigration status to complete this check.',
  },
  residenceEligible: {
    fail: 'SSI requires residing in the United States or certain territories. Based on the information provided, this requirement may not be met.',
    pass: 'You meet the residence requirement.',
    undetermined: 'We need state of residence information to complete this check.',
  },
  resourceEligible: {
    fail: 'Your countable resources may exceed the SSI limit ($2,000 for individuals, $3,000 for couples). Some assets like your home and one vehicle may be excluded.',
    pass: 'Your countable resources are within the SSI limit.',
    undetermined: 'We need resource information to determine if you meet the resource limit.',
  },
  incomeEligible: {
    fail: 'Your countable income may exceed the SSI limit for your situation. Work income receives special deductions that may help.',
    pass: 'Your countable income is within the SSI limit.',
    undetermined: 'We need income information to determine if you meet the income limit.',
  },
};

/**
 * Maps form field keys to human-readable labels.
 */
const FIELD_LABELS: Record<string, string> = {
  dateOfBirth: 'Date of Birth',
  isBlindOrDisabled: 'Blind or Disabled status',
  citizenshipStatus: 'Citizenship/Immigration Status',
  residenceState: 'State of Residence',
  countableResources: 'Countable Resources',
  earnedIncome: 'Earned Income',
  unearnedIncome: 'Unearned Income',
  refugeeAdmissionDate: 'Refugee Admission Date',
  asylumGrantDate: 'Asylum Grant Date',
  usEntryDate: 'US Entry Date',
  qualifyingQuarters: 'Qualifying Work Quarters',
  isVeteran: 'Veteran Status',
  hasSpouse: 'Spouse Information',
};

/**
 * Required fields for each check category.
 * Maps check keys to arrays of form field keys needed for that check.
 */
const REQUIRED_FIELDS_BY_CHECK: Record<string, string[]> = {
  categoricalEligible: ['dateOfBirth', 'isBlindOrDisabled'],
  citizenshipEligible: ['citizenshipStatus'],
  residenceEligible: ['residenceState'],
  resourceEligible: ['countableResources'],
  incomeEligible: ['earnedIncome', 'unearnedIncome'],
};

/**
 * Conditional required fields based on citizenship status.
 */
const CITIZENSHIP_CONDITIONAL_FIELDS: Record<string, string[]> = {
  REFUGEE: ['refugeeAdmissionDate'],
  ASYLEE: ['asylumGrantDate'],
  LAPR: ['usEntryDate', 'qualifyingQuarters'],
};

/**
 * Analyzes form values to determine which specific fields are missing for a check.
 */
export function analyzesMissingFields(
  checkKey: string,
  formValues: Record<string, unknown>
): string[] {
  const missing: string[] = [];
  const requiredFields = REQUIRED_FIELDS_BY_CHECK[checkKey] || [];

  for (const field of requiredFields) {
    const value = formValues[field];
    if (value === undefined || value === null || value === '') {
      missing.push(FIELD_LABELS[field] || field);
    }
  }

  // Check citizenship-specific conditional fields
  if (checkKey === 'citizenshipEligible') {
    const status = formValues.citizenshipStatus as string;
    const conditionalFields = CITIZENSHIP_CONDITIONAL_FIELDS[status] || [];

    for (const field of conditionalFields) {
      const value = formValues[field];
      if (value === undefined || value === null || value === '') {
        missing.push(FIELD_LABELS[field] || field);
      }
    }
  }

  return missing;
}

/**
 * Default hints for undetermined checks (fallback when we can't analyze input).
 */
const DEFAULT_MISSING_DATA_HINTS: Record<string, string[]> = {
  categoricalEligible: [
    'Date of birth (to check if age 65 or older)',
    'Whether the person is blind or disabled',
  ],
  citizenshipEligible: [
    'Citizenship or immigration status',
    'For refugees/asylees: Date of admission or asylum grant',
    'For LPRs: Date entered US, qualifying work quarters, or veteran status',
  ],
  residenceEligible: [
    'State of residence',
  ],
  resourceEligible: [
    'Total countable resources (or detailed resource list)',
    'Whether you have a spouse (affects $2,000 vs $3,000 limit)',
  ],
  incomeEligible: [
    'Monthly earned income (wages, self-employment)',
    'Monthly unearned income (Social Security, pensions)',
    'For students: Whether enrolled in school (for SEIE exclusion)',
  ],
};

/**
 * Enriched check result with translations and citations.
 */
export interface EnrichedCheckResult {
  /** Internal check key (e.g., "categoricalEligible") */
  checkKey: string;
  /** Check ID for linking to detail page */
  checkId: string | null;
  /** Display name for the check */
  name: string;
  /** Pass/fail/null result */
  result: boolean | null;
  /** FEEL expression from DMN */
  feelExpression: string | null;
  /** English translation of FEEL */
  explanation: string;
  /** Translation confidence */
  confidence: TranslationResult['confidence'] | null;
  /** POMS citations */
  citations: Citation[];
  /** URL to check detail page */
  detailUrl: string | null;
  /** Plain language explanation for claimants */
  plainLanguage: string;
  /** Calculation details if available */
  details?: Record<string, unknown>;
  /** Hints about what data might be missing (for undetermined results) */
  missingDataHints?: string[];
  /** Whether missing data hints came from actual form field analysis */
  missingFieldsAnalyzed?: boolean;
  /** Sub-checks that returned undetermined */
  undeterminedSubChecks?: string[];
}

/**
 * Enriched eligibility result.
 */
export interface EnrichedEligibilityResult {
  /** Overall eligibility result */
  isEligible: boolean | null;
  /** Enriched check results */
  checks: EnrichedCheckResult[];
  /** Errors from evaluation */
  errors: string[];
  /** Summary for display */
  summary: {
    passed: number;
    failed: number;
    undetermined: number;
    total: number;
  };
}

/**
 * Raw check result from API.
 */
interface RawCheckResult {
  name: string;
  passed: boolean | null;
  details?: Record<string, unknown>;
}

/**
 * Raw eligibility result from API.
 */
interface RawEligibilityResult {
  isEligible: boolean | null;
  checks: RawCheckResult[];
  errors: string[];
}

/**
 * Finds a parsed check by ID pattern matching.
 */
function findParsedCheck(checkKey: string, parsedChecks: ParsedCheck[]): ParsedCheck | null {
  const possibleIds = CHECK_NAME_TO_DMN_ID[checkKey] || [];

  for (const id of possibleIds) {
    // Try exact match first
    const exactMatch = parsedChecks.find(c => c.id === id);
    if (exactMatch) return exactMatch;

    // Try case-insensitive match
    const lowerMatch = parsedChecks.find(c => c.id.toLowerCase() === id.toLowerCase());
    if (lowerMatch) return lowerMatch;

    // Try partial match (ID contains the pattern)
    const partialMatch = parsedChecks.find(c =>
      c.id.toLowerCase().includes(id.toLowerCase().replace(/-/g, ''))
    );
    if (partialMatch) return partialMatch;
  }

  return null;
}

/**
 * Gets the decisive FEEL expression from a check.
 * This is the expression that determines pass/fail.
 */
function getDecisiveExpression(check: ParsedCheck): string | null {
  // Look for 'checkResult' or 'result' context entry in decisions
  for (const decision of check.decisions) {
    for (const entry of decision.contextEntries) {
      if (
        entry.variable === 'checkResult' ||
        entry.variable === 'result' ||
        entry.variable.toLowerCase().includes('eligible')
      ) {
        return entry.feelExpression;
      }
    }
  }

  // Fallback: return the last context entry's expression
  const lastDecision = check.decisions[check.decisions.length - 1];
  if (lastDecision?.contextEntries.length > 0) {
    return lastDecision.contextEntries[lastDecision.contextEntries.length - 1].feelExpression;
  }

  return null;
}

/**
 * Gets citations from a parsed check.
 */
function getCheckCitations(check: ParsedCheck): Citation[] {
  // Start with model-level citations
  const citations = [...check.citations];

  // Add decision-level citations
  for (const decision of check.decisions) {
    if (decision.description) {
      citations.push(...extractCitations(decision.description));
    }
  }

  // Deduplicate by sectionId
  const seen = new Set<string>();
  return citations.filter(c => {
    if (seen.has(c.sectionId)) return false;
    seen.add(c.sectionId);
    return true;
  });
}

/**
 * Maps raw check name to check key.
 * The raw name comes from parseEligibilityResponse which formats it for display.
 */
function displayNameToCheckKey(displayName: string): string {
  const mapping: Record<string, string> = {
    'Categorical (Age/Disability)': 'categoricalEligible',
    'Citizenship': 'citizenshipEligible',
    'Residence': 'residenceEligible',
    'Resources': 'resourceEligible',
    'Income': 'incomeEligible',
  };
  return mapping[displayName] || displayName;
}

/**
 * Extracts undetermined sub-check names from details.
 */
function extractUndeterminedSubChecks(details?: Record<string, unknown>): string[] {
  if (!details?.subChecks) return [];

  const subChecks = details.subChecks as { items?: Array<{ name: string; result: boolean | null }> };
  if (!subChecks.items) return [];

  return subChecks.items
    .filter(sc => sc.result === null)
    .map(sc => sc.name);
}

/**
 * Enriches a single check result with DMN data.
 */
function enrichCheckResult(
  rawCheck: RawCheckResult,
  parsedChecks: ParsedCheck[],
  formValues?: Record<string, unknown>
): EnrichedCheckResult {
  const checkKey = displayNameToCheckKey(rawCheck.name);
  const parsedCheck = findParsedCheck(checkKey, parsedChecks);

  // Get plain language explanation based on result
  const plainLangEntry = PLAIN_LANGUAGE_EXPLANATIONS[checkKey];
  const plainLanguage = rawCheck.passed === true
    ? plainLangEntry?.pass || 'This requirement is met.'
    : rawCheck.passed === false
    ? plainLangEntry?.fail || 'This requirement may not be met.'
    : plainLangEntry?.undetermined || 'We could not determine if this requirement is met with the information provided.';

  // For undetermined results, analyze which specific fields are missing
  let missingDataHints: string[] | undefined;
  let missingFieldsAnalyzed = false;
  if (rawCheck.passed === null) {
    if (formValues) {
      const analyzedMissing = analyzesMissingFields(checkKey, formValues);
      if (analyzedMissing.length > 0) {
        missingDataHints = analyzedMissing;
        missingFieldsAnalyzed = true;
      } else {
        // Fields were provided but check still undetermined - use default hints
        missingDataHints = DEFAULT_MISSING_DATA_HINTS[checkKey];
      }
    } else {
      missingDataHints = DEFAULT_MISSING_DATA_HINTS[checkKey];
    }
  }
  const undeterminedSubChecks = rawCheck.passed === null
    ? extractUndeterminedSubChecks(rawCheck.details)
    : undefined;

  // If no parsed check found, return basic result
  if (!parsedCheck) {
    return {
      checkKey,
      checkId: null,
      name: CHECK_DISPLAY_NAMES[checkKey] || rawCheck.name,
      result: rawCheck.passed,
      feelExpression: null,
      explanation: plainLanguage,
      confidence: null,
      citations: [],
      detailUrl: null,
      plainLanguage,
      details: rawCheck.details,
      missingDataHints,
      missingFieldsAnalyzed: missingFieldsAnalyzed || undefined,
      undeterminedSubChecks,
    };
  }

  // Get FEEL expression and translate it
  const feelExpression = getDecisiveExpression(parsedCheck);
  let translationResult: TranslationResult = {
    english: plainLanguage,
    confidence: 'low',
  };

  if (feelExpression) {
    translationResult = translateFeel(feelExpression);
  }

  // Get citations
  const citations = getCheckCitations(parsedCheck);

  return {
    checkKey,
    checkId: parsedCheck.id,
    name: CHECK_DISPLAY_NAMES[checkKey] || parsedCheck.name,
    result: rawCheck.passed,
    feelExpression,
    explanation: translationResult.english,
    confidence: translationResult.confidence,
    citations,
    detailUrl: `/check/${parsedCheck.id}`,
    plainLanguage,
    details: rawCheck.details,
    missingDataHints,
    missingFieldsAnalyzed: missingFieldsAnalyzed || undefined,
    undeterminedSubChecks,
  };
}

/**
 * Enriches eligibility results with DMN data.
 * @param rawResult - Raw eligibility result from parseEligibilityResponse
 * @param parsedChecks - Parsed DMN checks from useDmnChecks hook
 * @param formValues - Optional form values to analyze missing fields
 * @returns Enriched result with translations, citations, and metadata
 */
export function enrichEligibilityResult(
  rawResult: RawEligibilityResult,
  parsedChecks: ParsedCheck[],
  formValues?: Record<string, unknown>
): EnrichedEligibilityResult {
  // Enrich each check
  const enrichedChecks = rawResult.checks.map(check =>
    enrichCheckResult(check, parsedChecks, formValues)
  );

  // Calculate summary
  const summary = {
    passed: enrichedChecks.filter(c => c.result === true).length,
    failed: enrichedChecks.filter(c => c.result === false).length,
    undetermined: enrichedChecks.filter(c => c.result === null).length,
    total: enrichedChecks.length,
  };

  return {
    isEligible: rawResult.isEligible,
    checks: enrichedChecks,
    errors: rawResult.errors,
    summary,
  };
}

/**
 * Gets actionable next steps based on check failures.
 */
export function getNextSteps(enrichedResult: EnrichedEligibilityResult): string[] {
  const steps: string[] = [];

  // Always add: Apply anyway
  steps.push('We encourage you to apply for SSI regardless of this screening result.');

  // Check for specific failures
  const failedChecks = enrichedResult.checks.filter(c => c.result === false);

  for (const check of failedChecks) {
    switch (check.checkKey) {
      case 'resourceEligible':
        steps.push('Review which of your resources may be excluded (home, one vehicle, burial funds).');
        steps.push('Consider consulting with a benefits specialist about resource structuring options.');
        break;
      case 'incomeEligible':
        steps.push('If you work, the Earned Income Exclusion and other deductions may reduce your countable income.');
        steps.push('Ask about the Student Earned Income Exclusion if applicable.');
        break;
      case 'categoricalEligible':
        steps.push('If you have a medical condition, consider applying for disability determination.');
        break;
      case 'citizenshipEligible':
        steps.push('Immigration status for SSI can be complex. Consult with an immigration attorney or benefits specialist.');
        break;
    }
  }

  // Add general resources
  steps.push('Contact your local Social Security office for official guidance.');
  steps.push('Legal aid organizations may provide free assistance with SSI applications.');

  return [...new Set(steps)]; // Remove duplicates
}

export default enrichEligibilityResult;
