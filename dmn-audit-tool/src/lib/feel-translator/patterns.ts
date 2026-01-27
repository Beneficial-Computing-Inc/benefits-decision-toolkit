/**
 * Pattern definitions for FEEL-to-English translation.
 * Each pattern has a regex to match and a template function to generate English.
 */

import {
  propertyToReadable,
  normalizeValue,
  formatList,
  humanizeOperatorShort,
  camelToReadable,
} from './normalizer'

export type Confidence = 'high' | 'medium' | 'low'

export interface TranslationResult {
  english: string
  confidence: Confidence
  pattern?: string // Name of the pattern that matched (for debugging)
}

interface Pattern {
  name: string
  regex: RegExp
  translate: (match: RegExpMatchArray) => string
  confidence: Confidence
}

// Common regex fragments
const IDENT = '[a-zA-Z_][a-zA-Z0-9_]*'
const PROP = `${IDENT}(?:\\.${IDENT})*`
const NUM = '\\d+(?:\\.\\d+)?'
const STR = `"[^"]*"|'[^']*'`
const VALUE = `(?:${STR}|${NUM}|null|true|false|${PROP})`
const OP = '(?:=|!=|<|>|<=|>=)'
const WS = '\\s*'

/**
 * Pattern definitions - order matters! More specific patterns should come first.
 */
