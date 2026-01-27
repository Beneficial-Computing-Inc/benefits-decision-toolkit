# Spec: Income Interactions for SSI/SSDI Eligibility

**Status:** Approved
**Author:** Claude Code + Nick
**Date:** 2026-01-26
**Version:** 1.0

---

## Problem Statement

SSI and SSDI eligibility depends on income, but different income sources are treated differently. Benefits like SSDI and VA pension count as unearned income, while benefits like Section 8 and SNAP are explicitly excluded. Currently, the BDT income calculation doesn't distinguish between income sources at a granular enough level to apply these rules correctly, and the screener doesn't capture benefit receipt in a way that enables proper income interaction modeling.

---

## Success Criteria

We'll know this works when:
- [ ] Income from government benefits (SSDI, VA, etc.) is correctly categorized and counted
- [ ] Excluded income sources (Section 8, SNAP, LIHEAP) are explicitly excluded with explainability
- [ ] The income calculation output shows what was excluded and why
- [ ] Benefit receipt is captured in `tEnrollment` for both income counting and future referral features
- [ ] Bruno tests cover all income source scenarios
- [ ] Screener can capture benefit receipt and amounts

---

## Solution Overview

Extend the BDT data model to:
1. Add granular `benefitType` field to `tEnrollment` with semantic categories for UX clarity
2. Have DMN rules read enrollments to determine income effects
3. Add explicit exclusion rules that explain WHY income is excluded (for transparency)
4. Update the income calculation to filter excluded sources before counting

The key insight: **Benefits receipt goes in `enrollments[]`**, and the DMN determines income treatment based on enrollment data. This cleanly separates "what benefits do you receive?" (UX concern) from "how does this affect income?" (rules concern).

---

## Detailed Requirements

### Functional Requirements

1. **Extended tEnrollment type** shall include:
   - `personId` (string) - existing
   - `benefit` (string) - benefit type code (see taxonomy below)
   - `status` (string, optional) - "RECEIVING", "PENDING", "APPROVED", "DENIED"
   - `monthlyAmount` (number, optional) - benefit amount if applicable
   - `startDate` (date, optional) - when benefit started (for Medicare calculation)

2. **Benefit taxonomy** shall distinguish between:
   - Cash benefits that count as income (SSDI, VA_PENSION, VA_DISABILITY_COMP, etc.)
   - Cash benefits that are excluded (certain state veteran annuities)
   - Non-cash benefits that are excluded (SECTION_8, SNAP, LIHEAP, MEDICAID)
   - Non-benefit enrollments (MEDICARE - for tracking, not income)

3. **Income calculation** shall:
   - Read `enrollments[]` to identify benefit receipt
   - Add cash benefit amounts to unearned income total
   - Explicitly exclude excluded benefit types
   - Return `excludedIncome` and `excludedSources` in output for explainability

4. **Exclusion check** shall:
   - Take a benefit type as input
   - Return whether it's excluded from SSI income
   - Include POMS citation in the check description

5. **Income source categories** (for backward compatibility with existing income entry):
   - Keep existing `incomeSources[]` for non-benefit income (wages, self-employment, rental, etc.)
   - Benefit income derived from `enrollments[]`, not duplicated in `incomeSources[]`

### Non-Functional Requirements

- **Explainability:** All exclusions must be traceable to POMS citations
- **Backward Compatibility:** Existing income calculation must continue to work
- **Extensibility:** Easy to add new benefit types without major refactoring

---

## System Context

### How It Fits

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Screener UI   │────▶│    tSituation    │────▶│   DMN Rules     │
│                 │     │                  │     │                 │
│ Benefits Section│     │ • enrollments[]  │     │ • Read enrolls  │
│ Income Section  │     │ • incomeSources[]│     │ • Derive income │
└─────────────────┘     └──────────────────┘     │ • Apply excludes│
                                                  │ • Calculate     │
                                                  └─────────────────┘
