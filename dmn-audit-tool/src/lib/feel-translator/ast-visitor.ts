/**
 * AST-based FEEL translator using lezer-feel.
 * Provides a fallback for expressions that don't match simple patterns.
 */

import { parser } from 'lezer-feel'
import type { SyntaxNode } from '@lezer/common'
import { camelToReadable, humanizeOperatorShort } from './normalizer'
import type { TranslationResult } from './patterns'

/**
 * Translate a FEEL expression using AST parsing.
 * This is a fallback for expressions that don't match simple patterns.
 */
export function translateWithAst(expression: string): TranslationResult | null {
  try {
    const tree = parser.parse(expression)
    const root = tree.topNode

    // Try to translate the root node
    const english = visitNode(root, expression)
    if (english) {
      return {
        english,
        confidence: 'medium',
        pattern: 'ast',
      }
    }
  } catch {
    // Parse failed, return null to trigger fallback
  }

  return null
}

/**
 * Visit a syntax node and generate English text.
 */
function visitNode(node: SyntaxNode, source: string): string | null {
  const nodeType = node.type.name

  switch (nodeType) {
    case 'FeelProgram':
    case 'Expression':
    case 'Expressions':
      // Traverse into child
      return visitFirstChild(node, source)

    case 'Comparison':
      return visitComparison(node, source)

    case 'Conjunction':
      return visitLogical(node, source, 'and')

    case 'Disjunction':
      return visitLogical(node, source, 'or')

    case 'IfExpression':
      return visitIf(node, source)

    case 'ForExpression':
      return visitFor(node, source)

    case 'FilterExpression':
      return visitFilter(node, source)

    case 'FunctionInvocation':
      return visitFunctionCall(node, source)

    case 'PathExpression':
      return visitPath(node, source)

    case 'ArithmeticExpression':
      return visitArithmetic(node, source)

    case 'Negation':
      return visitNegation(node, source)

    case 'QualifiedName':
    case 'Name':
      return camelToReadable(getNodeText(node, source))

    case 'StringLiteral':
      return getNodeText(node, source)

    case 'NumericLiteral':
      return getNodeText(node, source)

    case 'BooleanLiteral':
      return getNodeText(node, source)

    case 'null':
      return 'null'

    default:
      // For unknown nodes, try to traverse children
      return visitFirstChild(node, source)
  }
}

function visitFirstChild(node: SyntaxNode, source: string): string | null {
  const child = node.firstChild
  if (child) {
    return visitNode(child, source)
  }
  return null
}

function visitComparison(node: SyntaxNode, source: string): string | null {
  const children = getChildren(node)
  if (children.length >= 3) {
    const left = visitNode(children[0], source)
    const op = getNodeText(children[1], source)
    const right = visitNode(children[2], source)
    if (left && right) {
      return `${left} ${humanizeOperatorShort(op)} ${right}`
    }
  }
  return null
}

function visitLogical(node: SyntaxNode, source: string, operator: string): string | null {
  const children = getChildren(node)
  const parts: string[] = []

  for (const child of children) {
    if (child.type.name !== 'and' && child.type.name !== 'or') {
      const translated = visitNode(child, source)
      if (translated) {
        parts.push(translated)
      }
    }
  }

  if (parts.length >= 2) {
    return parts.join(` ${operator.toUpperCase()} `)
  }
  return parts[0] || null
}

function visitIf(node: SyntaxNode, source: string): string | null {
  const children = getChildren(node)
  // if condition then thenBranch else elseBranch
  let condition: string | null = null
  let thenBranch: string | null = null
  let elseBranch: string | null = null

  let stage: 'condition' | 'then' | 'else' = 'condition'
  for (const child of children) {
    const name = child.type.name
    if (name === 'if') continue
    if (name === 'then') {
      stage = 'then'
      continue
    }
    if (name === 'else') {
      stage = 'else'
      continue
    }

    const translated = visitNode(child, source)
    if (stage === 'condition') condition = translated
    else if (stage === 'then') thenBranch = translated
    else if (stage === 'else') elseBranch = translated
  }

  if (condition && thenBranch && elseBranch) {
    return `if ${condition} then ${thenBranch}, otherwise ${elseBranch}`
  }
  return null
}

function visitFor(node: SyntaxNode, source: string): string | null {
  const text = getNodeText(node, source)
  // Extract variable and collection from "for x in collection return ..."
  const match = text.match(/for\s+(\w+)\s+in\s+([^\s]+)\s+return/)
  if (match) {
    const varName = match[1]
    const collection = camelToReadable(match[2])
    return `for each ${varName} in ${collection}`
  }
  return null
}

function visitFilter(node: SyntaxNode, source: string): string | null {
  const children = getChildren(node)
  if (children.length >= 2) {
    const collection = visitNode(children[0], source)
    return `filter ${collection}`
  }
  return null
}

function visitFunctionCall(node: SyntaxNode, source: string): string | null {
  const children = getChildren(node)
  if (children.length >= 1) {
    const fnName = getNodeText(children[0], source)

    // Handle common functions
    switch (fnName.toLowerCase()) {
      case 'sum':
        return `sum of ${getArgs(node, source)}`
      case 'count':
        return `count of ${getArgs(node, source)}`
      case 'all':
        return `all of ${getArgs(node, source)} are true`
      case 'any':
        return `any of ${getArgs(node, source)} is true`
      case 'not':
        return `not ${getArgs(node, source)}`
      default:
        return `${camelToReadable(fnName)}(${getArgs(node, source)})`
    }
  }
  return null
}

function visitPath(node: SyntaxNode, source: string): string | null {
  const text = getNodeText(node, source)
  const parts = text.split('.')
  if (parts.length >= 2) {
    return `${camelToReadable(parts[0])}'s ${parts.slice(1).map(camelToReadable).join(' ')}`
  }
  return camelToReadable(text)
}

function visitArithmetic(node: SyntaxNode, source: string): string | null {
  const children = getChildren(node)
  if (children.length >= 3) {
    const left = visitNode(children[0], source)
    const op = getNodeText(children[1], source).trim()
    const right = visitNode(children[2], source)

    if (left && right) {
      const opWord = op === '+' ? 'plus' : op === '-' ? 'minus' : op === '*' ? 'times' : op === '/' ? 'divided by' : op
      return `${left} ${opWord} ${right}`
    }
  }
  return null
}

function visitNegation(node: SyntaxNode, source: string): string | null {
  const child = node.firstChild?.nextSibling
  if (child) {
    const inner = visitNode(child, source)
    if (inner) {
      return `not ${inner}`
    }
  }
  return null
}

function getChildren(node: SyntaxNode): SyntaxNode[] {
  const children: SyntaxNode[] = []
  let child = node.firstChild
  while (child) {
    children.push(child)
    child = child.nextSibling
  }
  return children
}

function getNodeText(node: SyntaxNode, source: string): string {
  return source.slice(node.from, node.to)
}

function getArgs(node: SyntaxNode, source: string): string {
  // Get arguments from function call (everything inside parentheses)
  const text = getNodeText(node, source)
  const match = text.match(/\(([^)]*)\)/)
  if (match) {
    return camelToReadable(match[1].trim())
  }
  return ''
}
