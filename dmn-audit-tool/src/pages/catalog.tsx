import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Search,
  FileText,
  TreeDeciduous,
  LayoutGrid,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ErrorDisplay } from '@/components/error-boundary'
import { useDmnChecksByCategory, getOrderedCategories } from '@/hooks/use-dmn-checks'
import { useDebounce } from '@/hooks/use-debounce'
import type { ParsedCheck, ChecksByCategory } from '@/lib/types'

/**
 * SSI Eligibility Tree Structure.
 * Defines the hierarchy of checks for tree view display.
 */
interface TreeNode {
  id: string
  name: string
  children?: TreeNode[]
}

const SSI_TREE: TreeNode = {
  id: 'SsiEligibility',
  name: 'SSI Eligibility',
  children: [
    {
      id: 'CategoricalEligibility',
      name: 'Categorical Eligibility',
      children: [
        { id: 'PersonAge65OrOlder', name: 'Age 65 or Older' },
        { id: 'BlindOrDisabled', name: 'Blind or Disabled' },
      ],
    },
    {
      id: 'CitizenshipEligibility',
      name: 'Citizenship Eligibility',
      children: [
        { id: 'PersonUSCitizen', name: 'U.S. Citizen' },
        { id: 'NaturalizedCitizen', name: 'Naturalized Citizen' },
        { id: 'LaprWithException', name: 'LPR with Exception' },
        { id: 'RefugeeAsyleeWithinSevenYears', name: 'Refugee/Asylee (7-year)' },
        { id: 'VietnameseAmerasian', name: 'Vietnamese Amerasian' },
        { id: 'CubanHaitianEntrant', name: 'Cuban/Haitian Entrant' },
        { id: 'ParoledAlien', name: 'Paroled Alien' },
        { id: 'WithheldDeportation', name: 'Withheld Deportation' },
      ],
    },
    {
      id: 'SsiResidenceRequirement',
      name: 'Residence Requirement',
    },
    {
      id: 'SsiResourceLimit',
      name: 'Resource Limit',
      children: [
        { id: 'CalculateCountableResources', name: 'Calculate Countable Resources' },
        { id: 'HomeExclusion', name: 'Home Exclusion' },
        { id: 'VehicleExclusion', name: 'Vehicle Exclusion' },
        { id: 'BurialFundExclusion', name: 'Burial Fund Exclusion' },
        { id: 'LifeInsuranceExclusion', name: 'Life Insurance Exclusion' },
        { id: 'HouseholdGoodsExclusion', name: 'Household Goods Exclusion' },
        { id: 'AbleAccountExclusion', name: 'ABLE Account Exclusion' },
      ],
    },
    {
      id: 'SsiIncomeLimit',
      name: 'Income Limit',
      children: [
        { id: 'CalculateCountableIncome', name: 'Calculate Countable Income' },
        { id: 'CalculateSeie', name: 'Student Earned Income Exclusion' },
        { id: 'SpouseDeeming', name: 'Spouse Income Deeming' },
        { id: 'ParentToChildDeeming', name: 'Parent-to-Child Deeming' },
      ],
    },
  ],
}

