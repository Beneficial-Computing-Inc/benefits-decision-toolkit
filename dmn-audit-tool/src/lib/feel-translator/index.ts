/**
 * FEEL-to-English translator.
 *
 * Uses a hybrid approach:
 * 1. Pattern matching for common expressions (high confidence)
 * 2. Falls back to structured description for complex expressions (lower confidence)
 *
 * @example
 * const result = translateFeel('person.age >= 65')
 * // { english: "person's age is at least 65", confidence: 'high' }
 */

import { matchPattern, type TranslationResult, type Confidence } from './patterns'
import { translateWithAst } from './ast-visitor'
export type { TranslationResult, Confidence }

/**
 * Translate a FEEL expression to English.
 *
 * Uses a hybrid approach:
 * 1. Pattern matching for common expressions (high confidence)
 * 2. AST parsing for complex expressions (medium confidence)
 * 3. Structured fallback for unparseable expressions (low confidence)
 *
 * @param expression - The FEEL expression to translate
 * @returns Translation result with English text and confidence level
 */
export function translateFeel(expression: string): TranslationResult {
  if (!expression || !expression.trim()) {
    return {
      english: '(empty expression)',
      confidence: 'low',
    }
  }

  const trimmed = expression.trim()

  // Try pattern matching first (fastest, highest confidence)
  const patternMatch = matchPattern(trimmed)
  if (patternMatch) {
    return patternMatch
  }

  // Try AST-based translation (slower, but handles more cases)
  const astResult = translateWithAst(trimmed)
  if (astResult) {
    return astResult
  }

  // Fallback: return a structured description
  return createFallbackTranslation(trimmed)
}

/**
 * Create a fallback translation for expressions that don't match patterns.
 * Tries to provide some structure rather than just returning raw FEEL.
 */
function createFallbackTranslation(expression: string): TranslationResult {
  // Check for common structures and provide hints
  if (expression.includes(' and ') || expression.includes(' or ')) {
    return {
      english: `Logical expression: ${summarizeExpression(expression)}`,
      confidence: 'low',
    }
  }

  if (expression.startsWith('if ')) {
    return {
      english: `Conditional: ${summarizeExpression(expression)}`,
      confidence: 'low',
    }
  }

  if (expression.startsWith('for ')) {
    return {
      english: `Iteration: ${summarizeExpression(expression)}`,
      confidence: 'low',
    }
  }

  if (expression.startsWith('sum(') || expression.startsWith('count(')) {
    return {
      english: `Aggregation: ${summarizeExpression(expression)}`,
      confidence: 'low',
    }
  }

  if (expression.includes('[') && expression.includes(']')) {
    return {
      english: `Filter/lookup: ${summarizeExpression(expression)}`,
      confidence: 'low',
    }
  }

  // Generic fallback
  return {
    english: summarizeExpression(expression),
    confidence: 'low',
  }
}

/**
 * Create a short summary of an expression.
 * Truncates very long expressions and adds ellipsis.
 */
function summarizeExpression(expression: string): string {
  const maxLength = 100
  if (expression.length <= maxLength) {
    return expression
  }
  return expression.slice(0, maxLength - 3) + '...'
}

/**
 * Batch translate multiple FEEL expressions.
 * Useful for translating all context entries in a decision.
 */
export function translateFeelBatch(expressions: string[]): TranslationResult[] {
  return expressions.map(translateFeel)
}

/**
 * Check if a translation is considered reliable.
 * High and medium confidence translations are considered reliable.
 */
export function isReliableTranslation(result: TranslationResult): boolean {
  return result.confidence === 'high' || result.confidence === 'medium'
}

/**
 * Get a display indicator for confidence level.
 */
export function getConfidenceIndicator(confidence: Confidence): string {
  switch (confidence) {
    case 'high':
      return '✓'
    case 'medium':
      return '~'
    case 'low':
      return '!'
  }
}
