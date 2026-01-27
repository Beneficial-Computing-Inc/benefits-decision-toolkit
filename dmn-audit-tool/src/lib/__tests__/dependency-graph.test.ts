import { describe, it, expect } from 'vitest'
import {
  buildCheckIndex,
  detectOperator,
  buildCompositionTree,
  getCompositionTree,
  getDependents,
  getDependencies,
  flattenTree,
  getTreeStats,
} from '../dependency-graph'
import type { ParsedCheck } from '../types'

// Helper to create minimal check objects for testing
function createCheck(overrides: Partial<ParsedCheck>): ParsedCheck {
  return {
    id: 'TestCheck',
    name: 'Test Check',
    category: 'test',
    filePath: 'test.dmn',
    description: '',
    citations: [],
    parameters: [],
    decisions: [],
    imports: [],
    invocations: [],
    isComposite: false,
    parseErrors: [],
    ...overrides,
  }
}

describe('buildCheckIndex', () => {
  it('creates index from checks array', () => {
    const checks = [
      createCheck({ id: 'Check1' }),
      createCheck({ id: 'Check2' }),
    ]
    const index = buildCheckIndex(checks)

    expect(index.size).toBe(2)
    expect(index.get('Check1')?.id).toBe('Check1')
    expect(index.get('Check2')?.id).toBe('Check2')
  })

  it('handles empty array', () => {
    const index = buildCheckIndex([])
    expect(index.size).toBe(0)
  })
})

describe('detectOperator', () => {
  it('detects AND from all() function', () => {
    const check = createCheck({
      isComposite: true,
      decisions: [{
        name: 'checkResult',
        description: '',
        contextEntries: [{
          variable: 'result',
          type: 'boolean',
          feelExpression: 'all(checks)',
          englishTranslation: '',
          translationConfidence: 'high',
        }],
      }],
    })

    expect(detectOperator(check)).toBe('AND')
  })

  it('detects OR from any() function', () => {
    const check = createCheck({
      isComposite: true,
      decisions: [{
        name: 'checkResult',
        description: '',
        contextEntries: [{
          variable: 'result',
          type: 'boolean',
          feelExpression: 'any(checks)',
          englishTranslation: '',
          translationConfidence: 'high',
        }],
      }],
    })

    expect(detectOperator(check)).toBe('OR')
  })

  it('detects OR from some quantifier', () => {
    const check = createCheck({
      isComposite: true,
      decisions: [{
        name: 'checkResult',
        description: '',
        contextEntries: [{
          variable: '',
          type: 'boolean',
          feelExpression: 'some x in list satisfies condition',
          englishTranslation: '',
          translationConfidence: 'high',
        }],
      }],
    })

    expect(detectOperator(check)).toBe('OR')
  })

  it('defaults to AND for composite checks without clear operator', () => {
    const check = createCheck({
      isComposite: true,
      decisions: [],
    })

    expect(detectOperator(check)).toBe('AND')
  })

  it('returns UNKNOWN for atomic checks', () => {
    const check = createCheck({
      isComposite: false,
      decisions: [],
    })

    expect(detectOperator(check)).toBe('UNKNOWN')
  })
})

describe('buildCompositionTree', () => {
  it('builds tree for atomic check', () => {
    const checks = [createCheck({ id: 'AtomicCheck', name: 'Atomic Check' })]
    const index = buildCheckIndex(checks)

    const tree = buildCompositionTree('AtomicCheck', index)

    expect(tree).not.toBeNull()
    expect(tree?.checkId).toBe('AtomicCheck')
    expect(tree?.children).toHaveLength(0)
    expect(tree?.depth).toBe(0)
  })

  it('builds tree for composite check with children', () => {
    const checks = [
      createCheck({
        id: 'Parent',
        name: 'Parent Check',
        isComposite: true,
        invocations: [
          { targetCheck: 'Child1', targetService: 'Child1Service', parameterBindings: {} },
          { targetCheck: 'Child2', targetService: 'Child2Service', parameterBindings: {} },
        ],
      }),
      createCheck({ id: 'Child1', name: 'Child 1' }),
      createCheck({ id: 'Child2', name: 'Child 2' }),
    ]
    const index = buildCheckIndex(checks)

    const tree = buildCompositionTree('Parent', index)

    expect(tree?.checkId).toBe('Parent')
    expect(tree?.children).toHaveLength(2)
    expect(tree?.children[0].checkId).toBe('Child1')
    expect(tree?.children[0].depth).toBe(1)
    expect(tree?.children[1].checkId).toBe('Child2')
  })

  it('handles missing child checks gracefully', () => {
    const checks = [
      createCheck({
        id: 'Parent',
        isComposite: true,
        invocations: [
          { targetCheck: 'MissingChild', targetService: 'Service', parameterBindings: {} },
        ],
      }),
    ]
    const index = buildCheckIndex(checks)

    const tree = buildCompositionTree('Parent', index)

    expect(tree?.children).toHaveLength(1)
    expect(tree?.children[0].checkId).toBe('MissingChild')
    expect(tree?.children[0].name).toBe('MissingChild')
  })

  it('handles circular references', () => {
    const checks = [
      createCheck({
        id: 'A',
        isComposite: true,
        invocations: [{ targetCheck: 'B', targetService: 'BService', parameterBindings: {} }],
      }),
      createCheck({
        id: 'B',
        isComposite: true,
        invocations: [{ targetCheck: 'A', targetService: 'AService', parameterBindings: {} }],
      }),
    ]
    const index = buildCheckIndex(checks)

    // Should not infinite loop
    const tree = buildCompositionTree('A', index)

    expect(tree?.checkId).toBe('A')
    expect(tree?.children[0].checkId).toBe('B')
    expect(tree?.children[0].children[0].name).toContain('circular reference')
  })
})

