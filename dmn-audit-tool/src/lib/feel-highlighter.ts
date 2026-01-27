/**
 * Simple FEEL syntax highlighter using regex-based tokenization.
 * Returns an array of tokens with type information for styling.
 */

export interface FeelToken {
  type: 'keyword' | 'function' | 'string' | 'number' | 'operator' | 'property' | 'boolean' | 'null' | 'text'
  value: string
}

// FEEL keywords
const KEYWORDS = new Set([
  'if', 'then', 'else', 'for', 'in', 'return',
  'some', 'every', 'satisfies',
  'and', 'or', 'not',
  'between', 'instance', 'of',
])

// Built-in functions
const FUNCTIONS = new Set([
  'sum', 'count', 'all', 'any', 'min', 'max', 'mean', 'avg',
  'list', 'append', 'concatenate', 'contains', 'flatten',
  'string', 'number', 'date', 'time', 'duration',
  'substring', 'string length', 'upper case', 'lower case',
  'abs', 'floor', 'ceiling', 'round',
  'years and months duration', 'get entries', 'get value',
])

// Token patterns (order matters - more specific patterns first)
const TOKEN_PATTERNS: Array<{ pattern: RegExp; type: FeelToken['type'] }> = [
  // Strings (double or single quoted)
  { pattern: /"[^"]*"/, type: 'string' },
  { pattern: /'[^']*'/, type: 'string' },

  // Numbers (including decimals)
  { pattern: /\b\d+(\.\d+)?\b/, type: 'number' },

  // Boolean literals
  { pattern: /\b(true|false)\b/, type: 'boolean' },

  // Null
  { pattern: /\bnull\b/, type: 'null' },

  // Comparison operators
  { pattern: /[<>!=]=?/, type: 'operator' },

  // Property access (word.word pattern)
  { pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*/, type: 'property' },

  // Words (keywords, functions, or identifiers)
  { pattern: /\b[a-zA-Z_][a-zA-Z0-9_]*\b/, type: 'text' },

  // Everything else
  { pattern: /[^\s]+/, type: 'text' },
  { pattern: /\s+/, type: 'text' },
]

/**
 * Tokenize a FEEL expression for syntax highlighting.
 */
export function tokenizeFeelExpression(expression: string): FeelToken[] {
  const tokens: FeelToken[] = []
  let remaining = expression

  while (remaining.length > 0) {
    let matched = false

    for (const { pattern, type } of TOKEN_PATTERNS) {
      const match = remaining.match(new RegExp(`^(${pattern.source})`))
      if (match) {
        const value = match[1]
        let tokenType = type

        // Refine type for word tokens
        if (type === 'text' && /^[a-zA-Z_]/.test(value)) {
          const lowerValue = value.toLowerCase()
          if (KEYWORDS.has(lowerValue)) {
            tokenType = 'keyword'
          } else if (FUNCTIONS.has(lowerValue)) {
            tokenType = 'function'
          }
        }

        tokens.push({ type: tokenType, value })
        remaining = remaining.slice(value.length)
        matched = true
        break
      }
    }

    // Fallback: take one character
    if (!matched) {
      tokens.push({ type: 'text', value: remaining[0] })
      remaining = remaining.slice(1)
    }
  }

  return tokens
}

/**
 * Get CSS class for a token type.
 */
export function getTokenClassName(type: FeelToken['type']): string {
  switch (type) {
    case 'keyword':
      return 'text-purple-600 dark:text-purple-400 font-semibold'
    case 'function':
      return 'text-blue-600 dark:text-blue-400'
    case 'string':
      return 'text-green-600 dark:text-green-400'
    case 'number':
      return 'text-orange-600 dark:text-orange-400'
    case 'boolean':
      return 'text-amber-600 dark:text-amber-400 font-semibold'
    case 'null':
      return 'text-red-500 dark:text-red-400 font-semibold'
    case 'operator':
      return 'text-rose-600 dark:text-rose-400'
    case 'property':
      return 'text-cyan-600 dark:text-cyan-400'
    default:
      return ''
  }
}

/**
 * Check if an expression is "long" and should be collapsible.
 * Considers both character length and line count.
 */
export function isLongExpression(expression: string): boolean {
  const lines = expression.split('\n').length
  const chars = expression.length
  return lines > 3 || chars > 200
}
