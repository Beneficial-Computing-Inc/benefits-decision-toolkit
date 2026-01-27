/**
 * Maps eligibility check names to the form field keys that contribute to them.
 * Used to highlight form fields when a check fails, helping users understand
 * which of their answers caused ineligibility.
 *
 * This module supports two levels of precision:
 * 1. Coarse: CHECK_TO_FIELDS - all fields that could affect a check
 * 2. Precise: SUB_CHECK_TO_FIELDS - fields specific to each sub-check path
 */

import type { EnrichedCheckResult } from './result-enricher';

/**
 * Sub-check item from API response.
 */
interface SubCheckItem {
  name: string;
  checkId: string;
  result: boolean | null;
}

/**
 * Mapping of sub-check apiKeys to form fields.
 * More granular than CHECK_TO_FIELDS - allows highlighting only fields
 * relevant to the specific failing sub-check.
 */
export const SUB_CHECK_TO_FIELDS: Record<string, string[]> = {
  // Citizenship sub-checks
  usCitizen: ['citizenshipStatus'],
  naturalizedCitizen: ['citizenshipStatus'],
  laprWithException: [
    'citizenshipStatus',
    'qualifyingQuarters',
    'usEntryDate',
    'isVeteran',
    'isActiveDutyMilitary',
    'isSpouseOfVeteranOrActiveDuty',
    'isDependentChildOfVeteranOrActiveDuty',
    'wasLawfullyResidingOn8221996',
    'wasReceivingSSIOn8221996',
  ],
  refugeeAsylee: ['citizenshipStatus', 'refugeeAdmissionDate'],
  vietnameseAmerasian: ['citizenshipStatus', 'amerasianAdmissionDate'],
  cubanHaitianEntrant: ['citizenshipStatus', 'cubanHaitianEntryDate'],
  paroledAlien: ['citizenshipStatus', 'usEntryDate'],
  withheldDeportation: ['citizenshipStatus', 'withheldDeportationGrantDate'],

  // Categorical sub-checks
  ageCheck: ['dateOfBirth'],
  blindOrDisabledCheck: ['isBlind', 'isDisabled'],

  // Resource sub-checks
  resourceCalculation: ['countableResources', 'resources'],

  // Income sub-checks
  incomeCalculation: ['earnedIncome', 'unearnedIncome', 'currentBenefits'],
  earnedIncomeCalculation: ['earnedIncome'],
  unearnedIncomeCalculation: ['unearnedIncome', 'currentBenefits'],
  spouseDeemingCalculation: ['spouseEarnedIncome', 'spouseUnearnedIncome'],
};

/**
 * Maps citizenship status values to the relevant sub-check apiKeys.
 * Only the sub-checks for the user's chosen status should be highlighted.
 */
export const CITIZENSHIP_STATUS_TO_SUBCHECKS: Record<string, string[]> = {
  US_CITIZEN: ['usCitizen'],
  NATURALIZED_CITIZEN: ['naturalizedCitizen'],
  LPR: ['laprWithException'],
  REFUGEE: ['refugeeAsylee'],
  ASYLEE: ['refugeeAsylee'],
  CUBAN_HAITIAN_ENTRANT: ['cubanHaitianEntrant'],
  VIETNAMESE_AMERASIAN: ['vietnameseAmerasian'],
  PAROLED_ALIEN: ['paroledAlien'],
  WITHHELD_DEPORTATION: ['withheldDeportation'],
};

/**
 * Fallback: Mapping of check result keys to ALL form field keys.
 * Used when sub-check data is not available.
 */
export const CHECK_TO_FIELDS: Record<string, string[]> = {
  // Categorical eligibility: age OR blind/disabled
  categoricalEligible: ['dateOfBirth', 'isBlind', 'isDisabled'],

  // Citizenship eligibility (all fields - fallback)
  citizenshipEligible: [
    'citizenshipStatus',
    'refugeeAdmissionDate',
    'asylumGrantDate',
    'withheldDeportationGrantDate',
    'cubanHaitianEntryDate',
    'amerasianAdmissionDate',
    'usEntryDate',
    'qualifyingQuarters',
    'isVeteran',
    'isActiveDutyMilitary',
    'isSpouseOfVeteranOrActiveDuty',
    'isDependentChildOfVeteranOrActiveDuty',
    'wasLawfullyResidingOn8221996',
    'wasReceivingSSIOn8221996',
  ],

  // Residence eligibility
  residenceEligible: ['residenceState'],

  // Resource eligibility
  resourceEligible: ['countableResources', 'resources'],

  // Income eligibility
  incomeEligible: [
    'earnedIncome',
    'unearnedIncome',
    'currentBenefits',
    'incomeSources',
    'spouseEarnedIncome',
    'spouseUnearnedIncome',
  ],
};

