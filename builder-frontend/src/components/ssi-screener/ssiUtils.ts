/**
 * Utilities for SSI Screener - transforms form data to library-api format
 */

export interface SSIFormData {
  dateOfBirth?: string;
  isBlind?: boolean;
  isDisabled?: boolean;
  // Legacy field for backward compatibility
  isBlindOrDisabled?: boolean;
  citizenshipStatus?: string;
  residenceState?: string;
  refugeeAdmissionDate?: string;
  asylumGrantDate?: string;
  withheldDeportationGrantDate?: string;
  cubanHaitianEntryDate?: string;
  amerasianAdmissionDate?: string;
}

export interface SSISituation {
  situation: {
    evaluationDate: string;
    primaryPersonId: string;
    people: Array<{
      id: string;
      dateOfBirth: string;
      citizenshipStatus: string;
      residenceState: string;
      isBlindOrDisabled: boolean;
      refugeeAdmissionDate?: string;
      asylumGrantDate?: string;
      withheldDeportationGrantDate?: string;
      cubanHaitianEntryDate?: string;
      amerasianAdmissionDate?: string;
    }>;
    enrollments: any[];
    relationships: any[];
    simpleChecks: Record<string, any>;
  };
}

export interface SSIEligibilityResult {
  situation: any;
  checks: {
    categoricalEligible?: boolean;
    citizenshipEligible?: boolean;
    residenceEligible?: boolean;
  };
  isEligible: boolean;
}

/**
 * Transforms form data to tSituation format for library-api
 */
export function formDataToSituation(formData: SSIFormData): SSISituation {
  const today = new Date().toISOString().split('T')[0];

  // Compute isBlindOrDisabled from separate fields (backward compatibility)
  // If the legacy field is provided, use it; otherwise derive from separate fields
  const isBlind = formData.isBlind === true;
  const isDisabled = formData.isDisabled === true;
  const isBlindOrDisabled = formData.isBlindOrDisabled ?? (isBlind || isDisabled);

  // Build person object, only including date fields if they have values
  const person: any = {
    id: "p1",
    dateOfBirth: formData.dateOfBirth || "",
    citizenshipStatus: formData.citizenshipStatus || "",
    residenceState: formData.residenceState || "",
    isBlind,
    isDisabled,
    isBlindOrDisabled,
  };

  // Only include date fields if they're provided (avoid sending undefined/empty)
  if (formData.refugeeAdmissionDate) {
    person.refugeeAdmissionDate = formData.refugeeAdmissionDate;
  }
  if (formData.asylumGrantDate) {
    person.asylumGrantDate = formData.asylumGrantDate;
  }
  if (formData.withheldDeportationGrantDate) {
    person.withheldDeportationGrantDate = formData.withheldDeportationGrantDate;
  }
  if (formData.cubanHaitianEntryDate) {
    person.cubanHaitianEntryDate = formData.cubanHaitianEntryDate;
  }
  if (formData.amerasianAdmissionDate) {
    person.amerasianAdmissionDate = formData.amerasianAdmissionDate;
  }

  return {
    situation: {
      evaluationDate: today,
      primaryPersonId: "p1",
      people: [person],
      enrollments: [],
      relationships: [],
      simpleChecks: {}
    }
  };
}

/**
 * Converts boolean/null to OptionalBoolean type
 */
function toOptionalBoolean(value: boolean | null | undefined): "TRUE" | "FALSE" | "UNABLE_TO_DETERMINE" {
  if (value === true) return "TRUE";
  if (value === false) return "FALSE";
  return "UNABLE_TO_DETERMINE";
}

/**
 * Converts SSI eligibility result to screener result format
 */
export function eligibilityToScreenerResult(result: SSIEligibilityResult): any {
  return {
    "ssi": {
      name: "Supplemental Security Income (SSI)",
      result: toOptionalBoolean(result.isEligible),
      check_results: {
        categoricalEligible: {
          name: "Categorical Eligibility (Age 65+ OR Blind OR Disabled)",
          result: toOptionalBoolean(result.checks.categoricalEligible)
        },
        citizenshipEligible: {
          name: "Citizenship Eligibility (U.S. Citizen OR Qualified Alien)",
          result: toOptionalBoolean(result.checks.citizenshipEligible)
        },
        residenceEligible: {
          name: "Residence Requirement (50 States, DC, or Northern Mariana Islands)",
          result: toOptionalBoolean(result.checks.residenceEligible)
        }
      }
    }
  };
}