function CheckCard({ check }: { check: ParsedCheck }) {
  const shortDesc = check.description?.split('\n')[0]?.slice(0, 100) || 'No description'

  return (
    <Link to={`/check/${check.id}`} className="block">
      <Card className="h-full hover:border-primary hover:shadow-md transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-medium leading-tight">{check.name}</h3>
            <Badge
              variant={check.isComposite ? 'default' : 'secondary'}
              className="shrink-0 text-xs"
            >
              {check.isComposite ? 'composite' : 'atomic'}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {shortDesc}
          </p>
          {check.citations.length > 0 && (
            <p className="text-xs text-muted-foreground mt-2 font-mono">
              {check.citations[0].raw}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}

interface TreeNodeItemProps {
  node: TreeNode
  checks: ParsedCheck[]
  depth?: number
  defaultOpen?: boolean
}

function TreeNodeItem({ node, checks, depth = 0, defaultOpen = true }: TreeNodeItemProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen && depth < 2)
  const check = checks.find((c) => c.id === node.id)
  const hasChildren = node.children && node.children.length > 0

  const indent = depth * 16

  return (
    <div>
      <div
        className="flex items-center gap-2 py-1.5 hover:bg-muted/50 rounded px-2 -mx-2"
        style={{ paddingLeft: `${indent + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}

        {check ? (
          <Link
            to={`/check/${check.id}`}
            className="flex-1 flex items-center gap-2 text-sm hover:text-primary"
          >
            <span className={depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : ''}>
              {node.name}
            </span>
            {check.isComposite && (
              <Badge variant="outline" className="text-[10px] py-0">
                composite
              </Badge>
            )}
          </Link>
        ) : (
          <span
            className={`flex-1 text-sm text-muted-foreground ${
              depth === 0 ? 'font-semibold' : depth === 1 ? 'font-medium' : ''
            }`}
          >
            {node.name}
            <span className="text-xs ml-2">(not found)</span>
          </span>
        )}
      </div>

      {hasChildren && isOpen && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeItem
              key={child.id}
              node={child}
              checks={checks}
              depth={depth + 1}
              defaultOpen={defaultOpen}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function TreeView({ checks }: { checks: ParsedCheck[] }) {
  return (
    <div className="border rounded-lg p-4 bg-card">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b">
        <TreeDeciduous className="w-5 h-5 text-primary" />
        <h2 className="font-semibold">SSI Eligibility Rule Hierarchy</h2>
      </div>
      <TreeNodeItem node={SSI_TREE} checks={checks} defaultOpen={true} />
    </div>
  )
}

function CategorySection({
  category,
  checks,
  defaultOpen = true,
}: {
  category: string
  checks: ParsedCheck[]
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const displayName = category.charAt(0).toUpperCase() + category.slice(1)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="space-y-4">
      <CollapsibleTrigger asChild>
        <Button
          variant="ghost"
          className="w-full justify-start px-0 h-auto hover:bg-transparent group"
        >
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground group-hover:text-foreground transition-colors">
              {isOpen ? (
                <ChevronDown className="h-5 w-5" />
              ) : (
                <ChevronRight className="h-5 w-5" />
              )}
            </span>
            <h2 className="text-xl font-semibold">{displayName}</h2>
            <Badge variant="outline" className="ml-1">
              {checks.length}
            </Badge>
          </div>
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {checks.map((check) => (
            <CheckCard key={check.id} check={check} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      {[1, 2, 3].map((i) => (
        <div key={i}>
          <div className="h-7 w-32 bg-muted rounded mb-4 animate-pulse" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-28 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function NoResults({ searchTerm }: { searchTerm: string }) {
  return (
    <div className="text-center py-12">
      <p className="text-muted-foreground">
        No checks found matching "<span className="font-medium">{searchTerm}</span>"
      </p>
    </div>
  )
}

function filterChecks(checks: ParsedCheck[], searchTerm: string): ParsedCheck[] {
  if (!searchTerm.trim()) return checks

  const term = searchTerm.toLowerCase()
  return checks.filter(
    (check) =>
      check.name.toLowerCase().includes(term) ||
      check.category.toLowerCase().includes(term) ||
      check.id.toLowerCase().includes(term) ||
      check.description.toLowerCase().includes(term)
  )
}

function groupFilteredChecks(filteredChecks: ParsedCheck[]): ChecksByCategory {
  const grouped: ChecksByCategory = {}
  for (const check of filteredChecks) {
    if (!grouped[check.category]) {
      grouped[check.category] = []
    }
    grouped[check.category].push(check)
  }
  return grouped
}

export function CatalogPage() {
  const { data, isLoading, error, refetch } = useDmnChecksByCategory()
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState<'tree' | 'grid'>('tree')
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { filteredChecks, filteredByCategory } = useMemo(() => {
    if (!data) return { filteredChecks: [], filteredByCategory: {} }
    const filtered = filterChecks(data.checks, debouncedSearch)
    return {
      filteredChecks: filtered,
      filteredByCategory: groupFilteredChecks(filtered),
    }
  }, [data, debouncedSearch])

  const totalChecks = data?.checks.length ?? 0
  const displayedChecks = filteredChecks.length
  const hasSearch = debouncedSearch.trim().length > 0

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold mb-1">SSI Eligibility Rules</h1>
            <p className="text-muted-foreground">
              Browse and audit SSI eligibility decision logic
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/screener/accessible">
              <Button variant="outline" className="gap-2">
                <FileText className="w-4 h-4" />
                Quick Screener
              </Button>
            </Link>
            <Link to="/screener">
              <Button className="gap-2">
                <FileText className="w-4 h-4" />
                Full Screener
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Search & View Toggle */}
      <div className="mb-6 flex items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search rules by name, category, or description..."
            className="pl-10"
            disabled={isLoading}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex border rounded-md">
          <Button
            variant={viewMode === 'tree' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2 rounded-r-none"
            onClick={() => setViewMode('tree')}
          >
            <TreeDeciduous className="w-4 h-4" />
            Hierarchy
          </Button>
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            className="gap-2 rounded-l-none"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="w-4 h-4" />
            All Rules
          </Button>
        </div>
      </div>

      {data && !hasSearch && (
        <p className="text-sm text-muted-foreground mb-4">{totalChecks} rules encoded</p>
      )}
      {data && hasSearch && (
        <p className="text-sm text-muted-foreground mb-4">
          {displayedChecks} of {totalChecks} rules
        </p>
      )}

      {/* Content */}
      {isLoading && <LoadingSkeleton />}
      {error && (
        <ErrorDisplay
          title="Error Loading Rules"
          message={`${error.message}. Make sure to run 'npm run sync-dmn' to copy DMN files.`}
          onRetry={() => refetch()}
        />
      )}

      {data && (
        <>
          {/* Parse warnings (collapsed by default) */}
          {data.errors.length > 0 && (
            <details className="mb-6">
              <summary className="text-sm text-yellow-600 cursor-pointer hover:underline">
                {data.errors.length} file(s) failed to parse
              </summary>
              <ul className="mt-2 text-xs text-muted-foreground space-y-1 pl-4">
                {data.errors.map((err) => (
                  <li key={err.filePath}>{err.filePath}</li>
                ))}
              </ul>
            </details>
          )}

          {hasSearch && displayedChecks === 0 ? (
            <NoResults searchTerm={debouncedSearch} />
          ) : viewMode === 'tree' && !hasSearch ? (
            <TreeView checks={data.checks} />
          ) : (
            <div className="space-y-8">
              {getOrderedCategories(filteredByCategory).map((category) => (
                <CategorySection
                  key={category}
                  category={category}
                  checks={filteredByCategory[category]}
                  defaultOpen={true}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
