/**
 * Transform form values to library-api request format.
 * Handles both simple (quick entry) and detailed input modes.
 *
 * Income Entry Modes:
 * -------------------
 * 1. Quick Mode (incomeEntryMode = 'quick'):
 *    - User enters: earnedIncome + unearnedIncome (total amounts)
 *    - Output: incomeSources[] with synthetic entries
 *    - Benefits: NOT captured (no enrollments[])
 *    - Trade-off: Less accurate but simpler
 *
 * 2. Detailed Mode (incomeEntryMode = 'detailed'):
 *    - User enters: currentBenefits[] + incomeSources[] (itemized)
 *    - Output: enrollments[] (from benefits) + incomeSources[] (non-benefit income)
 *    - Benefits: Fully tracked with amounts
 *    - DMN: Derives income from enrollments, so no double-counting
 *
 * The transform respects mode by checking which fields are populated.
 * When detailed fields (currentBenefits, incomeSources) have data,
 * they take precedence over quick entry totals.
 */

/**
 * Validates that a string is a valid ISO date format (YYYY-MM-DD).
 */
function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateStr)) return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime());
}

import type {
  FormValues,
  SsiEligibilityRequest,
  PersonData,
  IncomeSourceData,
  RelationshipData,
  ResourceData,
  EnrollmentData,
} from './types';

/**
 * Transforms form values into library-api SSI eligibility request.
 * Supports both simple totals and detailed breakdowns.
 */