/**
 * Human-readable labels for each check type.
 */
export const CHECK_LABELS: Record<string, string> = {
  categoricalEligible: 'Categorical Eligibility (Age/Disability)',
  citizenshipEligible: 'Citizenship/Immigration Status',
  residenceEligible: 'Residence Requirement',
  resourceEligible: 'Resource Limit',
  incomeEligible: 'Income Limit',
};

/**
 * Brief explanations shown when a field is highlighted due to a failed check.
 */
export const CHECK_EXPLANATIONS: Record<string, string> = {
  categoricalEligible:
    'SSI requires being age 65+ OR blind OR disabled. This field affects categorical eligibility.',
  citizenshipEligible:
    'SSI has specific citizenship and immigration requirements. This field affects citizenship eligibility.',
  residenceEligible:
    'SSI requires residence in the 50 states, DC, or Northern Mariana Islands.',
  resourceEligible:
    'SSI has resource limits ($2,000 individual, $3,000 couple). This field affects resource eligibility.',
  incomeEligible:
    'SSI has income limits based on the Federal Benefit Rate. This field affects income eligibility.',
};

/**
 * Given a set of failed check names, returns the unique form field keys
 * that should be highlighted.
 */
export function getFieldsToHighlight(failedChecks: string[]): Set<string> {
  const fields = new Set<string>();

  for (const check of failedChecks) {
    const checkFields = CHECK_TO_FIELDS[check];
    if (checkFields) {
      for (const field of checkFields) {
        fields.add(field);
      }
    }
  }

  return fields;
}

/**
 * Given a form field key, returns the checks that the field contributes to.
 * Useful for showing which eligibility areas a field affects.
 */
export function getChecksForField(fieldKey: string): string[] {
  const checks: string[] = [];

  for (const [check, fields] of Object.entries(CHECK_TO_FIELDS)) {
    if (fields.includes(fieldKey)) {
      checks.push(check);
    }
  }

  return checks;
}

/**
 * Result of analyzing which fields should be highlighted based on check results.
 */
export interface FieldHighlightInfo {
  /** Form field key */
  fieldKey: string;
  /** Which failed checks this field contributes to */
  failedChecks: string[];
  /** Human-readable explanation */
  explanation: string;
}

/**
 * Analyzes check results and returns detailed highlight info for each affected field.
 * This is the fallback/coarse version - use analyzeFieldHighlightsPrecise when
 * enriched check results with sub-check data are available.
 */
export function analyzeFieldHighlights(
  failedChecks: string[]
): Map<string, FieldHighlightInfo> {
  const highlights = new Map<string, FieldHighlightInfo>();

  for (const check of failedChecks) {
    const checkFields = CHECK_TO_FIELDS[check];
    if (!checkFields) continue;

    for (const fieldKey of checkFields) {
      const existing = highlights.get(fieldKey);

      if (existing) {
        // Field already has highlight info, add this check
        existing.failedChecks.push(check);
        // Update explanation to mention multiple checks
        if (existing.failedChecks.length > 1) {
          existing.explanation =
            'This field affects multiple eligibility criteria that were not met.';
        }
      } else {
        // Create new highlight info
        highlights.set(fieldKey, {
          fieldKey,
          failedChecks: [check],
          explanation: CHECK_EXPLANATIONS[check] || 'This field affects eligibility.',
        });
      }
    }
  }

  return highlights;
}

/**
 * Sub-check specific explanations for more helpful feedback.
 */
const SUB_CHECK_EXPLANATIONS: Record<string, string> = {
  laprWithException:
    'As a Lawful Permanent Resident, you need 40 qualifying work quarters OR a qualifying exception (veteran status, received SSI before 8/22/1996, etc.).',
  refugeeAsylee:
    'Refugee/Asylee status is time-limited (7 years from admission). Check if your admission date is within the eligibility window.',
  ageCheck:
    'SSI requires being age 65 or older if not blind or disabled.',
  blindOrDisabledCheck:
    'SSI requires being blind or disabled if under age 65.',
  resourceCalculation:
    'Your countable resources exceed the SSI limit ($2,000 individual, $3,000 couple).',
  incomeCalculation:
    'Your countable income exceeds the SSI limit after applicable deductions.',
  earnedIncomeCalculation:
    'Your earned income (wages, self-employment) affects the income calculation.',
  unearnedIncomeCalculation:
    'Your unearned income (benefits, pensions) affects the income calculation.',
};

