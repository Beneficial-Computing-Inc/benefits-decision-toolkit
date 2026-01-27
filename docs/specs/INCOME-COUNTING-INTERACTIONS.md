# Income Counting Interactions - Implementation Spec

**Status:** Ready to Implement
**Priority:** High
**Sprint:** Current

---

## Goal

Enable the SSI income calculation to properly handle income from other benefit programs by:
1. Tracking the **source** of income (SSDI, VA pension, Section 8, etc.)
2. Applying source-specific exclusion rules per POMS
3. Extending `tEnrollment` to track current benefit receipt

---

## Data Model Changes

### 1. Clarify `tIncomeSource.category` Usage

Current `tIncomeSource` fields:
```
tIncomeSource {
  id: string
  type: string          // "earned" | "unearned"
  category: string      // REPURPOSE: benefit/income source
  monthlyAmount: number
  description: string
  isInfrequentOrIrregular: boolean
}
```

**Change:** Use `category` to specify the income source program:

| Category Value | Type | Description |
|----------------|------|-------------|
| `WAGES` | earned | Employment wages |
| `SELF_EMPLOYMENT` | earned | Self-employment income |
| `SSDI` | unearned | Social Security Disability Insurance |
| `SSI` | unearned | Supplemental Security Income |
| `VA_PENSION` | unearned | VA needs-based pension |
| `VA_DISABILITY` | unearned | VA service-connected disability comp |
| `WORKERS_COMP` | unearned | Workers' compensation |
| `RAILROAD_RETIREMENT` | unearned | Railroad Retirement benefits |
| `PRIVATE_PENSION` | unearned | Private pension/401k/IRA |
| `SECTION_8` | excluded | Section 8/HUD housing subsidy |
| `SNAP` | excluded | SNAP/food stamps (not cash) |
| `LIHEAP` | excluded | Energy assistance |
| `STATE_VET_ANNUITY` | excluded | State veteran annuity (certain states) |
| `DISASTER_RELIEF` | excluded | FEMA/disaster assistance |
| `OTHER_EARNED` | earned | Other earned income |
| `OTHER_UNEARNED` | unearned | Other unearned income |
| `OTHER_EXCLUDED` | excluded | Other excluded income |

### 2. Extend `tEnrollment`

Current:
```
tEnrollment {
  personId: string
  benefit: string
}
```

Extended (add optional fields):
```
tEnrollment {
  personId: string
  benefit: string           // e.g., "SSDI", "SSI", "SNAP", "MEDICAID"
  status: string            // "RECEIVING", "PENDING", "APPROVED", "DENIED" (optional)
  monthlyAmount: number     // Benefit amount if applicable (optional)
  startDate: date           // When benefit started (optional, for Medicare calc)
}
```

---

## New Check: `is-income-source-excluded`

**File:** `src/main/resources/checks/income/is-income-source-excluded.dmn`

**Purpose:** Determine if an income source category is excluded from SSI income counting.

**Logic:**
```feel
// Categorically excluded sources (POMS SI 00830)
category in [
  "SECTION_8",           // SI 00830.630 - Federal Housing Assistance
  "SNAP",                // Not cash income
  "LIHEAP",              // SI 00830 - Energy assistance
  "STATE_VET_ANNUITY",   // SI 00830.260 - Certain states only
  "DISASTER_RELIEF",     // SI 00830 - FEMA assistance
  "OTHER_EXCLUDED"       // Catch-all for other exclusions
]
```

**Decision Service:**
```
IsIncomeSourceExcludedService
  Input: category (string)
  Output: isExcluded (boolean)
```

---

## Modify: `calculate-countable-income.dmn`

Update the income calculation to:

1. **Filter out excluded sources** before summing earned/unearned
2. **Use category** to identify source type

**Current logic (simplified):**
```feel
totalEarnedIncome = sum(for i in incomeSources
  return if i.type = "earned" then i.monthlyAmount else 0)

totalUnearnedIncome = sum(for i in incomeSources
  return if i.type = "unearned" then i.monthlyAmount else 0)
```