export function transformToSsiRequest(values: FormValues): SsiEligibilityRequest {
  const evaluationDate = new Date().toISOString().split('T')[0];
  const primaryPersonId = 'p1';
  const spouseId = 'p2';

  // Build primary person data
  const isBlind = values.isBlind === true;
  const isDisabled = values.isDisabled === true;
  const primaryPerson: PersonData = {
    id: primaryPersonId,
    dateOfBirth: values.dateOfBirth as string || '1960-01-01',
    citizenshipStatus: values.citizenshipStatus as string || 'US_CITIZEN',
    isBlind,
    isDisabled,
    isBlindOrDisabled: isBlind || isDisabled, // Derived for backward compatibility
    residenceState: values.residenceState as string || 'PA',
  };

  // Add immigration status dates if provided
  if (values.refugeeAdmissionDate) {
    primaryPerson.refugeeAdmissionDate = values.refugeeAdmissionDate as string;
  }
  if (values.asylumGrantDate) {
    primaryPerson.asylumGrantDate = values.asylumGrantDate as string;
  }
  if (values.withheldDeportationGrantDate) {
    primaryPerson.withheldDeportationGrantDate = values.withheldDeportationGrantDate as string;
  }
  if (values.cubanHaitianEntryDate) {
    primaryPerson.cubanHaitianEntryDate = values.cubanHaitianEntryDate as string;
  }
  if (values.amerasianAdmissionDate) {
    primaryPerson.amerasianAdmissionDate = values.amerasianAdmissionDate as string;
  }

  // LPR Exception fields per POMS SI 00502.100
  if (values.usEntryDate) {
    primaryPerson.usEntryDate = values.usEntryDate as string;
  }
  if (values.qualifyingQuarters !== undefined && values.qualifyingQuarters !== '') {
    primaryPerson.qualifyingQuarters = Number(values.qualifyingQuarters);
  }
  // Veteran/Military exception (SI 00502.140)
  if (values.isVeteran !== undefined) {
    primaryPerson.isVeteran = values.isVeteran === true;
  }
  if (values.isActiveDutyMilitary !== undefined) {
    primaryPerson.isActiveDutyMilitary = values.isActiveDutyMilitary === true;
  }
  if (values.isSpouseOfVeteranOrActiveDuty !== undefined) {
    primaryPerson.isSpouseOfVeteranOrActiveDuty = values.isSpouseOfVeteranOrActiveDuty === true;
  }
  if (values.isDependentChildOfVeteranOrActiveDuty !== undefined) {
    primaryPerson.isDependentChildOfVeteranOrActiveDuty = values.isDependentChildOfVeteranOrActiveDuty === true;
  }
  // Blind/Disabled + 8/22/96 residence exception (SI 00502.142)
  if (values.wasLawfullyResidingOn8221996 !== undefined) {
    primaryPerson.wasLawfullyResidingOn8221996 = values.wasLawfullyResidingOn8221996 === true;
  }
  // Grandfathered exception
  if (values.wasReceivingSSIOn8221996 !== undefined) {
    primaryPerson.wasReceivingSSIOn8221996 = values.wasReceivingSSIOn8221996 === true;
  }

  // Determine income entry mode (defaults to 'quick' for backward compatibility)
  const incomeEntryMode = (values.incomeEntryMode as string) || 'quick';

  // Build income sources based on entry mode
  let incomeSources: IncomeSourceData[] = [];

  if (incomeEntryMode === 'detailed') {
    // Detailed Mode: Use itemized income sources (non-benefit income only)
    // Benefits are captured separately via currentBenefits -> enrollments[]
    const detailedIncome = values.incomeSources as IncomeSourceData[] | undefined;
    if (detailedIncome && detailedIncome.length > 0) {
      incomeSources = detailedIncome.map((inc, idx) => ({
        id: inc.id || `inc_${idx}`,
        type: inc.type || 'unearned',
        category: inc.category || 'other',
        monthlyAmount: Number(inc.monthlyAmount) || 0,
        description: inc.description || '',
        isInfrequentOrIrregular: inc.isInfrequentOrIrregular || false,
      }));
    }
  } else {
    // Quick Mode: Use simple totals (earnedIncome + unearnedIncome)
    // Note: In quick mode, user includes ALL income (including benefits) in totals
    const earnedIncome = Number(values.earnedIncome) || 0;
    const unearnedIncome = Number(values.unearnedIncome) || 0;

    if (earnedIncome > 0) {
      incomeSources.push({
        id: 'inc_earned',
        type: 'earned',
        category: 'wages',
        monthlyAmount: earnedIncome,
        description: 'Earned income (quick entry)',
        isInfrequentOrIrregular: false,
      });
    }

    if (unearnedIncome > 0) {
      incomeSources.push({
        id: 'inc_unearned',
        type: 'unearned',
        category: 'other_unearned', // Changed from 'SSA' - quick entry is generic
        monthlyAmount: unearnedIncome,
        description: 'Unearned income (quick entry)',
        isInfrequentOrIrregular: false,
      });
    }
  }

  // Note: In detailed mode, benefit income is captured via currentBenefits -> enrollments[]
  // The DMN derives income from enrollments, preventing double-counting.

  // If no income sources were added, add a placeholder with 0 amount
  // so the DMN knows income was explicitly provided as zero (not just missing)
  if (incomeSources.length === 0) {
    incomeSources.push({
      id: 'inc_none',
      type: 'unearned',
      category: 'other_unearned',
      monthlyAmount: 0,
      description: 'No income reported',
      isInfrequentOrIrregular: false,
    });
  }

  primaryPerson.incomeSources = incomeSources;

  // Build resources - prefer detailed list over simple total
  const detailedResources = values.resources as ResourceData[] | undefined;

  if (detailedResources && detailedResources.length > 0) {
    // Use detailed resources with exclusion flags
    primaryPerson.resources = detailedResources.map((res, idx) => ({
      id: res.id || `res_${idx}`,
      type: res.type || 'other',
      value: Number(res.value) || 0,
      description: res.description || '',
      isPrimaryResidence: res.isPrimaryResidence || false,
      isPrimaryVehicle: res.isPrimaryVehicle || false,
      lifeInsuranceFaceValue: res.lifeInsuranceFaceValue ? Number(res.lifeInsuranceFaceValue) : undefined,
      isBurialFundDesignated: res.isBurialFundDesignated || false,
      isEssentialForSelfSupport: res.isEssentialForSelfSupport || false,
    }));
  } else {
    // Fall back to simple countable resources total
    // Create a synthetic "cash" resource so the DMN can process it
    // (DMN calculates from resources array, not countableResources field)
    const countableAmount = Number(values.countableResources) || 0;
    primaryPerson.countableResources = countableAmount;
    if (countableAmount > 0) {
      primaryPerson.resources = [{
        id: 'res_countable',
        type: 'cash',
        value: countableAmount,
        description: 'Countable resources (quick entry)',
        isPrimaryResidence: false,
        isPrimaryVehicle: false,
        isEssentialForSelfSupport: false,
      }];
    } else {
      // Explicitly set empty resources array so DMN knows resources were provided (as 0)
      primaryPerson.resources = [];
    }
  }

  // Add student flag if applicable
  if (values.isStudent === true) {
    (primaryPerson as unknown as Record<string, unknown>).isStudent = true;
  }

  // Build people array
  const people: PersonData[] = [primaryPerson];

  // Build relationships array
  const relationships: RelationshipData[] = [];

  // Add spouse if present
  if (values.hasSpouse === true) {
    // Normalize spouse date of birth - ensure valid date string
    let spouseDob = values.spouseDateOfBirth as string;
    if (!spouseDob || spouseDob.trim() === '' || !isValidDateString(spouseDob)) {
      spouseDob = '1960-01-01'; // Default to ~65 years old (categorical eligible by age)
    }

    // Normalize spouse citizenship status
    let spouseCitizenship = values.spouseCitizenshipStatus as string;
    if (!spouseCitizenship || spouseCitizenship.trim() === '') {
      spouseCitizenship = 'US_CITIZEN';
    }

    const spouseIsBlind = values.spouseIsBlind === true;
    const spouseIsDisabled = values.spouseIsDisabled === true;
    const spouse: PersonData = {
      id: spouseId,
      dateOfBirth: spouseDob,
      citizenshipStatus: spouseCitizenship,
      isBlind: spouseIsBlind,
      isDisabled: spouseIsDisabled,
      isBlindOrDisabled: spouseIsBlind || spouseIsDisabled, // Derived for backward compatibility
      residenceState: primaryPerson.residenceState,
    };

    // Add spouse SSI eligibility status
    if (values.spouseIsSSIEligible !== undefined) {
      (spouse as unknown as Record<string, unknown>).isSSIEligible = values.spouseIsSSIEligible === true;
    }

    // Add spouse income
    const spouseIncomeSources: IncomeSourceData[] = [];
    const spouseEarned = Number(values.spouseEarnedIncome) || 0;
    const spouseUnearned = Number(values.spouseUnearnedIncome) || 0;

    if (spouseEarned > 0) {
      spouseIncomeSources.push({
        id: 'spouse_inc_earned',
        type: 'earned',
        category: 'wages',
        monthlyAmount: spouseEarned,
        description: 'Spouse earned income',
        isInfrequentOrIrregular: false,
      });
    }

    if (spouseUnearned > 0) {
      spouseIncomeSources.push({
        id: 'spouse_inc_unearned',
        type: 'unearned',
        category: 'SSA',
        monthlyAmount: spouseUnearned,
        description: 'Spouse unearned income',
        isInfrequentOrIrregular: false,
      });
    }

    if (spouseIncomeSources.length > 0) {
      spouse.incomeSources = spouseIncomeSources;
    }

    // Add spouse resources
    const spouseResources = Number(values.spouseCountableResources) || 0;
    if (spouseResources > 0) {
      spouse.countableResources = spouseResources;
    }

    people.push(spouse);

    // Add bidirectional spouse relationship
    relationships.push({
      type: 'spouse',
      personId: primaryPersonId,
      relatedPersonId: spouseId,
    });
    relationships.push({
      type: 'spouse',
      personId: spouseId,
      relatedPersonId: primaryPersonId,
    });
  }

  // Build simpleChecks object
  const simpleChecks: Record<string, unknown> = {};

  // Explicitly set isCouple based on hasSpouse - DMN needs this for resource/income limits
  // When hasSpouse is undefined or false, treat as single (not a couple)
  simpleChecks.isCouple = values.hasSpouse === true;

  if (values.lateSpouseWasAtLeast65 !== undefined) {
    simpleChecks.lateSpouseWasAtLeast65 = values.lateSpouseWasAtLeast65 === true;
  }
  if (values.ownerOccupant !== undefined) {
    simpleChecks.ownerOccupant = values.ownerOccupant === true;
  }

  // Build enrollments from current benefits (detailed mode only)
  // In quick mode, benefits are included in the total unearnedIncome field
  const enrollments: EnrollmentData[] = [];

  if (incomeEntryMode === 'detailed') {
    const currentBenefits = values.currentBenefits as Array<{
      benefitType?: string;
      monthlyAmount?: number | string;
      description?: string;
    }> | undefined;

    if (currentBenefits && currentBenefits.length > 0) {
      for (const benefit of currentBenefits) {
        if (!benefit.benefitType) continue;

        const enrollment: EnrollmentData = {
          personId: primaryPersonId,
          benefit: benefit.benefitType,
          status: 'RECEIVING',
        };

        // Add monthly amount if provided (required for cash benefits)
        const amount = Number(benefit.monthlyAmount) || 0;
        if (amount > 0) {
          enrollment.monthlyAmount = amount;
        }

        enrollments.push(enrollment);
      }
    }
  }
  // Note: In quick mode, enrollments[] is empty. The user's benefit income
  // is included in their unearnedIncome total, which becomes incomeSources[].

  return {
    situation: {
      evaluationDate,
      primaryPersonId,
      people,
      enrollments,
      relationships,
      simpleChecks,
    },
  };
}

