# Income Interactions - Implementation Tickets [ARCHIVED]

**Epic:** Benefits Program Interactions
**Spec:** `docs/specs/INCOME-INTERACTIONS-SPEC.md`
**Created:** 2026-01-26
**Completed:** 2026-01-27
**Status:** ALL COMPLETE

---

## Ticket Overview

| ID | Title | Type | Size | Dependencies | Status |
|----|-------|------|------|--------------|--------|
| INC-1 | Extend tEnrollment type definition | Chore | S | None | DONE |
| INC-2 | Create benefit-is-excluded-from-ssi-income check | Feature | S | INC-1 | DONE |
| INC-3 | Create derive-income-from-enrollments BKM | Feature | M | INC-1, INC-2 | DONE |
| INC-4 | Update calculate-countable-income to use enrollment-derived income | Feature | M | INC-3 | DONE |
| INC-5 | Add Bruno tests for income exclusion scenarios | Chore | M | INC-4 | DONE |
| INC-6 | Update screener form schema for benefits section | Feature | M | INC-1 | DONE |

**Critical Path:** INC-1 → INC-2 → INC-3 → INC-4 → INC-5

## Completion Notes

All tickets completed 2026-01-27. Key implementation details:

- **INC-1**: Added `status`, `monthlyAmount`, `startDate` fields to tEnrollment in Enrollment.dmn
- **INC-2**: Created benefit exclusion check, later inlined into BKM due to Kogito limitation (BKMs cannot call Decision Services from imported models)
- **INC-3**: Created "derive income from enrollments" BKM in Income.dmn with excludedBenefits list for explainability
- **INC-4**: Updated calculate-countable-income.dmn to incorporate enrollment-derived income
- **INC-5**: Tests verified manually via curl (Bruno CLI had unrelated issues)
- **INC-6**: Added "Current Benefits" section to screener form schema, removed VA-specific fields, maps to enrollments[] in transform.ts

---

## Tickets

---

### [CHORE] INC-1: Extend tEnrollment Type Definition

**Type:** Chore
**Priority:** P1
**Size:** S (1-2 days)
**Dependencies:** None

#### Summary

Extend the `tEnrollment` type in `Enrollment.dmn` to include optional fields for benefit amount, status, and start date. This enables tracking benefit receipt for income calculations and future referral features.

#### Context

Currently `tEnrollment` only has `personId` and `benefit` strings. To calculate income from benefits and support future features (Medicare timing from SSDI), we need richer enrollment data.

#### Requirements

- [ ] Add `status` field (string, optional): "RECEIVING", "PENDING", "APPROVED", "DENIED"
- [ ] Add `monthlyAmount` field (number, optional): benefit amount in dollars
- [ ] Add `startDate` field (date, optional): when benefit started
- [ ] Ensure backward compatibility - existing enrollments without new fields still work
- [ ] Update type documentation with POMS references

#### Acceptance Criteria

**Given:** An enrollment with only `personId` and `benefit`
**When:** DMN evaluates with this enrollment
**Then:** No errors, missing fields treated as null

**Given:** An enrollment with all new fields populated
**When:** DMN evaluates
**Then:** All field values accessible in FEEL expressions

#### Technical Notes

- Add `dmn:itemComponent` elements to `tEnrollment` in `Enrollment.dmn`
- Use `isCollection="false"` for all new fields
- Follow BDT naming patterns (camelCase for field names)

#### Files to Create/Modify

- `checks/enrollment/Enrollment.dmn` — Add new itemComponents to tEnrollment

#### Definition of Done

- [ ] tEnrollment type has new optional fields
- [ ] Existing enrollment checks still pass
- [ ] Quarkus dev mode starts without errors

---

### [FEATURE] INC-2: Create benefit-is-excluded-from-ssi-income Check

**Type:** Feature
**Priority:** P1
**Size:** S (1-2 days)
**Dependencies:** INC-1

#### Summary

Create a DMN check that determines whether a given benefit type is excluded from SSI income counting, with POMS citation for explainability.

#### User Story