**New logic:**
```feel
// Step 1: Filter to non-excluded sources
countableIncomeSources = incomeSources[
  not(category in ["SECTION_8", "SNAP", "LIHEAP", "STATE_VET_ANNUITY", "DISASTER_RELIEF", "OTHER_EXCLUDED"])
]

// Step 2: Sum earned from countable sources
totalEarnedIncome = sum(for i in countableIncomeSources
  return if i.type = "earned" then i.monthlyAmount else 0)

// Step 3: Sum unearned from countable sources
totalUnearnedIncome = sum(for i in countableIncomeSources
  return if i.type = "unearned" then i.monthlyAmount else 0)

// Step 4: Track excluded income for transparency
totalExcludedIncome = sum(for i in incomeSources
  return if category in ["SECTION_8", "SNAP", ...] then i.monthlyAmount else 0)
```

**Output addition to `tIncomeCalculation`:**
```
{
  ...existing fields...
  totalExcludedIncome: number,      // Sum of excluded sources
  excludedSources: list of strings  // Categories that were excluded
}
```

---

## New Check: `person-receiving-benefit`

**File:** `src/main/resources/checks/enrollment/person-receiving-benefit.dmn`

**Purpose:** Check if a specific person is currently receiving a specific benefit.

**Logic:**
```feel
count(situation.enrollments[
  personId = parameters.personId and
  benefit = parameters.benefit and
  (status = null or status = "RECEIVING")
]) > 0
```

**Decision Service:**
```
PersonReceivingBenefitService
  Input: situation, parameters: {personId, benefit}
  Output: checkResult (boolean)
```

---

## Test Scenarios

### Bruno Tests for Income Exclusions

**`test/bdt/checks/income/IsIncomeSourceExcluded/`**

1. `Section8-Excluded.bru` - Section 8 should be excluded
2. `SNAP-Excluded.bru` - SNAP should be excluded
3. `SSDI-Not-Excluded.bru` - SSDI should count
4. `Wages-Not-Excluded.bru` - Wages should count

### Bruno Tests for Updated Income Calculation

**`test/bdt/checks/income/CalculateCountableIncome/`**

1. `Mixed-Sources-With-Exclusions.bru`
   - Input: $800 SSDI + $200 Section 8 + $500 wages
   - Expected: Excluded = $200, Unearned = $800, Earned = $500

2. `Only-Excluded-Sources.bru`
   - Input: $200 Section 8 + $150 SNAP
   - Expected: totalCountableIncome = 0 (all excluded)

3. `SSDI-Counts-As-Unearned.bru`
   - Input: $1200 SSDI only
   - Expected: totalUnearnedIncome = $1200, counts toward limit

---

## Implementation Order

1. **Update `Enrollment.dmn`** - Add optional fields to tEnrollment
2. **Create `is-income-source-excluded.dmn`** - New check for exclusion rules
3. **Update `calculate-countable-income.dmn`** - Filter excluded sources
4. **Create `person-receiving-benefit.dmn`** - Query enrollment by benefit
5. **Write Bruno tests** - Cover all scenarios
6. **Update BDT.dmn** - If tIncomeCalculation needs new fields

---

## POMS References

| Rule | POMS Section | Description |
|------|--------------|-------------|
| Housing exclusion | SI 00830.630 | Federal housing assistance excluded |
| LIHEAP exclusion | SI 00830 | Energy assistance excluded |
| State vet annuity | SI 00830.260 | Certain state veteran annuities excluded |
| SNAP | N/A | Not cash, doesn't count |
| VA pension | SI 00830.316 | Counts as unearned income |
| SSDI | SI 00830 | Counts as unearned income |

---

## Future Considerations (Out of Scope)

- **State-specific exclusions** - STATE_VET_ANNUITY only applies in certain states
- **Partial exclusions** - Some income types have partial exclusion rules
- **In-kind income** - ISM calculations for room/board
- **Irregular income** - Averaging rules for non-monthly income

These can be added incrementally as needed.
