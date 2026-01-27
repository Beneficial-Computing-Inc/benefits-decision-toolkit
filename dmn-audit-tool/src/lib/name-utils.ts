/**
 * Utilities for converting between different naming formats.
 */

/**
 * Converts PascalCase or camelCase to human-readable format.
 * @example "PersonAge65OrOlder" -> "Person Age 65 or Older"
 * @example "ssiResourceLimit" -> "SSI Resource Limit"
 */
export function toReadableName(name: string): string {
  if (!name) return '';

  // Handle common abbreviations that should stay uppercase
  const abbreviations = ['SSI', 'POMS', 'SSA', 'ID', 'US', 'UK', 'URL', 'API'];

  // Insert spaces before uppercase letters, but keep consecutive uppercase together
  let result = name
    // Insert space before uppercase letter that follows lowercase
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    // Insert space before uppercase letter followed by lowercase (for acronyms)
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    // Handle numbers - add space before and after number groups
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    .replace(/(\d)([a-zA-Z])/g, '$1 $2');

  // Preserve known abbreviations
  for (const abbr of abbreviations) {
    const regex = new RegExp(`\\b${abbr.split('').join(' ?')}\\b`, 'gi');
    result = result.replace(regex, abbr);
  }

  // Capitalize first letter of each word, lowercase 'or', 'and', 'of', etc.
  const smallWords = ['or', 'and', 'of', 'in', 'for', 'to', 'the', 'a', 'an'];
  const words = result.split(' ').filter(w => w.length > 0);

  return words.map((word, index) => {
    const lower = word.toLowerCase();
    // Keep small words lowercase unless first word
    if (index > 0 && smallWords.includes(lower)) {
      return lower;
    }
    // Preserve all-caps abbreviations
    if (abbreviations.includes(word.toUpperCase())) {
      return word.toUpperCase();
    }
    // Capitalize first letter
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

/**
 * Extracts category from file path.
 * @example "checks/age/person-age-65.dmn" -> "age"
 * @example "benefits/ssi-eligibility.dmn" -> "benefits"
 */
export function extractCategory(filePath: string): string {
  // Normalize path separators
  const normalized = filePath.replace(/\\/g, '/');

  // Try to match checks/{category}/ pattern
  const checksMatch = normalized.match(/checks\/([^/]+)\//);
  if (checksMatch) {
    return checksMatch[1];
  }

  // Try to match benefits/ pattern
  if (normalized.includes('/benefits/') || normalized.startsWith('benefits/')) {
    return 'benefits';
  }

  // Fallback: use parent directory name
  const parts = normalized.split('/');
  if (parts.length >= 2) {
    return parts[parts.length - 2];
  }

  return 'uncategorized';
}

/**
 * Converts a kebab-case or snake_case string to PascalCase.
 * @example "person-age-65-or-older" -> "PersonAge65OrOlder"
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_]/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join('');
}

/**
 * Converts camelCase to readable format for variable names.
 * @example "personId" -> "person ID"
 * @example "asOfDate" -> "as of date"
 */
export function variableToReadable(name: string): string {
  if (!name) return '';

  return name
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .toLowerCase()
    .replace(/\bid\b/g, 'ID')
    .replace(/\burl\b/g, 'URL');
}