```

### Dependencies

- `BDT.dmn` - Base type definitions (tSituation, tEnrollment)
- `Enrollment.dmn` - Enrollment types and checks
- `calculate-countable-income.dmn` - Income calculation logic
- `ssi-eligibility.dmn` - Consumes income calculation

### Affected Systems

- `dmn-audit-tool` screener - Must add Benefits section
- `ssiFormSchema` - Must update to capture benefit receipt
- `library-api` - Types auto-generated from DMN

---

## Constraints & Boundaries

### In Scope

- Extend `tEnrollment` with new optional fields
- Create benefit type taxonomy
- Add income exclusion check
- Modify income calculation to handle exclusions
- Bruno tests for all scenarios

### Out of Scope

- Categorical linkages (SSI→Medicaid) - deferred to referrals sprint
- Benefit amount estimation - user provides amounts
- Offset calculations (WC/PDB offset, windfall) - future work
- NYC/local benefit rules - requires separate research
- Screener UI implementation - separate ticket, but spec'd here

### Assumptions

- User will enter net self-employment income (not gross)
- User knows what benefits they receive and amounts
- Benefit amounts are monthly (consistent with current model)

### Technical Constraints

- Must follow BDT DMN patterns (Decision Service naming, etc.)
- Must maintain backward compatibility with existing tests
- Must work with Kogito's DMN evaluation

---

## Benefit Type Taxonomy

### Cash Benefits (Count as Unearned Income for SSI)

| Code | Display Name | POMS | Notes |
|------|--------------|------|-------|
| `SSDI` | Social Security Disability Insurance | SI 00830 | Title II disability |
| `SSA_RETIREMENT` | Social Security Retirement | SI 00830 | Title II retirement |
| `SSA_SURVIVORS` | Social Security Survivors | SI 00830 | Title II survivors |
| `VA_PENSION` | VA Pension | SI 00830.316 | Needs-based |
| `VA_DISABILITY_COMP` | VA Disability Compensation | SI 00830.316 | Service-connected |
| `WORKERS_COMP` | Workers' Compensation | SI 00830.215 | State WC benefits |
| `RAILROAD_RETIREMENT` | Railroad Retirement | SI 00830 | Similar to SSA |
| `BLACK_LUNG` | Black Lung Benefits | SI 00830.215 | Coal miners |
| `UNEMPLOYMENT` | Unemployment Insurance | SI 00830 | State UI benefits |
| `PRIVATE_PENSION` | Private Pension/Retirement | SI 00830 | 401k, IRA distributions |

### Non-Cash Benefits (Excluded from SSI Income)

| Code | Display Name | POMS | Exclusion Reason |
|------|--------------|------|------------------|
| `SECTION_8` | Section 8 / HUD Housing | SI 00830.630 | Federal housing assistance |
| `SNAP` | SNAP (Food Stamps) | N/A | Not cash income |
| `LIHEAP` | LIHEAP / Energy Assistance | SI 00830 | Energy assistance |
| `WIC` | WIC | N/A | Not cash income |
| `SCHOOL_LUNCH` | Free/Reduced School Lunch | N/A | Not cash income |

### Tracking Only (No Income Effect)

| Code | Display Name | Notes |
|------|--------------|-------|
| `MEDICAID` | Medicaid | Healthcare, not income |
| `MEDICARE` | Medicare | Healthcare, not income |
| `SSI` | SSI | The benefit being evaluated |
| `CHIP` | CHIP | Children's health insurance |

### Special Cases

| Code | Display Name | POMS | Notes |
|------|--------------|------|-------|
| `STATE_VET_ANNUITY` | State Veteran Annuity | SI 00830.260 | Excluded in certain states |
| `DISASTER_RELIEF` | Disaster Relief (FEMA) | SI 00830 | Excluded |

---

## Examples

### Example 1: SSDI Counts as Unearned Income

**Given:** Person receives SSDI at $1,200/month
```json
{
  "enrollments": [
    {"personId": "p1", "benefit": "SSDI", "monthlyAmount": 1200, "status": "RECEIVING"}
  ]
}
```
**When:** Income calculation runs
**Then:** $1,200 added to unearned income, subject to $20 general exclusion

### Example 2: Section 8 is Excluded

**Given:** Person receives Section 8 housing subsidy worth $800/month
```json
{
  "enrollments": [
    {"personId": "p1", "benefit": "SECTION_8", "monthlyAmount": 800, "status": "RECEIVING"}
  ]
}
```
**When:** Income calculation runs
**Then:**
- $800 NOT added to unearned income
- Output includes: `excludedIncome: 800, excludedSources: ["SECTION_8"]`
- Explanation: "Section 8 housing assistance excluded per POMS SI 00830.630"

### Example 3: Mixed Benefits

**Given:** Person receives SSDI ($900), VA pension ($400), and SNAP
```json
{
  "enrollments": [
    {"personId": "p1", "benefit": "SSDI", "monthlyAmount": 900},
    {"personId": "p1", "benefit": "VA_PENSION", "monthlyAmount": 400},
    {"personId": "p1", "benefit": "SNAP"}
  ]
}
```
**When:** Income calculation runs
**Then:**
- Unearned income: $1,300 (SSDI + VA)
- SNAP excluded (not cash income)
- Total countable after exclusions calculated normally

### Example 4: Self-Employment Net Income

**Given:** Person has self-employment income, enters net amount after expenses
```json
{
  "incomeSources": [
    {"type": "earned", "category": "SELF_EMPLOYMENT_NET", "monthlyAmount": 1500}
  ]
}
```
**When:** Income calculation runs
**Then:** $1,500 treated as earned income, standard earned income exclusions apply

### Example 5: Wages Plus Benefits

**Given:** Person works part-time ($800 wages) and receives SSDI ($600)
```json
{
  "enrollments": [
    {"personId": "p1", "benefit": "SSDI", "monthlyAmount": 600}
  ],
  "incomeSources": [
    {"type": "earned", "category": "WAGES", "monthlyAmount": 800}
  ]
}
```
**When:** Income calculation runs
**Then:**
- Earned: $800 (wages)
- Unearned: $600 (SSDI from enrollment)
- Standard exclusion order applies

---

## Open Questions

- [x] Should benefits be in `enrollments[]` or `incomeSources[]`? → **Enrollments**
- [x] How granular should benefit types be? → **Granular for UX, can group for calculation**
- [x] How to handle self-employment? → **User enters net, clear naming**
- [ ] State veteran annuity varies by state - do we need state logic? → **Defer, note for future**

---

## Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-26 | Claude + Nick | Initial spec from research conversation |