As a caseworker using the screener,
I want to see which benefits are excluded from income,
so that I can explain eligibility determinations to claimants.

#### Context

Per POMS SI 00830, certain benefits are explicitly excluded from SSI income (Section 8, SNAP, LIHEAP). This check centralizes that logic and provides explainability.

#### Requirements

- [ ] Input: `benefitType` (string) - the benefit code from taxonomy
- [ ] Output: `isExcluded` (boolean)
- [ ] Output: `exclusionReason` (string, optional) - POMS citation and explanation
- [ ] Cover all benefit types in taxonomy (see spec)
- [ ] Return `false` for unknown benefit types (conservative - count it)

#### Acceptance Criteria

**Scenario: Section 8 is excluded**
**Given:** benefitType = "SECTION_8"
**When:** Check evaluates
**Then:** isExcluded = true, exclusionReason = "Federal housing assistance excluded per POMS SI 00830.630"

**Scenario: SSDI is NOT excluded**
**Given:** benefitType = "SSDI"
**When:** Check evaluates
**Then:** isExcluded = false, exclusionReason = null

**Scenario: Unknown benefit type**
**Given:** benefitType = "UNKNOWN_BENEFIT"
**When:** Check evaluates
**Then:** isExcluded = false (conservative default)

#### Technical Notes

- Use decision table for clean mapping of benefit types to exclusion status
- Include descriptions with POMS citations for each excluded type
- Decision Service: `BenefitIsExcludedFromSsiIncomeService`

#### Files to Create/Modify

- `checks/income/benefit-is-excluded-from-ssi-income.dmn` — New check

#### Testing Notes

- [ ] Bruno test for each excluded benefit type
- [ ] Bruno test for each counted benefit type
- [ ] Bruno test for unknown type

#### Definition of Done

- [ ] Check returns correct exclusion status for all taxonomy types
- [ ] Exclusion reasons include POMS citations
- [ ] Bruno tests pass

---

### [FEATURE] INC-3: Create derive-income-from-enrollments BKM

**Type:** Feature
**Priority:** P1
**Size:** M (2-3 days)
**Dependencies:** INC-1, INC-2

#### Summary

Create a Business Knowledge Model (BKM) that reads a person's enrollments and derives their benefit-related income, separating counted vs. excluded amounts.

#### User Story

As a DMN author,
I want a reusable function to extract income from enrollments,
so that income calculations can incorporate benefit receipt.

#### Context

Benefits in `enrollments[]` need to be converted to income amounts for the income calculation. This BKM encapsulates that logic so it's reusable and testable.

#### Requirements

- [ ] Input: `enrollments` (tEnrollmentList), `personId` (string)
- [ ] Filter enrollments to given person with status "RECEIVING" or null
- [ ] For each enrollment with `monthlyAmount`:
  - Call INC-2 to check if excluded
  - If not excluded, add to countable income
  - If excluded, add to excluded income
- [ ] Output context:
  ```
  {
    countableUnearnedFromBenefits: number,
    excludedIncomeFromBenefits: number,
    excludedBenefits: list of strings (benefit codes)
  }
  ```

#### Acceptance Criteria

**Scenario: Single counted benefit**
**Given:** Enrollments with SSDI $1000
**When:** BKM evaluates for that person
**Then:** countableUnearnedFromBenefits = 1000, excludedIncomeFromBenefits = 0

**Scenario: Single excluded benefit**
**Given:** Enrollments with SECTION_8 $800
**When:** BKM evaluates
**Then:** countableUnearnedFromBenefits = 0, excludedIncomeFromBenefits = 800, excludedBenefits = ["SECTION_8"]

**Scenario: Mixed benefits**
**Given:** Enrollments with SSDI $900, VA_PENSION $400, SNAP (no amount)
**When:** BKM evaluates
**Then:** countableUnearnedFromBenefits = 1300, excludedBenefits = ["SNAP"]

**Scenario: No enrollments**
**Given:** Empty enrollments array
**When:** BKM evaluates
**Then:** All values = 0, excludedBenefits = []

#### Technical Notes

