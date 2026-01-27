/**
 * Form schema types for the SSI screener.
 * Similar to form-js schema but simplified for our needs.
 */

/**
 * Field types supported by the form renderer.
 */
export type FieldType =
  | 'text'
  | 'textfield'
  | 'number'
  | 'select'
  | 'yes_no'
  | 'date'
  | 'dynamiclist'
  | 'button'
  | 'section'
  | 'checkbox'
  | 'toggle';

/**
 * Base field properties common to all field types.
 */
export interface BaseField {
  id: string;
  type: FieldType;
  key?: string;
  label?: string;
  description?: string;
  layout?: {
    row?: string;
    columns?: number | null;
  };
  validate?: {
    required?: boolean;
    pattern?: string;
    min?: number;
    max?: number;
  };
  conditional?: {
    hide?: string; // FEEL-like expression, e.g., "=status != 'REFUGEE'"
  };
}

/**
 * Text field (markdown content display).
 */
export interface TextField extends BaseField {
  type: 'text';
  text: string;
  collapsible?: boolean;  // Enables accordion behavior
  summary?: string;       // Title shown when collapsed (defaults to first line)
}

/**
 * Text input field.
 */
export interface TextInputField extends BaseField {
  type: 'textfield';
  key: string;
  label: string;
}

/**
 * Number input field.
 */
export interface NumberField extends BaseField {
  type: 'number';
  key: string;
  label: string;
}

/**
 * Date input field.
 */
export interface DateField extends BaseField {
  type: 'date';
  key: string;
  label: string;
}

/**
 * Select dropdown field.
 */
export interface SelectField extends BaseField {
  type: 'select';
  key: string;
  label: string;
  values: Array<{
    label: string;
    value: string;
  }>;
}

/**
 * Yes/No toggle field.
 */
export interface YesNoField extends BaseField {
  type: 'yes_no';
  key: string;
  label: string;
}

/**
 * Dynamic list field (for repeatable items like resources).
 */
export interface DynamicListField extends BaseField {
  type: 'dynamiclist';
  key: string;
  label: string;
  path: string;
  components: FormField[];
  nonEmpty?: boolean;
}

/**
 * Button field.
 */
export interface ButtonField extends BaseField {
  type: 'button';
  label: string;
  action?: 'submit' | 'reset' | 'custom';
}

/**
 * Section field (collapsible group of fields).
 */
export interface SectionField extends BaseField {
  type: 'section';
  label: string;
  collapsed?: boolean;
  required?: boolean;
  components: FormField[];
}

/**
 * Checkbox field.
 */
export interface CheckboxField extends BaseField {
  type: 'checkbox';
  key: string;
  label: string;
}

/**
 * Toggle field (binary choice with custom labels).
 */
export interface ToggleField extends BaseField {
  type: 'toggle';
  key: string;
  label?: string;
  options: [
    { label: string; value: string; description?: string },
    { label: string; value: string; description?: string }
  ];
  defaultValue?: string;
}

/**
 * Union of all field types.
 */
export type FormField =
  | TextField
  | TextInputField
  | NumberField
  | DateField
  | SelectField
  | YesNoField
  | DynamicListField
  | ButtonField
  | SectionField
  | CheckboxField
  | ToggleField;

/**
 * Form schema definition.
 */
export interface FormSchema {
  type: 'default';
  id: string;
  schemaVersion: number;
  exporter?: {
    name: string;
    version: string;
  };
  components: FormField[];
}

/**
 * Form data values.
 */
export type FormValues = Record<string, unknown>;

/**
 * Form submission handler.
 */
export type FormSubmitHandler = (values: FormValues) => void | Promise<void>;

/**
 * SSI eligibility request format (matches library-api).
 */
export interface SsiEligibilityRequest {
  situation: {
    evaluationDate: string;
    primaryPersonId: string;
    people: PersonData[];
    enrollments: unknown[];
    relationships: RelationshipData[];
    simpleChecks: Record<string, unknown>;
  };
}

/**
 * Person data for library-api.
 */
export interface PersonData {
  id: string;
  dateOfBirth: string;
  citizenshipStatus: string;
  isBlind: boolean;
  isDisabled: boolean;
  isBlindOrDisabled: boolean; // Derived: isBlind || isDisabled (for backward compatibility)
  residenceState: string;
  countableResources?: number;
  resources?: ResourceData[];
  incomeSources?: IncomeSourceData[];
  // Immigration status dates
  refugeeAdmissionDate?: string;
  asylumGrantDate?: string;
  withheldDeportationGrantDate?: string;
  cubanHaitianEntryDate?: string;
  amerasianAdmissionDate?: string;
  // LPR Exception fields per POMS SI 00502.100
  usEntryDate?: string;  // Date entered US (for 5-year bar calculation)
  qualifyingQuarters?: number;  // Social Security work quarters (need 40)
  // Veteran/Military exception (SI 00502.140)
  isVeteran?: boolean;
  isActiveDutyMilitary?: boolean;
  isSpouseOfVeteranOrActiveDuty?: boolean;
  isDependentChildOfVeteranOrActiveDuty?: boolean;
  // Blind/Disabled + 8/22/96 residence exception (SI 00502.142)
  wasLawfullyResidingOn8221996?: boolean;
  // Grandfathered exception
  wasReceivingSSIOn8221996?: boolean;
}

/**
 * Resource data for library-api.
 */
export interface ResourceData {
  id: string;
  type: string;
  value: number;
  description?: string;
  isPrimaryResidence?: boolean;
  isPrimaryVehicle?: boolean;
  lifeInsuranceFaceValue?: number;
  isBurialFundDesignated?: boolean;
  isEssentialForSelfSupport?: boolean;
}

/**
 * Income source data for library-api.
 */
export interface IncomeSourceData {
  id: string;
  type: 'earned' | 'unearned';
  category: string;
  monthlyAmount: number;
  description?: string;
  isInfrequentOrIrregular?: boolean;
}

/**
 * Relationship data for library-api.
 */
export interface RelationshipData {
  type: string;
  personId: string;
  relatedPersonId: string;
}

/**
 * Enrollment data for library-api.
 * Represents a person's enrollment in a benefit program.
 */
export interface EnrollmentData {
  personId: string;
  benefit: string;
  status?: 'RECEIVING' | 'PENDING' | 'APPROVED' | 'DENIED';
  monthlyAmount?: number;
  startDate?: string;
}
