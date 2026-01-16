# SSI Eligibility Screener - Implementation Progress

## Overview

Implementing a complete SSI (Supplemental Security Income) eligibility screener following POMS SI 00501.000 and related policy sections.

**Current Status**: ✅ ALL 5 OF 5 CORE ELIGIBILITY REQUIREMENTS IMPLEMENTED!

---

## Implementation Status

### ✅ COMPLETED

#### 1. Categorical Eligibility (POMS SI 00501.010)
- **Status**: ✅ Implemented
- **Location**: `library-api/src/main/resources/checks/categorical/categorical-eligibility.dmn`
- **Logic**: Age 65+ OR Blind OR Disabled
- **Tests**: Bruno tests in `test/bdt/checks/categorical/`
- **Form Field**: `isBlindOrDisabled` (yes/no), `dateOfBirth` (date)

#### 2. Citizenship Eligibility (POMS SI 00501.400)
- **Status**: ✅ Implemented
- **Location**: `library-api/src/main/resources/checks/citizenship/citizenship-eligibility.dmn`
- **Logic**:
  - U.S. Citizen OR
  - Qualified Alien (Lawful Permanent Resident, Refugee, Asylee, etc.)
  - Special handling for 7-year time limits on certain statuses
- **Tests**: Bruno tests in `test/bdt/checks/citizenship/`
- **Form Fields**:
  - `citizenshipStatus` (dropdown)
  - Conditional date fields based on status (refugeeAdmissionDate, asylumGrantDate, etc.)

#### 3. Residence Requirement (POMS SI 00501.410)
- **Status**: ✅ Implemented
- **Location**: `library-api/src/main/resources/checks/residence/ssi-residence-requirement.dmn`
- **Logic**: Must reside in 50 states, DC, or Northern Mariana Islands
- **Tests**: Bruno tests in `test/bdt/checks/residence/SsiResidenceRequirement/`
- **Form Field**: `residenceState` (dropdown of valid states)

#### 4. Resource Limits (POMS SI 01110.000 - SI 01150.000)
- **Status**: ✅ Implemented (FULL EXCLUSIONS + Couple Support) ✨ **COMPLETED 2026-01-09**
- **Location**:
  - `library-api/src/main/resources/checks/resources/ssi-resource-limit.dmn` (full implementation with inline exclusions)
  - `library-api/src/main/resources/checks/resources/calculate-countable-resources.dmn` (detailed calculation endpoint)
- **Logic**:
  - Countable resources < $2,000 for individuals
  - Countable resources < $3,000 for couples
  - **Automatic application of ALL 7 POMS exclusion rules** ✅
- **Tests**: Manual tests passing (Bruno tests need .seq field fixes)
- **Form Fields**: Dynamic `resources` list with conditional fields based on resource type
- **Implementation Notes**:
  - Added `tResource`, `tResourceList`, `tResourceCalculation` types to BDT.dmn
  - Consolidated architecture (no imports between decision files) due to Kogito limitation
  - Both DMN files contain full exclusion logic inline
  - Couple detection via relationships (spouse)
- **7 POMS Exclusions Implemented**:
  1. **Home** (SI 01130.100): Primary residence - full exclusion
  2. **Life Insurance** (SI 01130.500): Policies with face value ≤ $1,500
  3. **Household Goods** (SI 01130.200): All household goods/personal effects
  4. **Vehicle** (SI 01130.200): Primary vehicle - full exclusion
  5. **Burial Fund** (SI 01130.400): Up to $1,500 per person
  6. **ABLE Account** (SI 01130.740): Up to $100,000 per person
  7. **Self-Support Property** (SI 01130.515): Up to $6,000 per person
- **POMS References**:
  - SI 01110.003 - Resource Limits ($2,000 individual, $3,000 couple)
  - SI 01130.100 - Home Exclusion
  - SI 01130.200 - Household Goods and Vehicle Exclusions
  - SI 01130.400 - Burial Fund Exclusion
  - SI 01130.500 - Life Insurance Exclusion
  - SI 01130.515 - Self-Support Property Exclusion
  - SI 01130.740 - ABLE Account Exclusion

#### 5. Income Limits (POMS SI 00810.000 - SI 00830.000)
- **Status**: ✅ Implemented (with Couple Support)
- **Location**: `library-api/src/main/resources/checks/income/`
- **Files**:
  - `Income.dmn` - Base module with shared BKMs
  - `calculate-countable-income.dmn` - Core POMS-compliant calculation logic
  - `ssi-income-limit.dmn` - Wrapper check (returns boolean)
- **Logic**:
  - Earned vs. unearned income tracking
  - $20 general exclusion applied to unearned first
  - Spillover of unused $20 general exclusion to earned income
  - $65 earned income exclusion
  - 50% of remaining earned income excluded
  - Compares total countable income to FBR:
    - $967 for individuals
    - $1,450 for couples ✅ (implemented 2026-01-09)
- **Tests**: Bruno tests in `test/bdt/checks/income/SsiIncomeLimit/`
- **Form Fields**: `incomeSources` (list of tIncomeSource with type, category, monthlyAmount, etc.)
- **POMS References**:
  - SI 00810.000 - Overview of Income
  - SI 00810.420 - $20 General Income Exclusion
  - SI 00820.500 - Earned Income Exclusions
  - SI 00830.000 - Unearned Income
  - SI 00810.010 - Couple FBR ($1,450/month)
- **Implementation Notes**:
  - Uses tIncomeSource, tIncomeSourceList, tIncomeCalculation types in BDT.dmn
  - Exclusions applied in correct POMS order
  - Returns detailed tIncomeCalculation with all intermediary values
  - FBR configurable via `isCouple` parameter (defaults to $967 individual, $1,450 couple)