/**
 * Parses a library-api response and extracts check results.
 */
export interface CheckResult {
  name: string;
  passed: boolean | null;
  details?: Record<string, unknown>;
}

export interface EligibilityResult {
  isEligible: boolean | null;
  checks: CheckResult[];
  errors: string[];
  rawResponse: unknown;
}

export function parseEligibilityResponse(response: unknown): EligibilityResult {
  const result: EligibilityResult = {
    isEligible: null,
    checks: [],
    errors: [],
    rawResponse: response,
  };

  if (!response || typeof response !== 'object') {
    result.errors.push('Invalid response format');
    return result;
  }

  const data = response as Record<string, unknown>;

  // Handle error response (has dmnContext wrapper)
  const checks = (data.checks || (data.dmnContext as Record<string, unknown>)?.checks) as Record<string, unknown> | undefined;
  const isEligible = data.isEligible ?? (data.dmnContext as Record<string, unknown>)?.isEligible;

  // Extract messages if present
  const messages = data.messages as Array<{ message: string; severity: string }> | undefined;
  if (messages) {
    for (const msg of messages) {
      if (msg.severity === 'ERROR') {
        result.errors.push(msg.message);
      }
    }
  }

  // Parse isEligible
  if (typeof isEligible === 'boolean') {
    result.isEligible = isEligible;
  }

  // Parse individual checks with detailed sub-check information
  if (checks) {
    const checkNames = [
      'categoricalEligible',
      'citizenshipEligible',
      'residenceEligible',
      'resourceEligible',
      'incomeEligible',
    ];

    for (const name of checkNames) {
      const checkValue = checks[name];
      let passed: boolean | null = null;
      let details: Record<string, unknown> = {};

      if (typeof checkValue === 'boolean') {
        passed = checkValue;
      } else if (checkValue && typeof checkValue === 'object') {
        const checkObj = checkValue as Record<string, unknown>;
        if (typeof checkObj.checkResult === 'boolean') {
          passed = checkObj.checkResult;
        }
        // Extract all details from the check object
        details = extractCheckDetails(checkObj);
      }

      // Add granular sub-check details for each category
      const subChecks = extractSubChecksForCategory(name, checks);
      if (Object.keys(subChecks).length > 0) {
        details = { ...details, subChecks };
      }

      result.checks.push({
        name: formatCheckName(name),
        passed,
        details: Object.keys(details).length > 0 ? details : undefined,
      });
    }
  }

  return result;
}