- Create as BKM so it can be invoked from income calculation
- Use `for` loop in FEEL to iterate enrollments
- Import benefit-is-excluded-from-ssi-income check

#### Files to Create/Modify

- `checks/income/Income.dmn` — Add BKM (or create new base module)
- OR create `checks/income/derive-income-from-enrollments.dmn`

#### Definition of Done

- [ ] BKM correctly derives income from enrollments
- [ ] Handles null/empty enrollments gracefully
- [ ] Unit tested via Bruno

---

### [FEATURE] INC-4: Update calculate-countable-income to Use Enrollment-Derived Income

**Type:** Feature
**Priority:** P1
**Size:** M (2-3 days)
**Dependencies:** INC-3

#### Summary

Modify the existing income calculation to incorporate benefit-derived income from enrollments, and add excluded income to the output for transparency.

#### User Story

As a screener user,
I want my benefit income automatically included in the calculation,
so that I don't have to enter it twice (in benefits AND income).

#### Context

Currently income calculation only reads `incomeSources[]`. With benefits captured in `enrollments[]`, we need to merge that into the calculation.

#### Requirements

- [ ] Import and call derive-income-from-enrollments BKM
- [ ] Add enrollment-derived unearned income to `totalUnearnedIncome`
- [ ] Extend output to include:
  - `excludedIncomeFromBenefits` (number)
  - `excludedBenefits` (list of strings)
- [ ] Preserve all existing calculation logic (exclusions, deeming, SEIE)
- [ ] Maintain backward compatibility when enrollments is empty/null

#### Acceptance Criteria

**Scenario: Income from enrollments added**
**Given:** Person has SSDI enrollment ($1000) and wages in incomeSources ($500)
**When:** Income calculation runs
**Then:** totalUnearnedIncome includes $1000 from SSDI

**Scenario: Excluded income shown in output**
**Given:** Person has Section 8 enrollment ($800)
**When:** Income calculation runs
**Then:** Output shows excludedIncomeFromBenefits = 800, excludedBenefits = ["SECTION_8"]

**Scenario: Backward compatibility**
**Given:** Situation with no enrollments, only incomeSources
**When:** Income calculation runs
**Then:** Same result as before (no regression)

#### Technical Notes

- Call BKM early in calculation, before applying exclusions
- Add enrollment-derived amount to totalUnearnedIncome variable
- New output fields added to tIncomeCalculation type in BDT.dmn

#### Files to Create/Modify

- `checks/income/calculate-countable-income.dmn` — Integrate enrollment income
- `BDT.dmn` — Add fields to tIncomeCalculation type

#### Testing Notes

- [ ] Existing Bruno tests must still pass (backward compat)
- [ ] New tests for enrollment-derived income
- [ ] Test with mixed enrollments + incomeSources

#### Definition of Done

- [ ] Enrollment income correctly added to calculation
- [ ] Excluded income visible in output
- [ ] All existing tests pass
- [ ] New scenarios tested

---

### [CHORE] INC-5: Add Bruno Tests for Income Exclusion Scenarios

**Type:** Chore
**Priority:** P1
**Size:** M (2-3 days)
**Dependencies:** INC-4

#### Summary

Create comprehensive Bruno test suite covering all benefit types, exclusion scenarios, and edge cases for the income interactions feature.

#### Requirements

- [ ] Test each excluded benefit type (SECTION_8, SNAP, LIHEAP, WIC, SCHOOL_LUNCH)
- [ ] Test each counted benefit type (SSDI, VA_PENSION, VA_DISABILITY_COMP, etc.)
- [ ] Test mixed scenarios (multiple benefits, benefits + wages)
- [ ] Test edge cases (null amounts, missing status, empty enrollments)
- [ ] Organize tests in logical folder structure

#### Test Scenarios to Cover

