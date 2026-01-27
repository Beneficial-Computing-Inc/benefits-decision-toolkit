/**
 * Form validation utilities for SSI screener.
 */

/**
 * Date validation result.
 */
export interface DateValidationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Validates a date of birth string.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param fieldName - Field name for error messages (default: "Date of birth")
 * @returns Validation result with error message if invalid
 */
export function validateDateOfBirth(
  dateStr: string | undefined | null,
  fieldName = 'Date of birth'
): DateValidationResult {
  // Empty value is handled by required validation, not here
  if (!dateStr || dateStr.trim() === '') {
    return { isValid: true };
  }

  // Check format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return {
      isValid: false,
      error: `${fieldName} must be in YYYY-MM-DD format`,
    };
  }

  // Parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: `${fieldName} is not a valid date`,
    };
  }

  // Check for future date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return {
      isValid: false,
      error: `${fieldName} cannot be in the future`,
    };
  }

  // Check for unrealistic age (> 120 years)
  const maxAge = 120;
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - maxAge);
  if (date < minDate) {
    return {
      isValid: false,
      error: `Please enter a valid ${fieldName.toLowerCase()}`,
    };
  }

  return { isValid: true };
}

/**
 * Validates that a date is not in the future.
 * Used for immigration status dates, asylum dates, etc.
 *
 * @param dateStr - Date string in YYYY-MM-DD format
 * @param fieldName - Field name for error messages
 * @returns Validation result with error message if invalid
 */
export function validatePastDate(
  dateStr: string | undefined | null,
  fieldName = 'Date'
): DateValidationResult {
  // Empty value is handled by required validation
  if (!dateStr || dateStr.trim() === '') {
    return { isValid: true };
  }

  // Check format
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(dateStr)) {
    return {
      isValid: false,
      error: `${fieldName} must be in YYYY-MM-DD format`,
    };
  }

  // Parse the date
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    return {
      isValid: false,
      error: `${fieldName} is not a valid date`,
    };
  }

  // Check for future date
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (date > today) {
    return {
      isValid: false,
      error: `${fieldName} cannot be in the future`,
    };
  }

  return { isValid: true };
}

/**
 * List of date field keys that should be validated as dates of birth.
 */
export const DATE_OF_BIRTH_FIELDS = ['dateOfBirth', 'spouseDateOfBirth'];

/**
 * List of date field keys that should be validated as past dates.
 */
export const PAST_DATE_FIELDS = [
  'refugeeAdmissionDate',
  'asylumGrantDate',
  'withheldDeportationGrantDate',
  'cubanHaitianEntryDate',
  'amerasianAdmissionDate',
  'usEntryDate',
];

/**
 * Validates a date field based on its key.
 *
 * @param key - Field key
 * @param value - Field value
 * @param label - Field label for error messages
 * @returns Validation result
 */
export function validateDateField(
  key: string,
  value: string | undefined | null,
  label?: string
): DateValidationResult {
  if (DATE_OF_BIRTH_FIELDS.includes(key)) {
    return validateDateOfBirth(value, label || 'Date of birth');
  }
  if (PAST_DATE_FIELDS.includes(key)) {
    return validatePastDate(value, label || 'Date');
  }
  // For other date fields, just validate format and no future
  return validatePastDate(value, label || 'Date');
}