/**
 * Extracts detailed information from a check object.
 */
function extractCheckDetails(checkObj: Record<string, unknown>): Record<string, unknown> {
  const details: Record<string, unknown> = {};

  // Income calculation details
  if (checkObj.incomeCalculation && typeof checkObj.incomeCalculation === 'object') {
    const inc = checkObj.incomeCalculation as Record<string, unknown>;
    if (inc.totalEarnedIncome !== undefined) details['Earned Income'] = inc.totalEarnedIncome;
    if (inc.totalUnearnedIncome !== undefined) details['Unearned Income'] = inc.totalUnearnedIncome;
    if (inc.unearnedFromBenefits !== undefined && inc.unearnedFromBenefits !== 0) {
      details['Income from Benefits'] = inc.unearnedFromBenefits;
    }
    if (inc.earnedIncomeExclusionApplied !== undefined) details['Earned Exclusion Applied'] = inc.earnedIncomeExclusionApplied;
    if (inc.generalExclusionApplied !== undefined) details['General Exclusion Applied'] = inc.generalExclusionApplied;
    if (inc.countableEarnedIncome !== undefined) details['Countable Earned'] = inc.countableEarnedIncome;
    if (inc.countableUnearnedIncome !== undefined) details['Countable Unearned'] = inc.countableUnearnedIncome;
    if (inc.totalCountableIncome !== undefined) details['Total Countable Income'] = inc.totalCountableIncome;
    if (inc.applicableFBR !== undefined) details['FBR Limit'] = inc.applicableFBR;
    if (inc.deemedIncome !== undefined) details['Deemed Income'] = inc.deemedIncome;
    if (inc.seieExclusionApplied !== undefined) details['SEIE Applied'] = inc.seieExclusionApplied;
    // Show excluded benefits for transparency
    if (inc.excludedIncomeFromBenefits !== undefined && inc.excludedIncomeFromBenefits !== 0) {
      details['Excluded Benefits (Not Counted)'] = inc.excludedIncomeFromBenefits;
    }
    if (inc.excludedBenefits && Array.isArray(inc.excludedBenefits) && inc.excludedBenefits.length > 0) {
      details['Excluded Benefit Types'] = (inc.excludedBenefits as string[]).join(', ');
    }
  }

  // Resource calculation details
  if (checkObj.resourceCalculation && typeof checkObj.resourceCalculation === 'object') {
    const res = checkObj.resourceCalculation as Record<string, unknown>;
    if (res.totalResources !== undefined) details['Total Resources'] = res.totalResources;
    if (res.excludedResources !== undefined) details['Excluded Resources'] = res.excludedResources;
    if (res.countableResources !== undefined) details['Countable Resources'] = res.countableResources;
    if (res.applicableLimit !== undefined) details['Resource Limit'] = res.applicableLimit;
  }

  // Check for specific failure reasons
  if (checkObj.failureReason) {
    details['Failure Reason'] = checkObj.failureReason;
  }
  if (checkObj.missingRequirement) {
    details['Missing Requirement'] = checkObj.missingRequirement;
  }

  return details;
}