- **Current Limitations**:
  - Does not yet implement advanced exclusions (PASS, IRWE, etc.)
  - See deferred enhancements below for future work
- **SEIE Implemented** (2026-01-12):
  - Students under 22 can exclude up to $2,350/month ($9,460/year in 2025)
  - Applied BEFORE $20 general and $65 earned income exclusions per SI 00820.500
  - New file: `calculate-seie.dmn` + updated `calculate-countable-income.dmn`
  - Added `isStudent` field to tPerson in BDT.dmn

---

### 🚧 NOT YET IMPLEMENTED - Critical Gaps Identified (January 15, 2026)

Based on POMS research, the following significant SSI rules have not yet been implemented:

#### ⚠️ HIGH PRIORITY - Potentially Critical for Accuracy

1. **Sponsor Deeming (POMS SI 00502.200)** - SIGNIFICANT GAP
   - For LAPRs who entered with I-864 Affidavit of Support, sponsor's income AND resources are deemed to the alien
   - Applies IN ADDITION to LAPR exception conditions (an LAPR could meet all exceptions but still be ineligible due to sponsor's resources)
   - Many family-sponsored LAPRs have sponsors - this affects a large population
   - Includes indigence exception, deeming period calculations
   - **Complexity**: High
   - **Impact**: Could incorrectly show LAPRs as eligible when they're not

2. **Deemed Resources from Spouse/Parent (POMS SI 01330)**
   - We implemented income deeming (SI 01320) but NOT resource deeming
   - Ineligible spouse/parent resources are deemed similarly to income
   - Formula: Spouse/parent's resources minus exclusions → deemed to eligible individual
   - **Complexity**: Medium (follows income deeming pattern)

3. **Fleeing Felon / Probation Violator (POMS SI 00530.010)**
   - Hard disqualifying condition - anyone with outstanding felony warrant or parole/probation violation is ineligible
   - Simple boolean check: `isFugitiveFelonOrProbationViolator`
   - **Complexity**: Low (single boolean field)
   - **Impact**: Disqualifying condition that should be checked early

#### 🔶 MEDIUM PRIORITY - Additional Citizenship Pathways

4. **Battered Spouse/Child - Deemed Qualified Alien (POMS SI 00502.116)**
   - Non-citizens who suffered battery or extreme cruelty by family member gain "deemed qualified alien" status
   - Another citizenship pathway not currently implemented
   - **Complexity**: Medium

5. **Time-Limited Qualified Aliens - 7-Year Limits (POMS SI 00502.106)**
   - Beyond refugees/asylees, other statuses have 7-year limits:
     - Cuban-Haitian Entrant
     - Vietnamese Amerasian
     - Withheld Deportation
   - We have `RefugeeAsyleeWithinSevenYears` but may need similar checks for other statuses
   - **Complexity**: Medium (follows existing pattern)

#### 🔷 LOWER PRIORITY - Payment Calculation vs Eligibility

6. **Institutionalization - $30 Payment Limit (POMS SI 00520)**
   - Recipients in nursing homes/institutions receive only $30/month
   - Affects payment amount calculation, not basic eligibility determination
   - **Complexity**: Medium

---

## Current Architecture

### DMN Files
```
library-api/src/main/resources/
├── BDT.dmn                                           # Base types and utilities
├── Benefits.dmn                                      # tBenefitResponse type
├── checks/
│   ├── age/
│   │   └── Age.dmn                                   # Age BKMs
│   ├── categorical/
│   │   ├── Categorical.dmn                          # Base module
│   │   ├── person-age-65-or-older.dmn              ✅
│   │   ├── blind-or-disabled.dmn                   ✅
│   │   └── categorical-eligibility.dmn              ✅
│   ├── citizenship/
│   │   ├── Citizenship.dmn                          # Base module
│   │   ├── person-us-citizen.dmn                   ✅
│   │   ├── naturalized-citizen.dmn                 ✅
│   │   ├── lapr-with-exception.dmn                 ✅ (LAPR with 4 exception conditions)
│   │   ├── refugee-asylee-status.dmn               ✅
│   │   ├── refugee-asylee-within-seven-years.dmn   ✅
│   │   ├── vietnamese-amerasian.dmn                ✅
│   │   ├── cuban-haitian-entrant.dmn               ✅
│   │   ├── paroled-alien.dmn                       ✅
│   │   ├── withheld-deportation.dmn                ✅
│   │   └── citizenship-eligibility.dmn              ✅
│   ├── enrollment/
│   │   ├── Enrollment.dmn                          # Base module
│   │   ├── person-enrolled-in-benefit.dmn          ✅
│   │   └── person-not-enrolled-in-benefit.dmn      ✅
│   ├── income/
│   │   ├── Income.dmn                              # Base module
│   │   ├── calculate-countable-income.dmn          ✅
│   │   ├── calculate-seie.dmn                      ✅
│   │   ├── ssi-income-limit.dmn                    ✅
│   │   └── deeming/
│   │       ├── Deeming.dmn                         # Deeming base module (BKMs)
│   │       ├── spouse-deeming.dmn                  ✅ (SI 01320.400)
│   │       └── parent-to-child-deeming.dmn         ✅ (SI 01320.500)
│   ├── resources/
│   │   └── ssi-resource-limit.dmn                  ✅ (with couple support)
│   └── residence/
│       └── ssi-residence-requirement.dmn           ✅
└── benefits/
    ├── federal/
    │   └── ssi-eligibility.dmn                      ✅ (with couple detection)
    └── pa/phl/
        ├── phl-homestead-exemption.dmn             ✅
        └── phl-senior-citizen-tax-freeze.dmn       ✅
```

### Frontend Components
```
builder-frontend/src/components/ssi-screener/
├── SSIScreener.tsx (main screener component)
├── ssiFormSchema.json (Form.js schema)
└── ssiUtils.ts (data transformation utilities)
```

### Data Model

**tSituation** - Container for all household data:
- `primaryPersonId: string`
- `evaluationDate: date` - for time-based eligibility calculations
- `people: tPersonList` with extended tPerson:
  - `id: string`
  - `dateOfBirth: date`
  - `citizenshipStatus: string`
  - `isBlindOrDisabled: boolean`
  - `refugeeAdmissionDate: date`
  - `asylumGrantDate: date`
  - `withheldDeportationGrantDate: date`
  - `cubanHaitianEntryDate: date`
  - `amerasianAdmissionDate: date`
  - `residenceState: string` - for residence checks
  - `resources: tResourceList` - for resource limit checks ✅ (added 2026-01-09)
    - `id: string`
    - `type: string` (bank_account, real_property, vehicle, life_insurance, etc.)
    - `value: number`
    - `description: string`
    - `isPrimaryResidence: boolean` (for real_property)
    - `isPrimaryVehicle: boolean` (for vehicle)
    - `lifeInsuranceFaceValue: number` (for life_insurance)
    - `isEssentialForSelfSupport: boolean` (for any resource type)
  - `incomeSources: tIncomeSourceList` - for income calculations
    - `id: string`
    - `type: string` (earned/unearned)
    - `category: string` (wages, SSA benefits, etc.)
    - `monthlyAmount: number`
    - `description: string`
    - `isInfrequentOrIrregular: boolean`
- `enrollments: tEnrollmentList` (personId, benefit)
- `relationships: tRelationshipList` (type, personId, relatedPersonId)
- `simpleChecks: tSimpleChecks` (boolean flags)

**Future Additions for Enhancements**:
- Detailed resource types (home, vehicle, burial funds)
- ~~Student status (for SEIE)~~ ✅ Implemented 2026-01-12
- PASS plan indicator
- ~~40 QQ, veteran status fields (for LAPR exceptions)~~ ✅ Implemented 2026-01-15
- ~~Parent/child relationships (for deeming)~~ ✅ Implemented 2026-01-12

---

## Next Steps - Recommended Implementation Order

### Final Core Requirement: Income Limits
**Reasoning**: Most complex requirement due to earned/unearned distinction, multiple deduction rules, and FBR comparison

**Implementation Tasks**:
1. Research POMS SI 00810.000 - SI 00830.000, SI 01110.000 - SI 01120.000 using POMS API
2. Define tIncomeSource and tIncomeList types in BDT.dmn
3. Create earned income calculation DMN (includes $65 + $20 + 50% exclusion)
4. Create unearned income calculation DMN (includes $20 exclusion)
5. Create total countable income DMN
6. Create income limit check DMN (compare to FBR)
7. Update ssi-eligibility.dmn to include income check
8. Update SSI screener form to collect income data
9. Create Bruno tests

**Estimated Complexity**: High (4-8 hours)

**Once completed**: All 5 core SSI eligibility requirements will be implemented!

---

## Additional Enhancements (Future)

### High Priority - Critical for Accuracy

- **⚠️ Sponsor Deeming** (POMS SI 00502.200): Sponsor's income/resources deemed to LAPR - critical for LAPR population accuracy
- **⚠️ Deemed Resources** (POMS SI 01330): Resource deeming from ineligible spouse/parent (income deeming done, resources not)
- **Fleeing Felon / Probation Violator** (POMS SI 00530.010): Disqualifying condition - simple boolean check

### Completed - High Priority

- ~~**⭐ Full Resource Exclusions Implementation** (POMS SI 01130.000)~~ ✅ **COMPLETED 2026-01-09**
  - Automatically apply POMS exclusion rules
  - Resource type modeling (bank accounts, vehicles, real property, life insurance, etc.)
  - All 7 individual exclusion checks implemented inline
  - Form schema updated with dynamic resources list
  - **See "SSI Full Resource Exclusions" in Recent Accomplishments below**
- ~~**LAPR Exception Conditions** (POMS SI 00502.100, SI 00502.135, SI 00502.140, SI 00502.142)~~ ✅ **COMPLETED 2026-01-15**
  - 40 QQs with 5-year bar, Veteran/Military, Blind/Disabled+8/22/96, Grandfathered SSI
  - **See "LAPR Exception Conditions" in Recent Accomplishments below**

### Medium Priority

- **Battered Spouse/Child** (POMS SI 00502.116): Deemed qualified alien status for abuse victims
- **Time-Limited Qualified Aliens** (POMS SI 00502.106): 7-year limits for Cuban-Haitian, Vietnamese Amerasian, Withheld Deportation
- **⭐ Full Income Exclusions Implementation** (POMS SI 00810.000 - SI 00830.000):
  - Automatically apply POMS income exclusion rules
  - Earned vs. unearned income modeling
  - $20 general exclusion + $65 earned + 50% calculation
  - **See SSI-INCOME-LIMITS-PLAN.md for detailed implementation plan**
  - **Estimated effort**: 7.5-11 hours
- ~~**Couple Resource Limit** (POMS SI 01110.210): Apply $3,000 limit for married couples~~ ✅ **COMPLETED 2026-01-09**
- ~~**Couple FBR** (POMS SI 00835.000): Apply couple FBR ($1,450) instead of individual ($967)~~ ✅ **COMPLETED 2026-01-09**
- ~~**Income Deeming Rules** (POMS SI 01320.000): Income deemed from ineligible spouse/parent~~ ✅ **COMPLETED 2026-01-12**
- ~~**Student Earned Income Exclusion (SEIE)** (POMS SI 00820.510): Up to $2,350/month, $9,460/year for students~~ ✅ **COMPLETED 2026-01-12**
- **Plan to Achieve Self-Support (PASS)** (POMS SI 00870.000): Income/resource exclusions for approved plans
- **Impairment-Related Work Expenses (IRWE)** (POMS SI 00820.540): Deduct disability-related work costs from earned income
- **In-Kind Support and Maintenance (ISM)** (POMS SI 00835.000): Value of food/shelter provided by others reduces FBR
- **Infrequent or Irregular Income Exclusion** (POMS SI 00810.410): Up to $30/month unearned, $65/month earned if infrequent
- **Living Arrangements** (POMS SI 00835.000): Affects FBR calculation based on living situation

### Lower Priority

- **Institutionalization - $30 Payment Limit** (POMS SI 00520): Reduced benefits for institutional residents
- **State Supplements**: Vary by state, optional to implement
- **Transfer of Resources Penalties** (POMS SI 01150.000): 36-month lookback, period of ineligibility calculation

---

## Testing Strategy

### Unit Tests (Bruno)
- Individual check tests in `test/bdt/checks/`
- Benefit composition tests in `test/bdt/benefits/federal/`

### Integration Tests
- End-to-end screener testing via builder-frontend
- Test scenarios covering all combinations of eligibility factors

### Test Coverage Goals
- Each check should have:
  - ✅ Pass scenario (eligible)
  - ✅ Fail scenario (ineligible)
  - ✅ Edge case - Null/missing data (unable to determine)

### Null Value Pattern (Three-Valued Logic)

SSI eligibility checks use a **three-valued logic** pattern where results can be:

| Result | Meaning | When It Occurs |
|--------|---------|----------------|
| `true` | Check passed, requirement met | All required data present and condition satisfied |
| `false` | Check failed, requirement not met | All required data present and condition NOT satisfied |
| `null` | Unable to determine | Insufficient data to evaluate the check |

**Why This Matters**:
- **Forms**: Null results indicate missing required fields that the user needs to complete
- **API Consumers**: Null signals that more data is needed before a determination can be made
- **Eligibility Composition**: `all()` returns null if any check is null (can't confirm eligibility without complete data)

**Example**: If a person's `citizenshipStatus` field is not provided, the citizenship check returns `null` rather than `false`, indicating the system cannot determine eligibility without that information.

**Implementation**: Each check DMN follows this pattern:
```feel
// Returns null if person not found, false if condition not met, true if met
person.citizenshipStatus = "US_CITIZEN"
```

### Current Test Coverage
- **Categorical**: 9/9 Bruno tests passing
- **Citizenship**: 36/36 Bruno tests passing (includes 7 RefugeeAsyleeWithinSevenYears + 11 LaprWithException)
- **Income**: 6/6 Bruno tests created
- **Resources**: 3/3 Bruno tests created
- **Residence**: 3/3 Bruno tests created
- **SSI Eligibility (integrated)**: 10/10 Bruno tests created
  - Pass scenarios: 4 tests (basic eligibility, edge cases, multiple income sources)
  - Fail scenarios: 6 tests (each check failure, multiple check failures)
- **SSI Couple Eligibility**: 5/5 Bruno tests created (added 2026-01-09)

---

## Known Issues & Technical Debt

1. **Refugee/Asylee 7-Year Check**: Date calculation has some edge cases that need refinement
2. **Form Validation**: Could add client-side validation for better UX
3. **Error Messages**: Could provide more specific feedback when checks fail
4. **POMS Updates**: Need to track POMS policy changes and update logic accordingly
5. **POMS Citations**: Some DMN files have missing or incomplete POMS citations in their descriptions. The DMN Audit Tool flags checks without citations for review. Citations should be verified against source POMS sections during policy review.

---

## Change Log

### 2026-01-12: Check Pattern Fixes and Skill Documentation

Fixed DMN files that were causing `DynamicEndpointPatternTest` failures:

1. **Fixed `refugee-asylee-within-seven-years.dmn`**
   - Issue: Check returned `null` instead of `false` when person wasn't a refugee/asylee
   - Fix: Changed return value from `null` to `false` in the `withinSevenYears` context entry
   - Pattern: Checks must ALWAYS return boolean (true/false), never null

2. **Fixed `ssi-income-limit.dmn`**
   - Issue: Was trying to access `.checkResult` on decision service invocation result
   - Fix: Removed `.checkResult` - inline FEEL decision service calls return output directly
   - Pattern: For single-output decision services, FEEL returns the value directly

3. **Fixed `calculate-countable-resources.dmn`**
   - Issue: Used `typeRef="Any"` for parameters instead of proper type definition
   - Fix: Added proper `tParameters` itemDefinition with `personId` (string) and `resources` (BDT.tResourceList)
   - Pattern: Always define specific tParameters types for OpenAPI generation

4. **Updated BDT DMN Authoring Skill File (v1.2)**
   - Added documentation for tParameters with imported complex types
   - Clarified that inline FEEL decision service calls return output directly (no `.checkResult`)
   - Added critical warning that checks must return false, never null
   - Updated troubleshooting section with these common errors

**Result**: All `DynamicEndpointPatternTest` tests passing (3 tests, 0 failures)

---

### 2026-01-12: FEEL Expression Fixes
Fixed critical FEEL expression errors that were blocking SSI eligibility endpoint:

1. **Fixed `spouse id` function call** (BDT.dmn, senior-citizen-tax-freeze.dmn)
   - Changed `spouse id(...)` to inline FEEL expression
   - The space in the function name caused FEEL syntax errors
   - Fixed pattern: `situation.relationships[item.personId = situation.primaryPersonId and item.type = "spouse"][1].relatedPersonId`

2. **Fixed `checks.categoricalEligible` variable access** (ssi-eligibility.dmn)
   - Changed direct property access to use `get entries()` pattern
   - Original: `[checks.categoricalEligible, ...]` (Kogito couldn't resolve)
   - Fixed: `for check in (get entries(checks))[item.key in [...]] return check.value`

**Result**: SSI eligibility endpoint now functional, server starts without FEEL errors

---

## Architecture Patterns

The SSI implementation follows established DMN patterns:

1. **Individual Checks**: Simple boolean status/calculation checks
   - Example: `person-age-65-or-older.dmn`, `refugee-asylee-status.dmn`
   - Returns boolean result based on situation data

2. **Composition Checks**: Combine individual checks with OR/AND logic
   - Example: `categorical-eligibility.dmn` (Age 65+ OR Blind OR Disabled)
   - Example: `citizenship-eligibility.dmn` (ANY of 8 qualified alien categories)

3. **Base Modules**: Shared types and Business Knowledge Models (BKMs)
   - `BDT.dmn` - Core types (tSituation, tPerson), shared BKMs
   - `Age.dmn` - Age calculation BKMs
   - `Enrollment.dmn` - Enrollment lookup BKMs
   - `Citizenship.dmn` - Citizenship-specific types and BKMs
   - `Income.dmn` - Income types and calculation BKMs

4. **Benefits**: Orchestrate multiple checks into program eligibility
   - Example: `ssi-eligibility.dmn` - Combines categorical, citizenship, income, resources, residence
   - Returns detailed `tBenefitResponse` with individual check results + overall eligibility

---

## Implementation Commands

Core SSI eligibility is complete! To add enhancements, use these example commands:

```bash
# Add income deeming from ineligible spouse/parents
"Let's implement income deeming from ineligible spouse/parents per POMS SI 01320.000"

# Add resource exclusions
"Let's implement home, vehicle, and burial fund exclusions for SSI resources per POMS SI 01130.000"

# Add Student Earned Income Exclusion
"Let's implement SEIE for SSI per POMS SI 00820.510"

# Add remaining citizenship time limits
"Let's add 7-year time limits for WithheldDeportation, CubanHaitianEntrant, and VietnameseAmerasian"

# Test the complete SSI screener
"Let's test the SSI eligibility endpoint with various scenarios"
```

---

## Resources

- **POMS (Program Operations Manual System)**: https://secure.ssa.gov/poms.nsf/
- **SSI Overview**: POMS SI 00501.000
- **DMN Specification**: https://www.omg.org/spec/DMN/
- **Form.js Documentation**: https://bpmn.io/toolkit/form-js/
- **API Endpoints**: http://localhost:8083/q/swagger-ui
- **SSI Eligibility Endpoint**: POST /api/v1/benefits/federal/ssi-eligibility

---

**Last Updated**: 2026-01-15
**Current Sprint**: ✅ COMPLETED! All 5 core eligibility requirements + Couple Eligibility + SEIE + Income Deeming + LAPR Exception Conditions
**Next Steps**: HIGH PRIORITY: Sponsor Deeming (SI 00502.200), Resource Deeming (SI 01330), Fleeing Felon check (SI 00530.010)

---

## Recent Accomplishments

### ✅ LAPR Exception Conditions (January 15, 2026)

**Summary**: Complete implementation of LAPR (Lawfully Admitted for Permanent Residence) SSI eligibility exception conditions per POMS SI 00502.100, SI 00502.135, SI 00502.140, and SI 00502.142.

**POMS Policy Basis**:
- **SI 00502.100**: LAPRs must meet BOTH qualified alien status AND an exception condition
- **SI 00502.100A.3**: Four exception conditions for LAPR eligibility
- **SI 00502.135**: 40 Qualifying Quarters exception with 5-year bar for post-8/22/96 entry
- **SI 00502.140**: Veteran/Active Duty Military exception (or spouse/dependent child thereof)
- **SI 00502.142**: Blind/Disabled AND lawfully residing on 8/22/96 exception

**What Was Implemented**:

1. **Data Model** (BDT.dmn) - 8 new tPerson fields:
   - `qualifyingQuarters: number` - Total QQs (own + parent's + spouse's)
   - `usEntryDate: date` - Date of entry into US as qualified alien (for 5-year bar)
   - `isVeteran: boolean` - Honorably discharged veteran (2+ years active duty)
   - `isActiveDutyMilitary: boolean` - Currently serving on active duty
   - `isSpouseOfVeteranOrActiveDuty: boolean` - Spouse of veteran/active duty
   - `isDependentChildOfVeteranOrActiveDuty: boolean` - Dependent child of veteran/active duty
   - `wasLawfullyResidingOn8221996: boolean` - Lawfully residing in US on 8/22/96
   - `wasReceivingSSIOn8221996: boolean` - Was receiving SSI on 8/22/96 (grandfathered)

2. **LaprWithException Check** (checks/citizenship/lapr-with-exception.dmn)
   - New check that validates LAPR status AND exception conditions
   - Implements all 4 POMS exception conditions:
     - 40 QQs with 5-year bar logic
     - Veteran/Military (self, spouse, or dependent child)
     - Blind/Disabled + 8/22/96 residence
     - Receiving SSI on 8/22/96 (grandfathered)
   - Endpoint: `POST /api/v1/checks/citizenship/lapr-with-exception`

3. **5-Year Bar Logic** (SI 00502.135B.1):
   - LAPRs entering before 8/22/96: No bar, 40 QQs sufficient
   - LAPRs entering on/after 8/22/96: Must wait 5 years after entry before 40 QQs exception applies
   - FEEL implementation:
   ```feel
   // 40 QQ Exception: has 40 QQs AND (entered before 8/22/96 OR 5-year bar has passed)
   has40QualifyingQuarters and (enteredBeforeWelfareReform or fiveYearsSinceEntry)
   ```

4. **Updated CitizenshipEligibility** (citizenship-eligibility.dmn)
   - Replaced `PermanentResidentQualified` import with `LaprWithException`
   - LAPR eligibility now requires exception condition, not just LAPR status

**Test Coverage** (11 Bruno tests):
| Test Scenario | Expected Result |
|---------------|-----------------|
| 40 QQs, pre-welfare-reform entry (1990) | true ✓ |
| 40 QQs, post-welfare-reform within 5-year bar | false ✓ |
| 40 QQs, post-welfare-reform 5 years passed | true ✓ |
| Veteran | true ✓ |
| Active duty military | true ✓ |
| Spouse of veteran | true ✓ |
| Dependent child of veteran | true ✓ |
| Blind/disabled + 8/22/96 residence | true ✓ |
| Grandfathered SSI recipient (8/22/96) | true ✓ |
| LAPR with no exception condition | false ✓ |
| Non-LAPR (US citizen) | false ✓ |

**Files Created/Modified**:
- `library-api/src/main/resources/BDT.dmn` (8 new tPerson fields)
- `library-api/src/main/resources/checks/citizenship/lapr-with-exception.dmn` (NEW)
- `library-api/src/main/resources/checks/citizenship/citizenship-eligibility.dmn` (updated import/invocation)
- `library-api/test/bdt/checks/citizenship/LaprWithException/` (11 Bruno tests)
- `library-api/test/bdt/checks/citizenship/CitizenshipEligibility/Pass - LAPR.bru` (updated)

**Key FEEL Patterns**:
- Date comparison requires wrapping: `date(person.usEntryDate) < welfareReformDate`
- Duration arithmetic: `date(person.usEntryDate) + duration("P5Y") <= date(situation.evaluationDate)`
- XML escape for `<` in expressions: Use `&lt;` in DMN XML

---

### ✅ Income Deeming Rules (January 12, 2026)

**Summary**: Complete implementation of income deeming from ineligible spouse (SI 01320.400) and ineligible parents (SI 01320.500).

**What Was Implemented**:

1. **Data Model** (BDT.dmn)
   - Extended tRelationship type to include "spouse", "parent", "child" values
   - Added `isSSIEligible: boolean` field to tPerson
   - Added `tDeemingCalculation` type with fields:
     - `deemingApplies: boolean`
     - `deemingType: string` ("spouse", "parent-to-child", "none")
     - `deemorTotalIncome: number`
     - `deemorCountableIncome: number`
     - `livingAllowanceAllocated: number`
     - `ineligibleChildrenAllocation: number`
     - `deemedIncome: number`
     - `numberOfIneligibleChildren: number`
     - `numberOfParents: number`

2. **Deeming Base Module** (deeming/Deeming.dmn)
   - Shared Business Knowledge Models (BKMs) for deeming calculations:
     - `get deemor income` - Extract earned/unearned income from person
     - `calculate deemor countable income` - Apply standard exclusions ($20 general, $65 earned, 50%)
     - `get spouse living allowance` - Couple FBR minus Individual FBR ($483)
     - `get parent living allowance` - Individual FBR for single parent, Couple FBR for two parents
     - `get ineligible children allocation` - $483.50 per ineligible child (½ Individual FBR)
     - `calculate deemed income` - Countable minus allocations
     - `find spouse`, `find parents`, `count ineligible children` - Relationship navigation

3. **Spouse Deeming Endpoint** (deeming/spouse-deeming.dmn)
   - POMS SI 01320.400 implementation
   - Calculates deemed income from ineligible spouse to eligible individual
   - Spouse living allowance: $483 (Couple FBR $1,450 - Individual FBR $967)
   - Endpoint: `POST /api/v1/checks/income/deeming/spouse-deeming`
   - Decision Service returns both `checkResult` (boolean) and `deemingCalculation` (full breakdown)

4. **Parent-to-Child Deeming Endpoint** (deeming/parent-to-child-deeming.dmn)
   - POMS SI 01320.500 implementation
   - Calculates deemed income from ineligible parent(s) to eligible child under 18
   - Parent living allowance: $967 for single parent, $1,450 for two parents
   - Ineligible sibling allocation: $483.50 per ineligible sibling
   - Age verification: Only applies to children under 18
   - Endpoint: `POST /api/v1/checks/income/deeming/parent-to-child-deeming`

5. **2025 FBR Values Used**:
   - Individual FBR: $967
   - Couple FBR: $1,450
   - Spouse living allowance: $483
   - Child allocation: $483.50 (½ Individual FBR)

**Test Results**:
- ✅ Spouse deeming: No spouse → no deeming
- ✅ Spouse deeming: Eligible spouse → no deeming (both eligible = no deeming)
- ✅ Spouse deeming: Ineligible spouse with $2,500 earned + $200 unearned → $964.50 deemed
- ✅ Parent deeming: Adult (18+) → no deeming (age check)
- ✅ Parent deeming: Child with one parent ($2,500 earned + $200 unearned) → $430.50 deemed
- ✅ Parent deeming: Child with two parents and siblings → correct allocations applied

**Example Calculations**:

*Spouse Deeming (SI 01320.400)*:
```
Ineligible spouse income: $2,500 earned + $200 unearned = $2,700 total
Step 1: Countable = (2700 - 20 - 65) * 0.5 + 20 + 65 = $1,392.50 + $85 = $1,447.50
Step 2: Deemed = $1,447.50 - $483 (spouse allowance) = $964.50
```

*Parent-to-Child Deeming (SI 01320.500)*:
```
Single parent income: $2,500 earned + $200 unearned = $2,700 total
Step 1: Countable = $1,397.50 (same calculation as above)
Step 2: Parent allowance = $967 (Individual FBR for one parent)
Step 3: Deemed = $1,397.50 - $967 = $430.50
```

**Files Created/Modified**:
- `library-api/src/main/resources/BDT.dmn` (tRelationship extended, isSSIEligible, tDeemingCalculation)
- `library-api/src/main/resources/checks/income/deeming/Deeming.dmn` (NEW - base module)
- `library-api/src/main/resources/checks/income/deeming/spouse-deeming.dmn` (NEW)
- `library-api/src/main/resources/checks/income/deeming/parent-to-child-deeming.dmn` (NEW)
- `library-api/test/bdt/checks/income/deeming/SpouseDeeming/` (6 Bruno tests)
- `library-api/test/bdt/checks/income/deeming/ParentToChildDeeming/` (3 Bruno tests)

**Completed**: Deeming integration into main income calculation - see section below.

---

### ✅ Deeming Integration into Income Calculation (January 13, 2026)

**Summary**: Integrated deemed income from spouse/parent deeming into the main `calculate-countable-income.dmn` per POMS SI 01320.001 and SI 01320.730.

**POMS Policy Basis**:
- **SI 01320.001**: "This deemed income is added to the individual's own earned and unearned income in order to determine the individual's eligibility for and amount of SSI payment"
- **SI 01320.001**: "deemed income... is considered to be the eligible individual's own unearned income"
- **SI 01320.730**: "Always treat deemed income as unearned income"

**Implementation**:
1. Added `deemedIncome` parameter to tParameters in `calculate-countable-income.dmn`
2. Combined deemed income with person's own unearned income BEFORE applying $20 general exclusion
3. Updated output to include `deemedIncome` field in `tIncomeCalculation`
4. Changed `incomeCalculation` from encapsulated to output decision for API visibility

**Calculation Flow**:
```
Unearned Income:
1. Person's unearned + deemed income = combined unearned
2. Apply $20 general exclusion to combined
3. Result = countable unearned (includes deemed)

Earned Income:
4. Apply spillover of unused $20 (if any)
5. Apply $65 earned exclusion
6. Apply 50% exclusion
7. Result = countable earned

Total: countable unearned + countable earned
```

**Test Results** (manually verified via curl):
| Test | Own Income | Deemed | Total Countable | meetsIncomeLimit |
|------|------------|--------|-----------------|------------------|
| Under Limit | $50 unearned | $430.50 | $460.50 | true |
| Over Limit | $100 unearned | $900 | $980 | false |
| Mixed | $100 unearned + $200 earned | $300 | $447.50 | true |
| Backward Compat | $200 unearned + $500 earned | $0 | $397.50 | true |

**Files Modified**:
- `library-api/src/main/resources/checks/income/calculate-countable-income.dmn`

**Bruno Tests Created**:
- `test/bdt/checks/income/CalculateCountableIncome/With Deemed Income - Under Limit.bru`
- `test/bdt/checks/income/CalculateCountableIncome/With Deemed Income - Over Limit.bru`
- `test/bdt/checks/income/CalculateCountableIncome/With Deemed Income - Mixed Earned Unearned.bru`
- `test/bdt/checks/income/CalculateCountableIncome/No Deemed Income - Backwards Compatible.bru`

**Usage Example**:
```json
{
  "situation": { ... },
  "parameters": {
    "personId": "child1",
    "FBR": 967,
    "deemedIncome": 430.50  // From parent-to-child or spouse deeming
  }
}
```

---

### ✅ Student Earned Income Exclusion (SEIE) (January 12, 2026)

**Summary**: Complete implementation of SEIE per POMS SI 00820.510 for students under 22.

**What Was Implemented**:

1. **Data Model** (BDT.dmn)
   - Added `isStudent: boolean` field to tPerson
   - Added `seieExclusionApplied: number` field to tIncomeCalculation
   - Per POMS SI 00501.020 student status requirements

2. **CalculateSeie Endpoint** (calculate-seie.dmn)
   - New standalone check for SEIE qualification and calculation
   - Returns `tSeieResult` with: qualifiesForSeie, seieExclusionAmount, remainingYearlyLimit, monthlyLimit, yearlyLimit
   - Endpoint: `POST /api/v1/checks/income/calculate-seie`

3. **Updated Income Calculation** (calculate-countable-income.dmn)
   - SEIE applied BEFORE $20 general and $65 earned exclusions (per SI 00820.500)
   - Added Age module import with knowledgeRequirement for age calculation
   - Added `seieUsedYTD` parameter for yearly limit tracking
   - Returns seieExclusionApplied in tIncomeCalculation

4. **2025 SEIE Limits**:
   - Monthly: $2,350
   - Yearly: $9,460

**Test Results**:
- ✅ All 13 DynamicEndpointPatternTest tests passing
- ✅ Student (age 20) with $2,500 income: `checkResult: true` (SEIE applies)
- ✅ Non-student (same age/income): `checkResult: false` (no SEIE)
- ✅ Yearly limit tracking working correctly

**Files Modified**:
- `library-api/src/main/resources/BDT.dmn` (added isStudent to tPerson)
- `library-api/src/main/resources/checks/income/calculate-seie.dmn` (NEW)
- `library-api/src/main/resources/checks/income/calculate-countable-income.dmn` (SEIE integration)

**Key FEEL Patterns Learned**:
- `not()` is a function in FEEL, not a prefix: use `not(value)` not `not value`
- BKM imports require explicit `knowledgeRequirement` elements

---

### ✅ SSI Couple Eligibility (January 9, 2026)

**Summary**: Complete implementation of SSI couple eligibility rules per POMS SI 00501.010, SI 01110.003, and SI 00810.010.

**What Was Implemented**:

1. **Eligible Spouse Detection BKM** (in BDT.dmn)
   - New Business Knowledge Model: "has eligible spouse"
   - Detects when two members in a household form an eligible couple
   - Logic: Checks both members meet categorical AND citizenship requirements
   - POMS Reference: SI 00501.010

2. **Couple Resource Limit** (ssi-resource-limit.dmn)
   - Added `isCouple` parameter (boolean)
   - Applies $3,000 limit for couples vs $2,000 for individuals
   - POMS Reference: SI 01110.003

3. **Couple Income FBR** (ssi-income-limit.dmn)
   - Added `isCouple` parameter (boolean)
   - Calculates FBR as $1,450 for couples vs $967 for individuals
   - POMS Reference: SI 00810.010

4. **SSI Eligibility Couple Status Detection** (ssi-eligibility.dmn)
   - Uses "has eligible spouse" BKM to detect couple status
   - Passes couple status to resource and income limit checks
   - Both members must meet categorical and citizenship requirements

**Test Coverage**:
- 5 Bruno test files with comprehensive assertions:
  - Eligible couple passes all checks ✓
  - Couple exceeding resource limit fails appropriately ✓
  - Couple exceeding income FBR fails appropriately ✓
  - Individual (no spouse) still works correctly ✓

**Files Modified**:
- `library-api/src/main/resources/BDT.dmn` (added "has eligible spouse" BKM)
- `library-api/src/main/resources/checks/resources/ssi-resource-limit.dmn` (couple resource limit)
- `library-api/src/main/resources/checks/income/ssi-income-limit.dmn` (couple FBR)
- `library-api/src/main/resources/benefits/federal/ssi-eligibility.dmn` (couple detection logic)
- `library-api/test/bdt/benefits/federal/SsiEligibility/` (5 new Bruno tests)

---

### ✅ SSI Full Resource Exclusions (January 9, 2026)

**Summary**: Complete implementation of ALL 7 POMS resource exclusion rules per SI 01130 series, enabling automatic calculation of countable resources.

**What Was Implemented**:

1. **Data Model** (BDT.dmn)
   - New types: `tResource`, `tResourceList`, `tResourceCalculation`
   - Resource fields: type, value, description, isPrimaryResidence, isPrimaryVehicle, lifeInsuranceFaceValue, isEssentialForSelfSupport
   - 10 resource types supported: bank_account, cash, real_property, vehicle, life_insurance, stocks_bonds, burial_fund, able_account, household_goods, other

2. **CalculateCountableResources Endpoint** (calculate-countable-resources.dmn)
   - Consolidated implementation with all 7 exclusions inline (no imports)
   - Calculates: totalResources, excludedResources, countableResources, applicableLimit, meetsResourceLimit
   - Returns full `tResourceCalculation` with breakdown
   - Endpoint: `POST /api/v1/checks/resources/calculate-countable-resources`
   - POMS References: SI 01130.100, SI 01130.200, SI 01130.400, SI 01130.500, SI 01130.515, SI 01130.740

3. **SsiResourceLimit Endpoint** (ssi-resource-limit.dmn)
   - Consolidated implementation with all 7 exclusions inline
   - Returns boolean `checkResult` (pass/fail)
   - Reads resources from `situation.people[x].resources`
   - Couple detection via relationships (spouse)
   - Endpoint: `POST /api/v1/checks/resources/ssi-resource-limit`

4. **7 POMS Exclusions Implemented**:
   - **Home** (SI 01130.100): Primary residence - full exclusion
   - **Life Insurance** (SI 01130.500): Face value ≤ $1,500 - full exclusion
   - **Household Goods** (SI 01130.200): All household goods/personal effects - full exclusion
   - **Vehicle** (SI 01130.200): Primary vehicle - full exclusion
   - **Burial Fund** (SI 01130.400): Capped at $1,500 per person
   - **ABLE Account** (SI 01130.740): Capped at $100,000 per person
   - **Self-Support Property** (SI 01130.515): Capped at $6,000 per person

5. **Form Schema Update** (builder-frontend)
   - Added resources section with yes/no gate question
   - Dynamic list (repeatable group) for adding multiple resources
   - Resource type dropdown (10 options)
   - Current value (number input)
   - Optional description field
   - Conditional fields based on resource type:
     - "Is this your primary residence?" (real_property only)
     - "Is this your primary vehicle?" (vehicle only)
     - "Life Insurance Face Value" (life_insurance only)
     - "Is this property essential for self-support?" (all types)

**Test Results**:
- ✅ Manual testing via curl - all scenarios passing:
  - Resources below limit ($1,500 countable): `checkResult: true`
  - Resources above limit ($3,000 countable): `checkResult: false`
  - Multiple exclusions ($216,500 total, $215,000 excluded, $1,500 countable): `checkResult: true`
- Note: Bruno tests need `.seq` field fixes

**Technical Architecture Decision**:
- **Consolidated Implementation**: Both DMN files contain full exclusion logic inline (no imports between decision files)
- **Reason**: Kogito compiles FEEL expressions BEFORE resolving imports during build, causing "Unknown variable" errors
- **Solution**: All exclusion calculations duplicated in both `calculate-countable-resources.dmn` and `ssi-resource-limit.dmn`
- **Trade-off**: Some code duplication, but avoids complex import resolution issues

**Files Modified**:
- `library-api/src/main/resources/BDT.dmn` (added tResource, tResourceList, tResourceCalculation types)
- `library-api/src/main/resources/checks/resources/calculate-countable-resources.dmn` (consolidated implementation)
- `library-api/src/main/resources/checks/resources/ssi-resource-limit.dmn` (consolidated implementation)
- `builder-frontend/src/components/ssi-screener/ssiFormSchema.json` (added resources section)
