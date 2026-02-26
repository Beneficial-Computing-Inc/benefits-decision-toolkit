# SSDI Eligibility Screener - Implementation Progress

## Overview

Implementing an SSDI (Social Security Disability Insurance) eligibility screener following POMS DI 10105.000 and related policy sections.

**Current Status**: ✅ PHASE 2 COMPLETE - SSDI benefit composed from 4 core checks (bug fix applied 2026-01-19)

**Data Availability**: POMS DI section pages available with good content quality. RS (insured status) pages not needed - work credits can be simplified to age-based questions for screener purposes.

---

## SSDI Eligibility Requirements Summary

Unlike SSI (needs-based), SSDI is an **insurance program** requiring both disability AND sufficient work history. Core requirements:

| Requirement | POMS Reference | Complexity | Notes |
|-------------|----------------|------------|-------|
| 1. Disability | DI 10105.065 | High | Same definition as SSI disability |
| 2. Work Credits (Insured Status) | DI 10105.060, RS 00301.120 | Medium | Simplified to age-based questions |
| 3. Not at Full Retirement Age | DI 10105.060 | Low | Age check against FRA |
| 4. Not Performing SGA | DI 10501.015 | Low | Current earnings vs SGA threshold |
| 5. Waiting Period | DI 10105.070 | Low | 5 months (affects benefit start, not eligibility) |

---

## Implementation Status

### ✅ IMPLEMENTED

#### 2. Work Credits / Insured Status (POMS DI 10105.060, RS 00301.120)
- **Status**: ✅ Implemented
- **Location**: `library-api/src/main/resources/checks/ssdi/work-credits/has-sufficient-work-credits.dmn`
- **Decision Service**: `HasSufficientWorkCreditsService`
- **Logic** (per RS 00301.120 and RS 00301.140):
  - Blind persons: Only need "fully insured" status (ever worked) - `blind_fully_insured` rule
  - Under age 24: Need ~1.5 years (6 QCs in 12 quarters) - `under_24` rule
  - Ages 24-30: Need (age - 21) / 2 years - `age_24_to_30` rule
  - Ages 31+: Need 5 years in last 10 years (20/40 test) - `age_31_plus` rule
- **Inputs**: `situation` (tSituation), `parameters` (optional personId)
- **Outputs**: `checkResult` (boolean) - calculation details encapsulated within decision context
- **Tests**: `test/bdt/checks/ssdi/work-credits/HasSufficientWorkCredits/`
  - Pass - Age 35 with 6 years (needs 5, has 6)
  - Fail - Age 35 with 3 years (needs 5, has 3)
  - Pass - Age 22 young worker (needs 1.5, has 2)
  - Pass - Blind only needs ever worked (blind_fully_insured rule)
  - Pass - Age 27 mid-range (needs 3 = (27-21)/2, has 4)
  - Fail - Never worked (no work history)
- **Data Model Changes**:
  - Added `hasWorkedAndPaidSSTaxes: boolean` to tPerson (POMS DI 10105.060)
  - Added `yearsWorkedInLast10Years: number` to tPerson (RS 00301.120)

#### 3. Not at Full Retirement Age (POMS DI 10105.060, DI 10105.080)
- **Status**: ✅ Implemented
- **Location**: `library-api/src/main/resources/checks/ssdi/age/not-at-full-retirement-age.dmn`
- **Decision Service**: `NotAtFullRetirementAgeService`
- **Logic** (FRA varies by birth year):
  - Born 1937 or earlier: FRA = 65
  - Born 1938-1942: FRA = 65 + 2-10 months
  - Born 1943-1954: FRA = 66
  - Born 1955-1959: FRA = 66 + 2-10 months
  - Born 1960 or later: FRA = 67
- **Inputs**: `situation` (tSituation), `parameters` (optional personId)
- **Outputs**: `checkResult` (boolean) - FRA calculation details encapsulated within decision context
- **Tests**: `test/bdt/checks/ssdi/age/NotAtFullRetirementAge/`
  - Pass - Age 50 (well under any FRA)
  - Pass - Age 65 born 1960 (FRA = 67, not yet attained)
  - Fail - Age 67 at FRA born 1958
  - Fail - Age 66 born 1950 (at FRA of 66)
  - Edge - Age 66 born 1957 (FRA = 66.5)
  - Fail - No DOB (cannot determine)

#### 4. Not Performing SGA (POMS DI 10501.015)
- **Status**: ✅ Implemented
- **Location**: `library-api/src/main/resources/checks/sga/not-performing-sga.dmn`
- **Decision Service**: `NotPerformingSgaService`
- **Logic**:
  - Sums earned income from `person.incomeSources[type="earned"]`
  - Compares to SGA threshold based on blind status
  - 2025 thresholds: Non-blind $1,620/month, Blind $2,700/month
  - Returns TRUE if earnings ≤ threshold (not performing SGA = eligible)
