# Related Benefits Referrals - Stub Spec

**Status:** Future Sprint
**Priority:** Deferred
**Created:** 2026-01-26
**Updated:** 2026-01-26

---

## Overview

This feature will suggest related benefits when a user is found eligible (or potentially eligible) for SSI or SSDI. It leverages categorical linkages and program interactions to provide a "You may also be eligible for..." experience.

**Prerequisite:** This spec depends on the Income Interactions feature (see `INCOME-INTERACTIONS-SPEC.md`) which extends `tEnrollment` to track current benefit receipt with amounts and dates.

---

## Problem Statement

When someone is found eligible for SSI or SSDI, they're often eligible for related benefits (Medicaid, SNAP, Medicare). Currently, the screener only evaluates the requested benefit without surfacing these connections. Caseworkers and claimants miss opportunities because the system doesn't highlight categorical linkages.

---

## Scope

### In Scope (Future)

1. **Categorical Linkages**
   - SSI → Medicaid (automatic in most states)
   - SSI → SNAP screening recommendation
   - SSDI (24+ months) → Medicare
   - Handle 209(b) state exceptions for Medicaid

2. **NYC/Local Benefits**
   - NYC HRA Cash Assistance
   - NYC SNAP (administered by HRA)
   - One Shot Deals
   - HEAP/LIHEAP
   - Section 8 / NYCHA housing

3. **Related Federal Benefits**
   - Medicare Savings Programs (QMB, SLMB, QI)
   - Extra Help (Medicare Part D)
   - LIHEAP

### Out of Scope

- Offset/reduction calculations (WC/PDB, windfall)
- Benefit amount estimation
- Application assistance / form filling
- Appointment scheduling

---

## Technical Approach (Preliminary)

### Data Requirements

Need to collect:
- State of residence (for 209(b) detection)
- Current benefit receipt status (via tEnrollment)
- Duration of benefit receipt (for SSDI → Medicare)

### Proposed DMN Structure

```
/src/main/resources/
  referrals/
    ssi-related-benefits.dmn      # Given SSI eligible, suggest related
    ssdi-related-benefits.dmn     # Given SSDI eligible, suggest related
    categorical-linkages.dmn      # Core categorical rules
```

### Response Format

```json
{
  "primaryEligibility": {
    "benefit": "SSI",
    "isEligible": true
  },
  "relatedBenefits": [
    {
      "benefit": "Medicaid",
      "likelihood": "automatic",     // automatic, likely, possible
      "basis": "SSI categorical eligibility",
      "notes": "In NY, SSI recipients automatically qualify for Medicaid"
    },
    {
      "benefit": "SNAP",
      "likelihood": "likely",
      "basis": "Pure SSI household",
      "notes": "SSA will offer SNAP screening at application"
    }
  ]
}
```

---

## Research Required

### NYC HRA Benefits

Data sources needed:
- NYC HRA policy manuals
- ACCESS HRA eligibility rules
- Cash Assistance income/resource limits (differ from SSI)

Key questions:
- How do HRA benefits count as income for SSI?
- What are the categorical linkages between HRA programs?
- Are there NYC-specific exclusions from SSI income?

### State-Specific Rules

Need to research:
- NY state supplement structure and amounts
- NY Medicaid rules (1634 state, SSI criteria)
- NYC additional Medicaid coverage

### Medicare Savings Programs

Need to research (CMS guidance):
- QMB eligibility criteria (pays Medicare premiums)
- SLMB eligibility criteria
- QI eligibility criteria
- How these interact with SSI/SSDI

---

## Dependencies

Before implementing:
- [ ] Income counting interactions complete (current sprint)
- [ ] tEnrollment extended with benefit amounts and dates
- [ ] NYC HRA research complete
- [ ] State supplement research complete

---

## POMS References (Bookmark)

- SI 01701 - Medicaid and SSI
- SI CHI01150.109 - 209(b) States
- SI 01801.010 - SNAP Screening
- SI 01401 - State Supplements

---

## Notes

This spec intentionally deferred to focus on income counting interactions first, which directly support the current eligibility screening mission. Categorical linkages are valuable for user experience but are secondary to accurate eligibility determination.

---

**Next Steps When Sprint Starts:**
1. Deep research on NYC HRA benefit rules
2. Research Medicare Savings Programs
3. Design referral response schema
4. Implement categorical linkage checks
5. Create referral aggregation benefit
