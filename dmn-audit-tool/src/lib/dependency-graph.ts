/**
 * Dependency graph extraction from DMN imports and invocations.
 * Builds a tree structure showing how checks compose into larger eligibility determinations.
 */

import type { ParsedCheck } from './types'

/**
 * Logical operator used to combine sub-checks.
 */
export type CompositionOperator = 'AND' | 'OR' | 'UNKNOWN'

/**
 * A node in the composition tree.
 */
export interface CompositionNode {
  /** Check ID (e.g., "CategoricalEligibility") */
  checkId: string
  /** Human-readable name */
  name: string
  /** Whether this is a composite or atomic check */
  isComposite: boolean
  /** Child checks that this check invokes */
  children: CompositionNode[]
  /** Operator used to combine children (AND = all must pass, OR = any must pass) */
  operator: CompositionOperator
  /** Depth in the tree (0 = root) */
  depth: number
}

/**
 * Index of all checks by their ID for fast lookup.
 */
export type CheckIndex = Map<string, ParsedCheck>

/**
 * Build an index of checks by ID.
 */
export function buildCheckIndex(checks: ParsedCheck[]): CheckIndex {
  const index = new Map<string, ParsedCheck>()
  for (const check of checks) {
    index.set(check.id, check)
  }
  return index
}

/**
 * Detect the composition operator from FEEL expressions.
 *
 * - `all(...)` indicates AND (all sub-checks must pass)
 * - `any(...)` or multiple `or` indicates OR (any sub-check can pass)
 * - Default to AND if unclear
 */
export function detectOperator(check: ParsedCheck): CompositionOperator {
  // Look through all decision context entries for aggregation functions
  for (const decision of check.decisions) {
    for (const entry of decision.contextEntries) {
      const feel = entry.feelExpression?.toLowerCase() || ''

      // Check for explicit aggregation functions
      if (feel.includes('all(') || feel.includes('every ')) {
        return 'AND'
      }
      if (feel.includes('any(') || feel.includes('some ')) {
        return 'OR'
      }

      // Check for logical operators in result expressions
      // If the final result uses 'or', it's likely an OR composition
      if (entry.variable === '' || entry.variable === 'checkResult') {
        if (/ or /i.test(feel) && !/ and /i.test(feel)) {
          return 'OR'
        }
        if (/ and /i.test(feel) && !/ or /i.test(feel)) {
          return 'AND'
        }
      }
    }
  }

  // Default to AND for composite checks, UNKNOWN otherwise
  return check.isComposite ? 'AND' : 'UNKNOWN'
}

/**
 * Build a composition tree for a specific check.
 *
 * @param checkId - The ID of the check to build the tree for
 * @param index - Index of all checks for fast lookup
 * @param visited - Set of already visited IDs (prevents cycles)
 * @param depth - Current depth in the tree
 * @returns CompositionNode or null if check not found
 */
export function buildCompositionTree(
  checkId: string,
  index: CheckIndex,
  visited: Set<string> = new Set(),
  depth: number = 0
): CompositionNode | null {
  // Prevent infinite loops from circular references
  if (visited.has(checkId)) {
    return {
      checkId,
      name: `${checkId} (circular reference)`,
      isComposite: false,
      children: [],
      operator: 'UNKNOWN',
      depth,
    }
  }

  const check = index.get(checkId)
  if (!check) {
    // Check not found in index - might be external or BKM
    return {
      checkId,
      name: checkId,
      isComposite: false,
      children: [],
      operator: 'UNKNOWN',
      depth,
    }
  }

  visited.add(checkId)

  // Build children from invocations
  const children: CompositionNode[] = []
  for (const invocation of check.invocations) {
    const childNode = buildCompositionTree(
      invocation.targetCheck,
      index,
      new Set(visited), // Create new set to allow same check in different branches
      depth + 1
    )
    if (childNode) {
      children.push(childNode)
    }
  }

  // Detect operator
  const operator = detectOperator(check)

  return {
    checkId: check.id,
    name: check.name,
    isComposite: check.isComposite,
    children,
    operator,
    depth,
  }
}

/**
 * Get the composition tree for a check by ID.
 * Convenience function that builds the index if needed.
 */
export function getCompositionTree(
  checkId: string,
  checks: ParsedCheck[]
): CompositionNode | null {
  const index = buildCheckIndex(checks)
  return buildCompositionTree(checkId, index)
}

/**
 * Get all checks that depend on (invoke) a given check.
 * Useful for understanding the impact of changing a check.
 */
export function getDependents(
  checkId: string,
  checks: ParsedCheck[]
): ParsedCheck[] {
  return checks.filter(check =>
    check.invocations.some(inv => inv.targetCheck === checkId)
  )
}

/**
 * Get all checks that a given check depends on (invokes).
 */
export function getDependencies(check: ParsedCheck): string[] {
  return check.invocations.map(inv => inv.targetCheck)
}

/**
 * Flatten a composition tree into a list of all check IDs.
 */
export function flattenTree(node: CompositionNode): string[] {
  const ids: string[] = [node.checkId]
  for (const child of node.children) {
    ids.push(...flattenTree(child))
  }
  return ids
}

/**
 * Calculate statistics about a composition tree.
 */
export function getTreeStats(node: CompositionNode): {
  totalNodes: number
  maxDepth: number
  atomicCount: number
  compositeCount: number
} {
  let totalNodes = 1
  let maxDepth = node.depth
  let atomicCount = node.isComposite ? 0 : 1
  let compositeCount = node.isComposite ? 1 : 0

  for (const child of node.children) {
    const childStats = getTreeStats(child)
    totalNodes += childStats.totalNodes
    maxDepth = Math.max(maxDepth, childStats.maxDepth)
    atomicCount += childStats.atomicCount
    compositeCount += childStats.compositeCount
  }

  return { totalNodes, maxDepth, atomicCount, compositeCount }
}