- **Inputs**: `situation` (tSituation), `parameters` (optional personId)
- **Outputs**: `checkResult` (boolean) - SGA calculation details encapsulated within decision context
- **Tests**: `test/bdt/checks/sga/NotPerformingSga/`
  - Pass - Below SGA Non-Blind ($1,500)
  - Fail - Above SGA Non-Blind ($2,000)
  - Pass - Below SGA Blind Higher Threshold ($2,500)
  - Pass - No Earned Income
  - Edge Case - At Exactly SGA Threshold ($1,620)
- **Data Model Changes**:
  - Added `isBlind: boolean` to tPerson (POMS DI 10501.015)
  - Added `isDisabled: boolean` to tPerson (POMS DI 10105.065)
  - `isBlindOrDisabled` deprecated - use `isBlind` and `isDisabled` separately

#### 1. Disability Self-Report (POMS DI 10105.065)
- **Status**: ✅ Implemented (duration check added 2026-02-16)
- **Location**: `library-api/src/main/resources/checks/ssdi/disability/reports-disabling-condition.dmn`
- **Decision Service**: `ReportsDisablingConditionService`
- **Logic**:
  - Returns true if `isBlind = true` OR (`isDisabled = true` AND meets duration requirement)
  - Duration requirement (POMS DI 10501.015): disability must last 12+ months or result in death
  - Blind has NO duration requirement
  - When `expectedDisabilityDuration` is null: defaults to pass (backwards compatible)
  - For screener purposes, this is self-reported disability
  - SSA will make the actual medical determination
- **Inputs**: `situation` (tSituation), `parameters` (optional personId)
- **Outputs**: `checkResult` (boolean) - disability info encapsulated within decision context
- **Tests**: `test/bdt/checks/ssdi/disability/ReportsDisablingCondition/`
  - Pass - isDisabled true
  - Pass - isBlind true
  - Pass - Both disabled and blind
  - Fail - Not disabled (isDisabled=false)
  - Fail - No disability info provided
  - Fail - Disabled But Under 12 Months (added 2026-02-16)

---

### 🚧 NOT YET IMPLEMENTED

#### 5. Waiting Period (POMS DI 10105.070)
- **Status**: 🚧 Not Started
- **Planned Location**: `library-api/src/main/resources/checks/waiting-period/`
- **Logic**:
  - 5 full calendar months from disability onset
  - Affects when benefits START, not basic eligibility
  - Exception: Prior DIB entitlement within 5 years (no new waiting period)
  - Exception: Statutory blindness in freeze status
- **Form Fields**:
  - `disabilityOnsetDate` (date)
  - `hadPriorDIBWithin5Years` (yes/no)
- **Notes**: Primarily informational for screener - tells user when benefits would begin

---

## Proposed Architecture

### DMN Files
```
library-api/src/main/resources/
├── checks/
│   ├── sga/
│   │   └── not-performing-sga.dmn            # ✅ Current earnings check (DONE)
│   ├── ssdi/
│   │   ├── work-credits/
│   │   │   └── has-sufficient-work-credits.dmn  # ✅ Age-based work credits (DONE)
│   │   ├── age/
│   │   │   └── not-at-full-retirement-age.dmn   # ✅ FRA check (DONE)
│   │   └── disability/
│   │       └── reports-disabling-condition.dmn  # ✅ Self-reported disability + duration check (DONE)
│   └── waiting-period/
│       └── calculate-waiting-period.dmn      # When benefits would start (planned)
└── benefits/
    └── federal/
        └── ssdi-eligibility.dmn              # ✅ Main SSDI benefit check (DONE)
```

### Data Model Extensions

**Added to tPerson in BDT.dmn**:
```
✅ isBlind: boolean                    # POMS DI 10501.015 - For SGA threshold selection
✅ isDisabled: boolean                 # POMS DI 10105.065 - Disability status separate from blindness
✅ hasWorkedAndPaidSSTaxes: boolean    # POMS DI 10105.060 - Work credits check
✅ yearsWorkedInLast10Years: number    # RS 00301.120 - Recent work credits approximation
```

**Still needed for tPerson**:
```
- hadPriorDIBWithin5Years: boolean     # Waiting period exception
- disabilityOnsetDate: date            # Waiting period calculation
```

**Note**: `isBlindOrDisabled` deprecated - use `isBlind` and `isDisabled` separately for clarity. SSI checks should be updated to use `isBlind or isDisabled`.

