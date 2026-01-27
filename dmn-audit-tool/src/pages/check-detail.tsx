import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ExternalLink, ArrowLeft, AlertCircle, ChevronDown, ChevronRight, Code, Eye } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ErrorDisplay } from '@/components/error-boundary'
import { useCheckById } from '@/hooks/use-dmn-checks'
import { tokenizeFeelExpression, getTokenClassName, isLongExpression } from '@/lib/feel-highlighter'
import { translateFeel, getConfidenceIndicator, type Confidence } from '@/lib/feel-translator'
import { getCompositionTree } from '@/lib/dependency-graph'
import { CompositionTree } from '@/components/composition-tree'
import { useDmnChecks } from '@/hooks/use-dmn-checks'
import type { ParsedCheck, ContextEntry } from '@/lib/types'

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 bg-muted rounded animate-pulse" />
      <div className="h-12 w-96 bg-muted rounded animate-pulse" />
      <div className="h-64 bg-muted rounded animate-pulse" />
    </div>
  )
}

function NotFound({ checkId }: { checkId: string }) {
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-semibold mb-2">Check Not Found</h2>
      <p className="text-muted-foreground mb-4">
        No check found with ID: <code className="bg-muted px-2 py-1 rounded">{checkId}</code>
      </p>
      <Link to="/">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Catalog
        </Button>
      </Link>
    </div>
  )
}