/**
 * Precise field highlight analysis using sub-check data.
 * Only highlights fields that:
 * 1. Are relevant to the failing check
 * 2. The user actually provided a value for
 *
 * This prevents overwhelming users with warnings about fields they didn't fill in.
 */
export function analyzeFieldHighlightsPrecise(
  enrichedChecks: EnrichedCheckResult[],
  formValues: Record<string, unknown>
): Map<string, FieldHighlightInfo> {
  const highlights = new Map<string, FieldHighlightInfo>();

  for (const check of enrichedChecks) {
    // Skip passing or undetermined checks
    if (check.result !== false) continue;

    const fieldsToHighlight = getFieldsForFailedCheck(check, formValues);

    for (const fieldKey of fieldsToHighlight.fields) {
      // UNIVERSAL RULE: Only highlight fields the user actually filled in
      if (!hasValue(formValues[fieldKey])) {
        continue;
      }

      const existing = highlights.get(fieldKey);

      if (existing) {
        existing.failedChecks.push(check.checkKey);
        if (existing.failedChecks.length > 1) {
          existing.explanation =
            'This field affects multiple eligibility criteria that were not met.';
        }
      } else {
        highlights.set(fieldKey, {
          fieldKey,
          failedChecks: [check.checkKey],
          explanation: fieldsToHighlight.explanation,
        });
      }
    }
  }

  return highlights;
}

/**
 * Checks if a form value is meaningfully filled in (not empty/null/undefined).
 */
function hasValue(value: unknown): boolean {
  if (value === undefined || value === null || value === '') {
    return false;
  }
  // For numbers, any value including 0 is considered filled in
  if (typeof value === 'number') {
    return true;
  }
  // For booleans, both true and false are valid filled-in values
  if (typeof value === 'boolean') {
    return true;
  }
  // For strings, non-empty is filled in
  if (typeof value === 'string') {
    return value.trim().length > 0;
  }
  // For arrays, non-empty is filled in
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  return true;
}

/**
 * Determines which fields to highlight for a specific failed check,
 * using sub-check data when available to be more precise.
 */
function getFieldsForFailedCheck(
  check: EnrichedCheckResult,
  formValues: Record<string, unknown>
): { fields: string[]; explanation: string } {
  const checkKey = check.checkKey;

  // Special handling for citizenship - use sub-check based on user's status
  if (checkKey === 'citizenshipEligible') {
    return getCitizenshipFieldsForStatus(check, formValues);
  }

  // Special handling for categorical - determine age vs disability path
  if (checkKey === 'categoricalEligible') {
    return getCategoricalFieldsForSituation(check, formValues);
  }

  // For other checks, try to use sub-check data if available
  const subChecks = extractSubChecks(check);
  if (subChecks.length > 0) {
    const failingSubChecks = subChecks.filter((sc) => sc.result === false);
    if (failingSubChecks.length > 0) {
      const fields = new Set<string>();
      let explanation = CHECK_EXPLANATIONS[checkKey] || 'This field affects eligibility.';

      for (const subCheck of failingSubChecks) {
        // Try to find fields for this sub-check by matching checkId
        const subCheckKey = findSubCheckKey(subCheck.checkId);
        if (subCheckKey && SUB_CHECK_TO_FIELDS[subCheckKey]) {
          for (const field of SUB_CHECK_TO_FIELDS[subCheckKey]) {
            fields.add(field);
          }
          // Use more specific explanation if available
          if (SUB_CHECK_EXPLANATIONS[subCheckKey]) {
            explanation = SUB_CHECK_EXPLANATIONS[subCheckKey];
          }
        }
      }

      if (fields.size > 0) {
        return { fields: Array.from(fields), explanation };
      }
    }
  }

  // Fallback to coarse mapping
  return {
    fields: CHECK_TO_FIELDS[checkKey] || [],
    explanation: CHECK_EXPLANATIONS[checkKey] || 'This field affects eligibility.',
  };
}

/**
 * Gets citizenship-specific fields based on the user's selected status.
 */