---

## SSDI vs SSI Comparison

| Aspect | SSI | SSDI |
|--------|-----|------|
| **Type** | Needs-based (welfare) | Insurance (earned benefit) |
| **Funding** | General tax revenue | Social Security trust fund |
| **Work History** | Not required | Required (work credits) |
| **Income/Resource Limits** | Yes ($967 FBR, $2,000 resources) | No means test |
| **Disability Definition** | Same | Same |
| **Waiting Period** | None | 5 months |
| **Medicare** | Medicaid (immediate) | Medicare (after 24 months) |

**Shared Components** (reusable from SSI):
- Disability definition logic (same standard)
- Age calculation BKMs
- Blind status handling

---

## Implementation Order (Recommended)

### Phase 1: Core Eligibility (MVP)
1. **SGA Check** - Simple earnings threshold comparison
2. **Work Credits** - Age-based work history questions
3. **Age Check** - Not at FRA
4. **Disability Self-Report** - Basic yes/no with duration

### Phase 2: Benefit Composition
5. **SSDI Eligibility DMN** - Combine all checks
6. **Waiting Period Calculator** - When benefits would start
7. **Bruno Tests** - Comprehensive test coverage

### Phase 3: Enhancements (Future)
- Blind-specific rules (different SGA, no 20/40 test)
- Trial Work Period (TWP) tracking
- Extended Period of Eligibility (EPE)
- Expedited Reinstatement (EXR)

### Phase 4: Auxiliary Benefits (Future)
- **CDB** (Childhood Disability Benefits) - DI 10115.025
- **DWB** (Disabled Widow/Widower Benefits) - separate eligibility rules

---

## Key POMS Pages (Available in API)

### High-Quality Content (Verified)
| Page ID | Title | Content Quality |
|---------|-------|-----------------|
| DI 10105.060 | DIB Entitlement Requirements | ✅ Excellent |
| DI 10105.065 | Disability Definition | ✅ Excellent |
| DI 10105.070 | Waiting Period | ✅ Excellent |
| DI 10501.015 | SGA Thresholds | ✅ Excellent (full tables) |
| DI 00115.001 | Disability Programs Overview | ✅ Good |
| DI 34132.013 | Mental Disorder Listings | ✅ Excellent |

### Cross-References (Not in POMS_SSDI corpus)
| Page ID | Title | Status |
|---------|-------|--------|
| RS 00301.120 | DIB Insured Status | ❌ Not available (but not needed - simplified) |
| RS 00301.140 | Young Worker Rules | ❌ Not available (but not needed - simplified) |

---

## Testing Strategy

### Unit Tests (Bruno)
- Individual check tests in `test/bdt/checks/`
- Benefit composition tests in `test/bdt/benefits/federal/`

### Test Scenarios (Planned)
| Scenario | Expected Result |
|----------|-----------------|
| Age 35, worked 6 of last 10 years, not working, has disability | Eligible |
| Age 35, worked 2 of last 10 years, not working, has disability | Ineligible (insufficient work credits) |
| Age 22, worked 2 years, not working, has disability | Eligible (young worker rule) |
| Age 50, worked 10 years, earning $2,000/month | Ineligible (over SGA) |
| Age 68 (past FRA), worked 20 years, has disability | Ineligible (at FRA - retirement instead) |
| Blind, age 40, earning $2,500/month | Eligible (under blind SGA threshold) |

---

## Resources

- **POMS DI Section**: https://secure.ssa.gov/poms.nsf/lnx/04
- **SGA Amounts**: https://www.ssa.gov/oact/cola/sga.html
- **Full Retirement Age**: https://www.ssa.gov/benefits/retirement/planner/agereduction.html
- **DMN Specification**: https://www.omg.org/spec/DMN/

---

## Change Log

### 2026-01-19: Critical Bug Fix - Decision Service Pattern Restructure
- 🐛 **Fixed**: All 4 SSDI checks were returning `checkResult: null` and SSDI eligibility returned `isEligible: null`
- **Root Cause**: SSDI check decision services used multi-decision pattern with `encapsulatedDecision` elements, which didn't match the working single-decision pattern used by other checks
- **Solution**: Restructured all 4 SSDI check DMN files to follow the `PersonMinAgeService` pattern:
  - Single `outputDecision` pointing to `checkResult` decision (no `encapsulatedDecision`)
  - All calculation logic consolidated into a context within the `checkResult` decision itself
  - Added null-safety checks for when person data is missing
- **Files Modified**:
  - `checks/ssdi/disability/reports-disabling-condition.dmn`
  - `checks/ssdi/work-credits/has-sufficient-work-credits.dmn`
  - `checks/ssdi/age/not-at-full-retirement-age.dmn`
  - `checks/sga/not-performing-sga.dmn`