/**
 * Sub-check definition with DMN check ID for linking.
 */
export interface SubCheck {
  name: string;
  checkId: string;
  result: boolean | null;
  details?: Record<string, unknown>;
}

/**
 * Mapping of category to sub-check definitions.
 * Each sub-check has a display name and DMN check ID for linking.
 */
const SUB_CHECK_DEFINITIONS: Record<string, Array<{ apiKey: string; name: string; checkId: string }>> = {
  categoricalEligible: [
    { apiKey: 'ageCheck', name: 'Age 65 or Older', checkId: 'PersonAge65OrOlder' },
    { apiKey: 'blindOrDisabledCheck', name: 'Blind or Disabled', checkId: 'BlindOrDisabled' },
    { apiKey: 'spouseCategoricalEligible', name: 'Spouse Categorical', checkId: 'CategoricalEligibility' },
  ],
  citizenshipEligible: [
    { apiKey: 'usCitizen', name: 'U.S. Citizen', checkId: 'PersonUSCitizen' },
    { apiKey: 'naturalizedCitizen', name: 'Naturalized Citizen', checkId: 'NaturalizedCitizen' },
    { apiKey: 'laprWithException', name: 'LPR with Exception', checkId: 'LaprWithException' },
    { apiKey: 'refugeeAsylee', name: 'Refugee/Asylee (7-year limit)', checkId: 'RefugeeAsyleeWithinSevenYears' },
    { apiKey: 'vietnameseAmerasian', name: 'Vietnamese Amerasian', checkId: 'VietnameseAmerasian' },
    { apiKey: 'cubanHaitianEntrant', name: 'Cuban/Haitian Entrant', checkId: 'CubanHaitianEntrant' },
    { apiKey: 'paroledAlien', name: 'Paroled Alien', checkId: 'ParoledAlien' },
    { apiKey: 'withheldDeportation', name: 'Deportation Withheld', checkId: 'WithheldDeportation' },
    { apiKey: 'spouseCitizenshipEligible', name: 'Spouse Citizenship', checkId: 'CitizenshipEligibility' },
  ],
  residenceEligible: [
    { apiKey: 'stateCheck', name: 'State/Territory Residence', checkId: 'SsiResidenceRequirement' },
    { apiKey: 'usResidence', name: 'U.S. Residence', checkId: 'SsiResidenceRequirement' },
  ],
  resourceEligible: [
    { apiKey: 'homeExclusion', name: 'Home Exclusion', checkId: 'HomeExclusion' },
    { apiKey: 'vehicleExclusion', name: 'Vehicle Exclusion', checkId: 'VehicleExclusion' },
    { apiKey: 'burialFundExclusion', name: 'Burial Fund Exclusion', checkId: 'BurialFundExclusion' },
    { apiKey: 'lifeInsuranceExclusion', name: 'Life Insurance Exclusion', checkId: 'LifeInsuranceExclusion' },
    { apiKey: 'householdGoodsExclusion', name: 'Household Goods Exclusion', checkId: 'HouseholdGoodsExclusion' },
    { apiKey: 'ableAccountExclusion', name: 'ABLE Account Exclusion', checkId: 'AbleAccountExclusion' },
    { apiKey: 'selfSupportExclusion', name: 'Self-Support Property', checkId: 'SelfSupportPropertyExclusion' },
    { apiKey: 'resourceCalculation', name: 'Resource Calculation', checkId: 'CalculateCountableResources' },
  ],
  incomeEligible: [
    { apiKey: 'earnedIncomeCalculation', name: 'Earned Income Calculation', checkId: 'CalculateCountableIncome' },
    { apiKey: 'unearnedIncomeCalculation', name: 'Unearned Income', checkId: 'CalculateCountableIncome' },
    { apiKey: 'seieCalculation', name: 'Student Earned Income Exclusion', checkId: 'CalculateSeie' },
    { apiKey: 'spouseDeemingCalculation', name: 'Spouse Income Deeming', checkId: 'SpouseDeeming' },
    { apiKey: 'parentDeemingCalculation', name: 'Parent-to-Child Deeming', checkId: 'ParentToChildDeeming' },
    { apiKey: 'incomeCalculation', name: 'Income Limit Check', checkId: 'SsiIncomeLimit' },
  ],
};