function OverviewTab({ check, allChecks }: { check: ParsedCheck; allChecks: ParsedCheck[] }) {
  // Build composition tree for composite checks
  const compositionTree = check.isComposite
    ? getCompositionTree(check.id, allChecks)
    : null

  return (
    <div className="space-y-6">
      {/* Description */}
      <div>
        <h3 className="text-lg font-medium mb-3">Purpose</h3>
        <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
          {check.description || 'No description available.'}
        </p>
      </div>

      {/* Key Info Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Inputs */}
        {check.parameters.length > 0 && (
          <div>
            <h3 className="text-lg font-medium mb-3">Inputs</h3>
            <div className="space-y-2">
              {check.parameters.map((param, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <code className="bg-muted px-2 py-1 rounded font-mono">
                    {param.name}
                  </code>
                  <span className="text-muted-foreground">{param.type || 'any'}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Output */}
        <div>
          <h3 className="text-lg font-medium mb-3">Returns</h3>
          <div className="flex items-center gap-3 text-sm">
            <code className="bg-muted px-2 py-1 rounded font-mono">boolean</code>
            <span className="text-muted-foreground">true if check passes</span>
          </div>
        </div>
      </div>

      {/* Composition Tree (for composite checks) */}
      {compositionTree && compositionTree.children.length > 0 && (
        <div>
          <h3 className="text-lg font-medium mb-3">Composition</h3>
          <p className="text-sm text-muted-foreground mb-4">
            This check combines results from sub-checks. Click any check to view its details.
          </p>
          <CompositionTree node={compositionTree} currentCheckId={check.id} />
        </div>
      )}
    </div>
  )
}

function CitationsTab({ check }: { check: ParsedCheck }) {
  if (check.citations.length === 0) {
    return (
      <div className="flex items-start gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div>
          <p className="font-medium text-yellow-800">No citations found</p>
          <p className="text-sm text-yellow-700 mt-1">
            This check may need documentation review.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {check.citations.map((citation, i) => (
        <div key={i} className="p-4 border rounded-lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-mono font-medium text-lg">{citation.raw}</p>
              {citation.description && (
                <p className="text-muted-foreground mt-1">{citation.description}</p>
              )}
            </div>
            <a
              href={citation.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0"
            >
              <Button variant="outline" size="sm">
                View in POMS
                <ExternalLink className="h-3 w-3 ml-2" />
              </Button>
            </a>
          </div>
        </div>
      ))}
    </div>
  )
}

function HighlightedFeel({ expression }: { expression: string }) {
  const tokens = tokenizeFeelExpression(expression)

  return (
    <>
      {tokens.map((token, i) => {
        const className = getTokenClassName(token.type)
        return className ? (
          <span key={i} className={className}>{token.value}</span>
        ) : (
          <span key={i}>{token.value}</span>
        )
      })}
    </>
  )
}

function ConfidenceBadge({ confidence }: { confidence: Confidence }) {
  const indicator = getConfidenceIndicator(confidence)
  const colorClass = {
    high: 'text-green-600 bg-green-50 border-green-200',
    medium: 'text-yellow-600 bg-yellow-50 border-yellow-200',
    low: 'text-orange-600 bg-orange-50 border-orange-200',
  }[confidence]

  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 text-xs font-medium rounded border ${colorClass}`}
      title={`${confidence} confidence translation`}
    >
      {indicator}
    </span>
  )
}

function LogicStep({ entry, index, showFeel }: { entry: ContextEntry; index: number; showFeel: boolean }) {
  const [isExpanded, setIsExpanded] = useState(true)

  if (!entry.feelExpression) return null

  // Translate the FEEL expression
  const translation = translateFeel(entry.feelExpression)

  // Determine if this is the final return (no variable name)
  const isFinalReturn = !entry.variable
  const isLong = isLongExpression(entry.feelExpression)

  // For long expressions, start collapsed
  const showContent = isLong ? isExpanded : true

  return (
    <div className={`border-l-4 ${isFinalReturn ? 'border-primary' : 'border-muted'} pl-4 py-3`}>
      <div className="flex items-center gap-2 mb-2">
        {isLong && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isExpanded ? 'Collapse' : 'Expand'}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        )}
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          {isFinalReturn ? 'Return' : `Step ${index + 1}`}
        </span>
        {entry.variable && (
          <>
            <span className="text-muted-foreground">→</span>
            <code className="font-mono text-sm font-medium">{entry.variable}</code>
          </>
        )}
        {entry.type && (
          <span className="text-xs text-muted-foreground">: {entry.type}</span>
        )}
        {isLong && !isExpanded && (
          <span className="text-xs text-muted-foreground italic">
            ({entry.feelExpression.split('\n').length} lines)
          </span>
        )}
      </div>

      {showContent && (
        <div className="space-y-2">
          {/* English translation */}
          <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-md">
            <ConfidenceBadge confidence={translation.confidence} />
            <p className="text-sm leading-relaxed flex-1">
              {translation.english}
            </p>
          </div>

          {/* Raw FEEL (toggled) */}
          {showFeel && (
            <pre className="font-mono text-sm bg-muted/50 p-3 rounded-md overflow-x-auto whitespace-pre-wrap leading-relaxed">
              <HighlightedFeel expression={entry.feelExpression} />
            </pre>
          )}
        </div>
      )}
    </div>
  )
}

function LogicTab({ check }: { check: ParsedCheck }) {
  const [showFeel, setShowFeel] = useState(false)
  const allEntries = check.decisions.flatMap(d => d.contextEntries)

  if (allEntries.length === 0) {
    return (
      <p className="text-muted-foreground">No logic steps extracted.</p>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toggle for showing raw FEEL */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 text-green-600 bg-green-50 border border-green-200 rounded text-[10px]">✓</span>
            High confidence
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 text-yellow-600 bg-yellow-50 border border-yellow-200 rounded text-[10px]">~</span>
            Medium
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 text-orange-600 bg-orange-50 border border-orange-200 rounded text-[10px]">!</span>
            Low
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowFeel(!showFeel)}
          className="gap-2"
        >
          {showFeel ? (
            <>
              <Eye className="h-3 w-3" />
              Hide FEEL
            </>
          ) : (
            <>
              <Code className="h-3 w-3" />
              Show FEEL
            </>
          )}
        </Button>
      </div>

      {check.decisions.map((decision, dIndex) => (
        <div key={dIndex}>
          {decision.description && (
            <p className="text-sm text-muted-foreground mb-4 p-3 bg-muted/30 rounded-md">
              {decision.description}
            </p>
          )}
          <div className="space-y-4">
            {decision.contextEntries.map((entry, eIndex) => (
              <LogicStep key={eIndex} entry={entry} index={eIndex} showFeel={showFeel} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

export function CheckDetailPage() {
  const { checkId } = useParams<{ checkId: string }>()
  const { data: check, isLoading, isNotFound, error, refetch } = useCheckById(checkId)
  const { data: allChecksData } = useDmnChecks()
  const allChecks = allChecksData?.checks || []

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Back button */}
      <div className="mb-6">
        <Link to="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Catalog
          </Button>
        </Link>
      </div>

      {isLoading && <LoadingSkeleton />}
      {error && (
        <ErrorDisplay
          title="Error Loading Check"
          message={error.message}
          onRetry={() => refetch()}
        />
      )}
      {isNotFound && <NotFound checkId={checkId || ''} />}

      {check && (
        <>
          {/* Header */}
          <header className="mb-8">
            <div className="flex items-start gap-3 mb-3">
              <h1 className="text-3xl font-bold leading-tight">{check.name}</h1>
              <Badge
                variant={check.isComposite ? 'default' : 'outline'}
                className="mt-1"
              >
                {check.isComposite ? 'composite' : 'atomic'}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span className="capitalize">{check.category}</span>
              {check.citations.length > 0 && (
                <>
                  <span>•</span>
                  <span>{check.citations[0].raw}</span>
                </>
              )}
            </div>
          </header>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="logic">
                Logic
                <Badge variant="secondary" className="ml-2 text-xs">
                  {check.decisions.flatMap(d => d.contextEntries).filter(e => e.feelExpression).length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="citations">
                Citations
                {check.citations.length === 0 && (
                  <AlertCircle className="h-3 w-3 ml-2 text-yellow-600" />
                )}
              </TabsTrigger>
            </TabsList>

            <Card>
              <CardContent className="pt-6">
                <TabsContent value="overview" className="mt-0">
                  <OverviewTab check={check} allChecks={allChecks} />
                </TabsContent>
                <TabsContent value="logic" className="mt-0">
                  <LogicTab check={check} />
                </TabsContent>
                <TabsContent value="citations" className="mt-0">
                  <CitationsTab check={check} />
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>

          {/* Parse warnings */}
          {check.parseErrors.length > 0 && (
            <Card className="mt-6 border-yellow-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-yellow-700 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  Parse Warnings
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="text-sm text-yellow-600 space-y-1">
                  {check.parseErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