function getCitizenshipFieldsForStatus(
  _check: EnrichedCheckResult,
  formValues: Record<string, unknown>
): { fields: string[]; explanation: string } {
  const citizenshipStatus = formValues.citizenshipStatus as string | undefined;

  if (!citizenshipStatus) {
    // No status selected, highlight the status field
    return {
      fields: ['citizenshipStatus'],
      explanation: 'Please select your citizenship/immigration status.',
    };
  }

  // Get the relevant sub-checks for this citizenship status
  const relevantSubCheckKeys = CITIZENSHIP_STATUS_TO_SUBCHECKS[citizenshipStatus];

  if (!relevantSubCheckKeys) {
    // Unknown status, fall back to all citizenship fields
    return {
      fields: CHECK_TO_FIELDS.citizenshipEligible,
      explanation: CHECK_EXPLANATIONS.citizenshipEligible,
    };
  }

  // Collect ALL fields from relevant sub-checks for this citizenship path
  // The universal hasValue filter in analyzeFieldHighlightsPrecise will
  // remove fields the user didn't fill in
  const fields = new Set<string>();
  let explanation = CHECK_EXPLANATIONS.citizenshipEligible;

  for (const subCheckKey of relevantSubCheckKeys) {
    const subCheckFields = SUB_CHECK_TO_FIELDS[subCheckKey];
    if (subCheckFields) {
      for (const field of subCheckFields) {
        fields.add(field);
      }
    }
    // Use sub-check specific explanation if available
    if (SUB_CHECK_EXPLANATIONS[subCheckKey]) {
      explanation = SUB_CHECK_EXPLANATIONS[subCheckKey];
    }
  }

  return {
    fields: Array.from(fields),
    explanation,
  };
}

/**
 * Gets categorical fields based on user's age situation.
 */
function getCategoricalFieldsForSituation(
  _check: EnrichedCheckResult,
  formValues: Record<string, unknown>
): { fields: string[]; explanation: string } {
  const dateOfBirth = formValues.dateOfBirth as string | undefined;
  const isBlind = formValues.isBlind as boolean | undefined;
  const isDisabled = formValues.isDisabled as boolean | undefined;

  // Calculate age if date of birth is provided
  let age: number | null = null;
  if (dateOfBirth) {
    const birthDate = new Date(dateOfBirth);
    const today = new Date();
    age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
  }

  // If 65+, the issue is likely blind/disabled status
  if (age !== null && age >= 65) {
    return {
      fields: ['dateOfBirth'],
      explanation: 'You are 65 or older, which meets the categorical requirement.',
    };
  }

  // If under 65 and not blind/disabled, highlight those fields
  if (!isBlind && !isDisabled) {
    return {
      fields: ['isBlind', 'isDisabled'],
      explanation: SUB_CHECK_EXPLANATIONS.blindOrDisabledCheck,
    };
  }

  // If under 65, highlight age field
  if (age !== null && age < 65) {
    return {
      fields: ['dateOfBirth', 'isBlind', 'isDisabled'],
      explanation: 'SSI requires being age 65+ OR blind OR disabled.',
    };
  }

  // Fallback
  return {
    fields: CHECK_TO_FIELDS.categoricalEligible,
    explanation: CHECK_EXPLANATIONS.categoricalEligible,
  };
}

/**
 * Extracts sub-check items from enriched check details.
 */
function extractSubChecks(check: EnrichedCheckResult): SubCheckItem[] {
  const details = check.details;
  if (!details) return [];

  const subChecks = details.subChecks as { items?: SubCheckItem[] } | undefined;
  return subChecks?.items || [];
}

/**
 * Maps a DMN checkId back to a sub-check key.
 */
function findSubCheckKey(checkId: string): string | null {
  // Map checkId to apiKey (reverse of SUB_CHECK_DEFINITIONS in transform.ts)
  const checkIdToKey: Record<string, string> = {
    PersonUSCitizen: 'usCitizen',
    NaturalizedCitizen: 'naturalizedCitizen',
    LaprWithException: 'laprWithException',
    RefugeeAsyleeWithinSevenYears: 'refugeeAsylee',
    VietnameseAmerasian: 'vietnameseAmerasian',
    CubanHaitianEntrant: 'cubanHaitianEntrant',
    ParoledAlien: 'paroledAlien',
    WithheldDeportation: 'withheldDeportation',
    PersonAge65OrOlder: 'ageCheck',
    BlindOrDisabled: 'blindOrDisabledCheck',
    CalculateCountableResources: 'resourceCalculation',
    CalculateCountableIncome: 'incomeCalculation',
    SsiIncomeLimit: 'incomeCalculation',
  };

  return checkIdToKey[checkId] || null;
}
