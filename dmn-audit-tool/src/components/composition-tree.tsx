/**
 * Composition tree visualization for composite checks.
 * Shows how a check is composed of sub-checks with AND/OR operators.
 */

import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CompositionNode, CompositionOperator } from '@/lib/dependency-graph'

interface CompositionTreeProps {
  node: CompositionNode
  currentCheckId?: string
}

function OperatorBadge({ operator }: { operator: CompositionOperator }) {
  if (operator === 'UNKNOWN') return null

  const colorClass = operator === 'AND'
    ? 'bg-blue-100 text-blue-700 border-blue-200'
    : 'bg-purple-100 text-purple-700 border-purple-200'

  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colorClass}`}>
      {operator}
    </span>
  )
}

function TreeNode({
  node,
  currentCheckId,
  isLast = false,
  prefix = '',
}: {
  node: CompositionNode
  currentCheckId?: string
  isLast?: boolean
  prefix?: string
}) {
  const isCurrentCheck = node.checkId === currentCheckId
  const hasChildren = node.children.length > 0

  // Build the connector prefix for children
  const childPrefix = prefix + (isLast ? '    ' : '│   ')

  return (
    <div className="font-mono text-sm">
      {/* Node line */}
      <div className="flex items-center gap-2 py-1">
        {/* Tree connector */}
        <span className="text-muted-foreground whitespace-pre">
          {prefix}{isLast ? '└── ' : '├── '}
        </span>

        {/* Node content */}
        {isCurrentCheck ? (
          // Current check - not clickable
          <span className="font-semibold text-primary flex items-center gap-2">
            {node.name}
            <Badge variant="outline" className="text-[10px] font-normal">current</Badge>
          </span>
        ) : (
          // Other checks - clickable
          <Link
            to={`/check/${node.checkId}`}
            className="text-foreground hover:text-primary hover:underline flex items-center gap-1 group"
          >
            {node.name}
            <ChevronRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </Link>
        )}

        {/* Composite badge */}
        {node.isComposite && (
          <Badge variant="secondary" className="text-[10px]">composite</Badge>
        )}

        {/* Operator badge (only show if has children) */}
        {hasChildren && <OperatorBadge operator={node.operator} />}
      </div>

      {/* Children */}
      {hasChildren && (
        <div>
          {node.children.map((child, index) => (
            <TreeNode
              key={child.checkId}
              node={child}
              currentCheckId={currentCheckId}
              isLast={index === node.children.length - 1}
              prefix={childPrefix}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function CompositionTree({ node, currentCheckId }: CompositionTreeProps) {
  const hasChildren = node.children.length > 0

  if (!hasChildren) {
    return (
      <p className="text-sm text-muted-foreground italic">
        This is an atomic check with no sub-checks.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="bg-blue-100 text-blue-700 border-blue-200 text-[10px] font-semibold px-1.5 py-0.5 rounded border">AND</span>
          All must pass
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] font-semibold px-1.5 py-0.5 rounded border">OR</span>
          Any can pass
        </span>
      </div>

      {/* Tree */}
      <div className="p-4 bg-muted/30 rounded-lg overflow-x-auto">
        {/* Root node (current check) */}
        <div className="font-mono text-sm">
          <div className="flex items-center gap-2 py-1 font-semibold">
            <span>{node.name}</span>
            {node.isComposite && (
              <Badge variant="secondary" className="text-[10px]">composite</Badge>
            )}
            <OperatorBadge operator={node.operator} />
          </div>

          {/* Children */}
          {node.children.map((child, index) => (
            <TreeNode
              key={child.checkId}
              node={child}
              currentCheckId={currentCheckId}
              isLast={index === node.children.length - 1}
              prefix=""
            />
          ))}
        </div>
      </div>
    </div>
  )
}