- **Verification**: All SSDI endpoints now return proper boolean results:
  - `curl /api/v1/benefits/federal/ssdi-eligibility` → `isEligible: true/false`
  - Individual checks all return `checkResult: true/false`
- **Lesson Learned**: DMN decision services with `typeRef="BDT.tCheckResponse"` must have exactly ONE `outputDecision` (the `checkResult` decision) for boolean type coercion to work. Multiple outputs or `encapsulatedDecision` prevent this coercion and return null.

### 2026-01-15: SSDI Benefit Composition (Phase 2 Complete!)
- ✅ Implemented `SsdiEligibilityService` in `benefits/federal/ssdi-eligibility.dmn`
- ✅ Created 7 Bruno tests covering pass/fail scenarios for all 4 checks
  - Pass: All checks met, blind higher SGA threshold, young worker
  - Fail: Not disabled, insufficient work credits, at FRA, performing SGA
- Composes all 4 core checks into single eligibility decision
- Returns detailed check results plus overall `isEligible` boolean
- **PHASE 2 COMPLETE**: SSDI screener is now functional end-to-end

### 2026-01-15: Disability Self-Report Check Implementation (Phase 1 Complete!)
- ✅ Implemented `ReportsDisablingConditionService` in `checks/ssdi/disability/reports-disabling-condition.dmn`
- ✅ Created 5 Bruno tests for disability self-report scenarios
- POMS research: DI 10105.065 (disability definition)
- Simple boolean check: `isDisabled OR isBlind`
- **PHASE 1 COMPLETE**: All 4 core checks implemented (SGA, Work Credits, FRA, Disability)

### 2026-01-15: Full Retirement Age Check Implementation
- ✅ Implemented `NotAtFullRetirementAgeService` in `checks/ssdi/age/not-at-full-retirement-age.dmn`
- ✅ Created 6 Bruno tests covering various age/birth year scenarios
- POMS research: DI 10105.060 (DIB requirements), DI 10105.080 (age requirement)
- FRA calculation based on birth year (65 to 67 depending on year)
- Namespaced under `checks/ssdi/age/` for SSDI-specific checks

### 2026-01-15: Work Credits Check Implementation
- ✅ Implemented `HasSufficientWorkCreditsService` in `checks/ssdi/work-credits/has-sufficient-work-credits.dmn`
- ✅ Added `hasWorkedAndPaidSSTaxes` and `yearsWorkedInLast10Years` fields to tPerson in BDT.dmn
- ✅ Created 6 Bruno tests covering age-based rules, blind exception, and edge cases
- POMS research: RS 00301.120 (20/40 test), RS 00301.140 (young worker rules)
- Namespaced under `checks/ssdi/` to distinguish from shared checks

### 2026-01-15: SGA Check Implementation
- ✅ Implemented `NotPerformingSgaService` in `checks/sga/not-performing-sga.dmn`
- ✅ Added `isBlind` and `isDisabled` fields to tPerson in BDT.dmn
- ✅ Created 5 Bruno tests covering non-blind, blind, no income, and edge cases
- POMS research: DI 10501.015 (SGA thresholds), DI 10105.065 (disability definition)
- Reuses existing `incomeSources` data structure - no new income fields needed

### 2026-01-15: Initial Document Creation
- Created SSDI implementation progress document
- Completed POMS data quality evaluation
- Documented simplified work credits approach (age-based questions vs full QC calculation)
- Mapped available POMS pages and identified gaps
- Outlined implementation phases and architecture

---

**Last Updated**: 2026-02-16
**Current Sprint**: Phase 2 COMPLETE - SSDI screener functional (duration check added 2026-02-16)
**Next Steps**: Phase 3 - Enhancements (waiting period, TWP, etc.) or integration

---

### 2026-02-16: Disability Duration Requirement (DMN-001)
- ✅ Added duration validation to `reports-disabling-condition.dmn`: `isBlind OR (isDisabled AND meetsDurationRequirement)`
- ✅ `meetsDurationRequirement`: null→true (backwards compat), `12_MONTHS_OR_MORE`→true, `EXPECTED_TO_RESULT_IN_DEATH`→true, `LESS_THAN_12_MONTHS`→false
- ✅ Blind has NO duration requirement per POMS DI 10501.015
- ✅ Created standalone `checks/disability/disability-duration-requirement.dmn` for direct API testing
- ✅ Added Bruno test: `Fail - Disabled But Under 12 Months.bru`
- ✅ Fixes DIS-14 persona (temporary 6-month disability incorrectly marked eligible)