describe('getCompositionTree', () => {
  it('convenience function works', () => {
    const checks = [createCheck({ id: 'Test', name: 'Test Check' })]
    const tree = getCompositionTree('Test', checks)

    expect(tree?.checkId).toBe('Test')
  })

  it('returns null-like node for unknown check', () => {
    const tree = getCompositionTree('Unknown', [])

    expect(tree?.checkId).toBe('Unknown')
    expect(tree?.children).toHaveLength(0)
  })
})

describe('getDependents', () => {
  it('finds checks that invoke a given check', () => {
    const checks = [
      createCheck({
        id: 'Parent1',
        invocations: [{ targetCheck: 'Shared', targetService: 'Service', parameterBindings: {} }],
      }),
      createCheck({
        id: 'Parent2',
        invocations: [{ targetCheck: 'Shared', targetService: 'Service', parameterBindings: {} }],
      }),
      createCheck({ id: 'Shared' }),
      createCheck({ id: 'Other' }),
    ]

    const dependents = getDependents('Shared', checks)

    expect(dependents).toHaveLength(2)
    expect(dependents.map(c => c.id)).toContain('Parent1')
    expect(dependents.map(c => c.id)).toContain('Parent2')
  })

  it('returns empty array if no dependents', () => {
    const checks = [createCheck({ id: 'Standalone' })]
    const dependents = getDependents('Standalone', checks)

    expect(dependents).toHaveLength(0)
  })
})

describe('getDependencies', () => {
  it('returns invoked check IDs', () => {
    const check = createCheck({
      invocations: [
        { targetCheck: 'Dep1', targetService: 'Service', parameterBindings: {} },
        { targetCheck: 'Dep2', targetService: 'Service', parameterBindings: {} },
      ],
    })

    const deps = getDependencies(check)

    expect(deps).toEqual(['Dep1', 'Dep2'])
  })

  it('returns empty array for atomic check', () => {
    const check = createCheck({ invocations: [] })
    const deps = getDependencies(check)

    expect(deps).toEqual([])
  })
})

describe('flattenTree', () => {
  it('flattens tree to list of IDs', () => {
    const tree = {
      checkId: 'Root',
      name: 'Root',
      isComposite: true,
      operator: 'AND' as const,
      depth: 0,
      children: [
        {
          checkId: 'Child1',
          name: 'Child 1',
          isComposite: false,
          operator: 'UNKNOWN' as const,
          depth: 1,
          children: [],
        },
        {
          checkId: 'Child2',
          name: 'Child 2',
          isComposite: true,
          operator: 'AND' as const,
          depth: 1,
          children: [
            {
              checkId: 'Grandchild',
              name: 'Grandchild',
              isComposite: false,
              operator: 'UNKNOWN' as const,
              depth: 2,
              children: [],
            },
          ],
        },
      ],
    }

    const ids = flattenTree(tree)

    expect(ids).toEqual(['Root', 'Child1', 'Child2', 'Grandchild'])
  })
})

describe('getTreeStats', () => {
  it('calculates tree statistics', () => {
    const tree = {
      checkId: 'Root',
      name: 'Root',
      isComposite: true,
      operator: 'AND' as const,
      depth: 0,
      children: [
        {
          checkId: 'Child1',
          name: 'Child 1',
          isComposite: false,
          operator: 'UNKNOWN' as const,
          depth: 1,
          children: [],
        },
        {
          checkId: 'Child2',
          name: 'Child 2',
          isComposite: true,
          operator: 'OR' as const,
          depth: 1,
          children: [
            {
              checkId: 'Grandchild',
              name: 'Grandchild',
              isComposite: false,
              operator: 'UNKNOWN' as const,
              depth: 2,
              children: [],
            },
          ],
        },
      ],
    }

    const stats = getTreeStats(tree)

    expect(stats.totalNodes).toBe(4)
    expect(stats.maxDepth).toBe(2)
    expect(stats.atomicCount).toBe(2)
    expect(stats.compositeCount).toBe(2)
  })
})