export const patterns: Pattern[] = [
  // ============================================
  // NULL CHECKS
  // ============================================
  {
    name: 'null-check-equals',
    regex: new RegExp(`^(${PROP})${WS}=${WS}null$`),
    translate: (m) => `${propertyToReadable(m[1])} is not provided`,
    confidence: 'high',
  },
  {
    name: 'null-check-not-equals',
    regex: new RegExp(`^(${PROP})${WS}!=${WS}null$`),
    translate: (m) => `${propertyToReadable(m[1])} is provided`,
    confidence: 'high',
  },

  // ============================================
  // BOOLEAN CHECKS
  // ============================================
  {
    name: 'boolean-true',
    regex: new RegExp(`^(${PROP})${WS}=${WS}true$`),
    translate: (m) => `${propertyToReadable(m[1])} is true`,
    confidence: 'high',
  },
  {
    name: 'boolean-false',
    regex: new RegExp(`^(${PROP})${WS}=${WS}false$`),
    translate: (m) => `${propertyToReadable(m[1])} is false`,
    confidence: 'high',
  },

  // ============================================
  // SIMPLE COMPARISONS
  // ============================================
  {
    name: 'comparison-string',
    regex: new RegExp(`^(${PROP})${WS}(${OP})${WS}(${STR})$`),
    translate: (m) => `${propertyToReadable(m[1])} ${humanizeOperatorShort(m[2])} "${normalizeValue(m[3])}"`,
    confidence: 'high',
  },
  {
    name: 'comparison-number',
    regex: new RegExp(`^(${PROP})${WS}(${OP})${WS}(${NUM})$`),
    translate: (m) => `${propertyToReadable(m[1])} ${humanizeOperatorShort(m[2])} ${normalizeValue(m[3])}`,
    confidence: 'high',
  },
  {
    name: 'comparison-property',
    regex: new RegExp(`^(${PROP})${WS}(${OP})${WS}(${PROP})$`),
    translate: (m) => `${propertyToReadable(m[1])} ${humanizeOperatorShort(m[2])} ${propertyToReadable(m[3])}`,
    confidence: 'high',
  },

  // ============================================
  // LIST MEMBERSHIP (in [...])
  // ============================================
  {
    name: 'list-membership',
    regex: new RegExp(`^(${PROP})${WS}in${WS}\\[([^\\]]+)\\]$`),
    translate: (m) => {
      const items = m[2].split(',').map(s => s.trim())
      return `${propertyToReadable(m[1])} is one of: ${formatList(items, 'or')}`
    },
    confidence: 'high',
  },

  // ============================================
  // COUNT EXPRESSIONS
  // ============================================
  {
    name: 'count-equals-zero',
    regex: new RegExp(`^count\\(([^)]+)\\)${WS}=${WS}0$`),
    translate: (m) => `there are no ${camelToReadable(m[1].trim())}`,
    confidence: 'high',
  },
  {
    name: 'count-greater-zero',
    regex: new RegExp(`^count\\(([^)]+)\\)${WS}>${WS}0$`),
    translate: (m) => `there is at least one ${camelToReadable(m[1].trim()).replace(/s$/, '')}`,
    confidence: 'high',
  },
  {
    name: 'count-comparison',
    regex: new RegExp(`^count\\(([^)]+)\\)${WS}(${OP})${WS}(${NUM})$`),
    translate: (m) => `count of ${camelToReadable(m[1].trim())} ${humanizeOperatorShort(m[2])} ${m[3]}`,
    confidence: 'high',
  },

  // ============================================
  // SUM EXPRESSIONS
  // ============================================
  {
    name: 'sum-simple',
    regex: new RegExp(`^sum\\(([^)]+)\\)$`),
    translate: (m) => `sum of ${camelToReadable(m[1].trim())}`,
    confidence: 'high',
  },

  // ============================================
  // ALL/ANY EXPRESSIONS
  // ============================================
  {
    name: 'all-function',
    regex: new RegExp(`^all\\(([^)]+)\\)$`),
    translate: (m) => `all of ${camelToReadable(m[1].trim())} are true`,
    confidence: 'high',
  },
  {
    name: 'any-function',
    regex: new RegExp(`^any\\(([^)]+)\\)$`),
    translate: (m) => `any of ${camelToReadable(m[1].trim())} is true`,
    confidence: 'high',
  },

  // ============================================
  // ARRAY FILTER (common patterns)
  // ============================================
  {
    name: 'array-filter-id',
    regex: new RegExp(`^(${PROP})\\[id${WS}=${WS}(${PROP})\\]$`),
    translate: (m) => `find in ${propertyToReadable(m[1])} where id equals ${propertyToReadable(m[2])}`,
    confidence: 'high',
  },
  {
    name: 'array-filter-first',
    regex: new RegExp(`^(${PROP})\\[([^\\]]+)\\]\\[1\\]$`),
    translate: (m) => `first item from ${propertyToReadable(m[1])} where ${m[2].trim()}`,
    confidence: 'medium',
  },
  {
    name: 'array-filter-generic',
    regex: new RegExp(`^(${PROP})\\[([^\\]]+)\\]$`),
    translate: (m) => `filter ${propertyToReadable(m[1])} where ${m[2].trim()}`,
    confidence: 'medium',
  },

  // ============================================
  // SIMPLE IF-THEN-ELSE
  // ============================================
  {
    name: 'if-null-then-default',
    regex: new RegExp(`^if${WS}(${PROP})${WS}=${WS}null${WS}then${WS}(${VALUE})${WS}else${WS}(${PROP})$`),
    translate: (m) => `use ${propertyToReadable(m[3])} if provided, otherwise default to ${normalizeValue(m[2])}`,
    confidence: 'high',
  },
  {
    name: 'if-then-else-simple',
    regex: new RegExp(`^if${WS}(.+?)${WS}then${WS}(${VALUE})${WS}else${WS}(${VALUE})$`),
    translate: (m) => `if ${m[1].trim()} then ${normalizeValue(m[2])}, otherwise ${normalizeValue(m[3])}`,
    confidence: 'medium',
  },

  // ============================================
  // SOME/EVERY SATISFIES
  // ============================================
  {
    name: 'some-satisfies',
    regex: new RegExp(`^some${WS}(${IDENT})${WS}in${WS}(${PROP})${WS}satisfies${WS}(.+)$`),
    translate: (m) => `check if any ${m[1]} in ${propertyToReadable(m[2])} satisfies: ${m[3].trim()}`,
    confidence: 'medium',
  },
  {
    name: 'every-satisfies',
    regex: new RegExp(`^every${WS}(${IDENT})${WS}in${WS}(${PROP})${WS}satisfies${WS}(.+)$`),
    translate: (m) => `check if every ${m[1]} in ${propertyToReadable(m[2])} satisfies: ${m[3].trim()}`,
    confidence: 'medium',
  },

  // ============================================
  // FOR-IN-RETURN (simple)
  // ============================================
  {
    name: 'for-in-return-value',
    regex: new RegExp(`^for${WS}(${IDENT})${WS}in${WS}(${PROP})${WS}return${WS}(${IDENT})\\.(${IDENT})$`),
    translate: (m) => `extract ${camelToReadable(m[4])} from each item in ${propertyToReadable(m[2])}`,
    confidence: 'high',
  },
  {
    name: 'for-in-return-conditional',
    regex: new RegExp(`^for${WS}(${IDENT})${WS}in${WS}(${PROP})${WS}return${WS}if${WS}(.+?)${WS}then${WS}(${PROP})${WS}else${WS}0$`),
    translate: (m) => `for each item in ${propertyToReadable(m[2])}: include ${propertyToReadable(m[4])} if ${m[3].trim()}, otherwise 0`,
    confidence: 'medium',
  },

  // ============================================
  // ARITHMETIC
  // ============================================
  {
    name: 'subtraction',
    regex: new RegExp(`^(${PROP})${WS}-${WS}(${PROP})$`),
    translate: (m) => `${propertyToReadable(m[1])} minus ${propertyToReadable(m[2])}`,
    confidence: 'high',
  },
  {
    name: 'addition',
    regex: new RegExp(`^(${PROP})${WS}\\+${WS}(${PROP})$`),
    translate: (m) => `${propertyToReadable(m[1])} plus ${propertyToReadable(m[2])}`,
    confidence: 'high',
  },

  // ============================================
  // LOGICAL COMBINATIONS (handled last - complex)
  // ============================================
  {
    name: 'logical-and-simple',
    regex: new RegExp(`^(${PROP}${WS}${OP}${WS}${VALUE})${WS}and${WS}(${PROP}${WS}${OP}${WS}${VALUE})$`),
    translate: (m) => `${m[1].trim()} AND ${m[2].trim()}`,
    confidence: 'medium',
  },
  {
    name: 'logical-or-simple',
    regex: new RegExp(`^(${PROP}${WS}${OP}${WS}${VALUE})${WS}or${WS}(${PROP}${WS}${OP}${WS}${VALUE})$`),
    translate: (m) => `${m[1].trim()} OR ${m[2].trim()}`,
    confidence: 'medium',
  },
]

/**
 * Try to match an expression against all patterns.
 * Returns the first successful match, or null if no patterns match.
 */
export function matchPattern(expression: string): TranslationResult | null {
  const trimmed = expression.trim()

  for (const pattern of patterns) {
    const match = trimmed.match(pattern.regex)
    if (match) {
      return {
        english: pattern.translate(match),
        confidence: pattern.confidence,
        pattern: pattern.name,
      }
    }
  }

  return null
}