/**
 * Extracts sub-checks for a given category from the API response.
 */
function extractSubChecksForCategory(
  category: string,
  checks: Record<string, unknown>
): Record<string, SubCheck[]> {
  const definitions = SUB_CHECK_DEFINITIONS[category];
  if (!definitions) return {};

  const subChecks: SubCheck[] = [];

  for (const def of definitions) {
    const checkValue = checks[def.apiKey];
    if (checkValue === undefined) continue;

    let result: boolean | null = null;
    let details: Record<string, unknown> | undefined;

    if (typeof checkValue === 'boolean') {
      result = checkValue;
    } else if (typeof checkValue === 'object' && checkValue !== null) {
      const obj = checkValue as Record<string, unknown>;
      if (typeof obj.checkResult === 'boolean') {
        result = obj.checkResult;
      }
      // Extract any additional details
      const { checkResult, ...rest } = obj;
      if (Object.keys(rest).length > 0) {
        details = rest;
      }
    }

    subChecks.push({
      name: def.name,
      checkId: def.checkId,
      result,
      details,
    });
  }

  // Also scan for any checks in the response that match the category pattern
  const categoryPrefixes: Record<string, string[]> = {
    categoricalEligible: ['age', 'blind', 'disabled', 'categorical'],
    citizenshipEligible: ['citizen', 'lpr', 'refugee', 'asylee', 'cuban', 'amerasian', 'parole', 'deportation'],
    residenceEligible: ['residence', 'state'],
    resourceEligible: ['resource', 'home', 'vehicle', 'burial', 'insurance', 'able', 'household'],
    incomeEligible: ['income', 'earned', 'unearned', 'seie', 'deeming'],
  };

  const prefixes = categoryPrefixes[category] || [];
  for (const [key, value] of Object.entries(checks)) {
    const lowerKey = key.toLowerCase();
    const matchesPrefix = prefixes.some(p => lowerKey.includes(p));
    if (!matchesPrefix) continue;

    // Skip if already added
    if (subChecks.some(sc => sc.checkId.toLowerCase() === key.toLowerCase())) continue;

    if (typeof value === 'boolean') {
      subChecks.push({
        name: formatApiKeyToName(key),
        checkId: apiKeyToCheckId(key),
        result: value,
      });
    } else if (typeof value === 'object' && value !== null) {
      const obj = value as Record<string, unknown>;
      if (typeof obj.checkResult === 'boolean') {
        const { checkResult, ...rest } = obj;
        subChecks.push({
          name: formatApiKeyToName(key),
          checkId: apiKeyToCheckId(key),
          result: checkResult,
          details: Object.keys(rest).length > 0 ? rest : undefined,
        });
      }
    }
  }

  return subChecks.length > 0 ? { items: subChecks } : {};
}

/**
 * Converts API key to human-readable name.
 */
function formatApiKeyToName(key: string): string {
  return key
    .replace(/Check$/, '')
    .replace(/Calculation$/, '')
    .replace(/Exclusion$/, ' Exclusion')
    .replace(/Eligible$/, '')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/**
 * Maps API key to most likely DMN check ID.
 */
function apiKeyToCheckId(key: string): string {
  // Convert camelCase to PascalCase for DMN IDs
  const pascalCase = key.replace(/^[a-z]/, s => s.toUpperCase());
  // Remove common suffixes
  return pascalCase
    .replace(/Check$/, '')
    .replace(/Calculation$/, '');
}

/**
 * Formats check name for display.
 */
function formatCheckName(name: string): string {
  const nameMap: Record<string, string> = {
    categoricalEligible: 'Categorical (Age/Disability)',
    citizenshipEligible: 'Citizenship',
    residenceEligible: 'Residence',
    resourceEligible: 'Resources',
    incomeEligible: 'Income',
  };
  return nameMap[name] || name;
}
