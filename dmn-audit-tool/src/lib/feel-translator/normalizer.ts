/**
 * Utilities for normalizing FEEL identifiers to human-readable text.
 */

/**
 * Convert camelCase or PascalCase to readable text.
 * Examples:
 *   "personAge" -> "person age"
 *   "isPrimaryResidence" -> "is primary residence"
 *   "citizenshipStatus" -> "citizenship status"
 */
export function camelToReadable(str: string): string {
  return str
    .replace(/([A-Z])/g, ' $1')
    .toLowerCase()
    .trim()
}

/**
 * Convert property access to readable text.
 * Examples:
 *   "person.age" -> "person's age"
 *   "situation.people" -> "people"
 *   "r.isPrimaryVehicle" -> "resource's is primary vehicle"
 */
export function propertyToReadable(expr: string): string {
  const parts = expr.split('.')
  if (parts.length === 1) {
    return camelToReadable(parts[0])
  }

  // Handle common short variable names used in loops
  const shortVarNames: Record<string, string> = {
    'r': 'resource',
    'p': 'person',
    'e': 'enrollment',
    'i': 'item',
  }

  // Handle container objects that should be skipped (just use the property name)
  const containerObjects = new Set([
    'situation',
    'parameters',
    'context',
    'input',
    'output',
  ])

  const firstPart = parts[0].toLowerCase()

  // If the first part is a container, just describe the property
  if (containerObjects.has(firstPart)) {
    if (parts.length === 2) {
      return camelToReadable(parts[1])
    }
    // For deeper paths like situation.people.id, describe as "people's id"
    const restParts = parts.slice(1)
    return propertyToReadable(restParts.join('.'))
  }

  // Expand short variable names
  const expandedFirst = shortVarNames[parts[0]] || camelToReadable(parts[0])
  const restParts = parts.slice(1).map(p => camelToReadable(p)).join(' ')

  return `${expandedFirst}'s ${restParts}`
}

/**
 * Normalize a value for display.
 * - Removes quotes from strings
 * - Formats numbers with commas
 * - Handles special values
 */
export function normalizeValue(value: string): string {
  // Remove quotes from strings
  if ((value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1)
  }

  // Format large numbers with commas
  const num = parseFloat(value)
  if (!isNaN(num) && num >= 1000) {
    return num.toLocaleString()
  }

  return value
}

/**
 * Format a list of values for display.
 * Examples:
 *   ["A", "B", "C"] -> "A, B, or C"
 *   ["X"] -> "X"
 */
export function formatList(items: string[], conjunction: 'and' | 'or' = 'or'): string {
  const normalized = items.map(normalizeValue)

  if (normalized.length === 0) return ''
  if (normalized.length === 1) return normalized[0]
  if (normalized.length === 2) return `${normalized[0]} ${conjunction} ${normalized[1]}`

  const allButLast = normalized.slice(0, -1).join(', ')
  const last = normalized[normalized.length - 1]
  return `${allButLast}, ${conjunction} ${last}`
}

/**
 * Humanize an operator for display.
 */
export function humanizeOperator(op: string): string {
  const operators: Record<string, string> = {
    '=': 'equals',
    '!=': 'does not equal',
    '<': 'is less than',
    '>': 'is greater than',
    '<=': 'is at most',
    '>=': 'is at least',
  }
  return operators[op] || op
}

/**
 * Humanize an operator for display (short form).
 */
export function humanizeOperatorShort(op: string): string {
  const operators: Record<string, string> = {
    '=': 'is',
    '!=': 'is not',
    '<': 'is less than',
    '>': 'is greater than',
    '<=': 'is at most',
    '>=': 'is at least',
  }
  return operators[op] || op
}