```
test/bdt/checks/income/
├── BenefitIsExcludedFromSsiIncome/
│   ├── SECTION_8-Excluded.bru
│   ├── SNAP-Excluded.bru
│   ├── SSDI-NotExcluded.bru
│   ├── VA_PENSION-NotExcluded.bru
│   └── Unknown-DefaultsToNotExcluded.bru
├── DeriveIncomeFromEnrollments/
│   ├── SingleCountedBenefit.bru
│   ├── SingleExcludedBenefit.bru
│   ├── MixedBenefits.bru
│   └── EmptyEnrollments.bru
└── CalculateCountableIncome/
    ├── EnrollmentPlusSources.bru
    ├── OnlyEnrollments.bru
    ├── OnlyIncomeSources.bru (existing, verify still works)
    └── ExcludedIncomeInOutput.bru
```

#### Acceptance Criteria

**Given:** All Bruno tests in suite
**When:** `bru run` executed
**Then:** All tests pass

#### Definition of Done

- [ ] All test files created
- [ ] Tests follow BDT Bruno patterns
- [ ] `bru run` passes for all new tests
- [ ] No regression in existing tests

---

### [FEATURE] INC-6: Update Screener Form Schema for Benefits Section

**Type:** Feature
**Priority:** P2
**Size:** M (2-3 days)
**Dependencies:** INC-1

#### Summary

Add a Benefits section to the SSI screener form that captures current benefit receipt, separate from the Income section. This enables the DMN rules to derive income from benefits.

#### User Story

As a screener user,
I want to enter what benefits I receive in one place,
so that the system can correctly calculate my income without double-entry.

#### Context

Per design decision, benefits are captured in `enrollments[]` not `incomeSources[]`. The screener needs a dedicated section to collect this data with good UX (explanatory text about why we're asking and how it affects eligibility).

#### Requirements

- [ ] Add collapsible "Current Benefits" section to form schema
- [ ] Include multi-select or checkbox list of common benefits
- [ ] For cash benefits, show amount field when selected
- [ ] Include explanatory text: "Benefits you receive may count as income for SSI"
- [ ] Map form data to `enrollments[]` in situation transform
- [ ] Group benefits by type (Cash benefits, Non-cash assistance, Healthcare)

#### Acceptance Criteria

**Scenario: User selects SSDI**
**Given:** User is in Benefits section
**When:** User checks "SSDI" and enters $1000
**Then:** Form shows amount field, validation ensures positive number

**Scenario: User selects SNAP**
**Given:** User is in Benefits section
**When:** User checks "SNAP"
**Then:** No amount field shown (non-cash benefit)

**Scenario: Form submission**
**Given:** User selected SSDI $1000 and SNAP
**When:** Form submits
**Then:** Situation includes enrollments array with both benefits

#### Technical Notes

- Follow existing section patterns in `ssi-form-schema.ts`
- Add benefit type constants matching DMN taxonomy
- Consider conditional display for amount fields

#### Files to Create/Modify

- `dmn-audit-tool/src/lib/screener/ssi-form-schema.ts` — Add Benefits section
- `dmn-audit-tool/src/lib/screener/transform.ts` — Map to enrollments
- `dmn-audit-tool/src/lib/screener/types.ts` — Update types if needed

#### Out of Scope

- Healthcare benefits (Medicaid, Medicare) - add later when referrals feature built
- Detailed benefit history - just current receipt

#### Definition of Done

- [ ] Benefits section appears in screener
- [ ] Cash benefits show amount fields
- [ ] Form data correctly maps to enrollments
- [ ] UX includes helpful explanatory text

---

## Dependency Graph

```
INC-1 (tEnrollment)
   │
   ├──▶ INC-2 (Exclusion check)
   │       │
   │       └──▶ INC-3 (Derive income BKM)
   │               │
   │               └──▶ INC-4 (Update calculation)
   │                       │
   │                       └──▶ INC-5 (Bruno tests)
   │
   └──▶ INC-6 (Screener form) [can parallel with INC-2-4]
```

---

## Sprint Planning Notes

**Recommended Sprint 1 (DMN Core):**
- INC-1, INC-2, INC-3, INC-4, INC-5

**Recommended Sprint 2 (Screener):**
- INC-6

Or, if capacity allows, INC-6 can be worked in parallel with INC-3/4 since it only depends on INC-1.
