# Benefits Program Interactions Framework

**Date:** 2026-01-23
**Updated:** 2026-01-26
**Status:** Research Complete → See Implementation Specs
**Author:** Claude Code (with POMS research)

> **NOTE**: This document contains the research and analysis. For implementation details, see:
> - `specs/INCOME-INTERACTIONS-SPEC.md` - Income counting interactions (approved)
> - `specs/RELATED-BENEFITS-REFERRALS.md` - Categorical linkages (future sprint)
> - `tickets/INCOME-INTERACTIONS-TICKETS.md` - Implementation tickets

---

## Executive Summary

This document analyzes how different benefits programs interact with SSI and SSDI, and proposes a technical framework for encoding these interactions in BDT. The goal is to move beyond simple yes/no eligibility checks to model the complex web of how benefits affect each other.

---

## Part 1: Taxonomy of Benefits Interactions

Based on POMS research, benefits programs interact in **six distinct ways**:

### 1. Income Treatment Interactions

**Definition:** How receipt of one benefit affects countable income for another benefit.

| Source Benefit | Target Benefit | Treatment | POMS Reference |
|----------------|----------------|-----------|----------------|
| SSDI | SSI | **Counts as unearned income** | SI 00830 |
| VA pension | SSI | **Counts as unearned income** | SI 00830.316 |
| VA disability comp | SSI | **Counts as unearned income** | SI 00510.005 |
| Workers' Comp | SSI | **Counts as unearned income** | SI 00830.215 |
| Black Lung | SSI | **Counts as unearned income** | SI 00830.215 |
| Section 8/HUD | SSI | **EXCLUDED** (statutory) | SI 00830.630 |
| SNAP | SSI | **EXCLUDED** (not cash) | N/A |
| State vet annuities | SSI | **EXCLUDED** (specific states) | SI 00830.260 |
| LIHEAP | SSI | **EXCLUDED** | SI 00830 |
| State supplement | SSI | Part of benefit (not income) | SI 01401 |

**Key Insight:** Most government benefits count as unearned income for SSI, but certain needs-based assistance (housing, food) is explicitly excluded.

### 2. Offset/Reduction Interactions

**Definition:** When one benefit directly reduces another's payment amount.

| Trigger Benefit | Affected Benefit | Offset Type | POMS Reference |
|-----------------|------------------|-------------|----------------|
| Workers' Compensation | SSDI | WC/PDB Offset | DI 52101.001 |
| Public Disability Benefits | SSDI | WC/PDB Offset | DI 52101.001 |
| SSI (retroactive) | SSDI (retroactive) | Windfall Offset | SI 02000 |
| SSDI (retroactive) | SSI (retroactive) | Windfall Offset | SI 00601.035 |

**Key Insight:** Offset rules prevent "double-dipping" when multiple programs cover the same risk. The WC/PDB offset caps total benefits at 80% of pre-disability earnings.

### 3. Categorical Linkages

**Definition:** Eligibility for one benefit automatically confers eligibility for another.

| Source Benefit | Target Benefit | Conditions | Notes |
|----------------|----------------|------------|-------|
| SSI | Medicaid | "SSI criteria" states | Automatic enrollment |
| SSI | Medicaid | "209(b)" states | More restrictive criteria |
| SSDI (24+ mo) | Medicare | All states | After 24-month waiting period |
| ALS/ESRD diagnosis | Medicare | All states | No waiting period |

**Key Insight:** Categorical linkages are state-dependent. Most states use "SSI criteria" (automatic Medicaid with SSI), but 11 "209(b) states" apply more restrictive rules.

**209(b) States (as of 2025):** CT, HI, IL, IN, MN, MO, NH, ND, OH, OK, VA

### 4. Concurrent Receipt

**Definition:** Scenarios where someone can receive multiple benefits simultaneously.

| Benefit Combination | Condition | Common Scenario |
|---------------------|-----------|-----------------|
| SSI + SSDI | SSDI < FBR | Low earner becomes disabled young |
| SSI + VA pension | With income counting | Aged veteran with limited work history |
| SSI + SNAP | Always allowed | "Pure SSI household" eligible |
| SSDI + Medicare + Medicaid | QMB/SLMB eligible | Medicare beneficiary with low income |

**Key Insight:** SSI/SSDI concurrent receipt happens when SSDI is low (often due to limited work history). SSDI counts as unearned income but may not fully offset SSI.

### 5. Sequential/Triggering Interactions

**Definition:** One benefit triggers action related to another benefit.

| Trigger Event | Triggered Action | Timing |
|---------------|------------------|--------|
| SSI application | SNAP screening offer | At application |
| SSI redetermination | SNAP screening offer | At scheduled RZ |
| SSDI entitlement | Medicare enrollment | After 24 months |
| SSDI cessation | Medicare continuation | 7 years (if working) |
| SSI eligibility | 1619(b) Medicaid | When working |

**POMS Reference:** SI 01801.010 (SNAP screening)

**Key Insight:** SSA has procedural requirements to screen SSI applicants for SNAP eligibility. This is an administrative linkage, not an eligibility rule.

### 6. Resource Treatment Interactions

**Definition:** How one benefit affects resource counting for another.

| Resource Source | Target Benefit | Treatment |
|-----------------|----------------|-----------|
| ABLE account (up to $100k) | SSI | **EXCLUDED** |
| PASS plan resources | SSI | **EXCLUDED** |
| Burial funds (up to $1,500) | SSI | **EXCLUDED** |
| Life insurance (face value < $1,500) | SSI | **EXCLUDED** |
| Retroactive SSDI payment | SSI | Excluded for 9 months |

**Key Insight:** Resource treatment is critical for SSI eligibility. Several special accounts and benefit types are excluded to encourage work/savings without losing SSI.

---

## Part 2: Research Gaps (Require Further Investigation)

### NYC HRA Benefits
Local benefits like Cash Assistance, SNAP (via HRA), One Shot Deals need research:
- How do they count as income for SSI?
- Are there NYC-specific exclusions?
- What is the data source for HRA benefit rules?

**Research approach:** NYC HRA policy manuals, not POMS (federal rules won't cover local programs)

### State Supplements
Each state can add to federal SSI. New York has supplements:
- How are state supplements structured?
- Do they affect other benefit eligibility?

**Research approach:** SI 01401 (State Supplements) and NY-specific POMS sections

### Medicare Savings Programs (QMB, SLMB, QI)
These help pay Medicare premiums for low-income beneficiaries:
- Eligibility criteria
- Interaction with SSI/SSDI

**Research approach:** Medicare POMS sections, CMS guidance

---

## Part 3: Technical Framework Proposal

### Current BDT Data Model Limitations

The current `tSituation` model handles basic eligibility well but lacks:
1. **Cross-benefit awareness** - No way to know what benefits someone currently receives
2. **Income source typing** - `tIncomeSource.type` exists but isn't used for interaction rules
3. **Offset calculations** - No mechanism for computing benefit reductions
4. **Categorical derivation** - No way to auto-derive Medicaid from SSI

### Proposed Extensions

#### Option A: Enhanced Enrollment Model (Recommended)

Extend `tEnrollment` to track benefit receipt with more detail:

```
tEnrollment {
  personId: string
  benefit: string       // "SSI", "SSDI", "SNAP", "SECTION_8", "MEDICAID", etc.
  status: string        // "RECEIVING", "PENDING", "APPROVED", "DENIED"
  startDate: date       // When benefit started
  monthlyAmount: number // Optional - amount if applicable
  entitlementMonths: number // For SSDI→Medicare calculation
}
```

**Benefits:**
- Uses existing enrollment structure
- Can query `situation.enrollments[benefit = "SSDI"]`
- Supports historical tracking

#### Option B: Dedicated Benefits Context

Add a new top-level context for current benefit status:

```
tSituation {
  // existing fields...

  currentBenefits: tBenefitsContext {
    ssi: {
      receiving: boolean
      monthlyAmount: number
      stateSupplementAmount: number
    }
    ssdi: {
      receiving: boolean
      monthlyAmount: number
      entitlementDate: date
      monthsReceiving: number
    }
    snap: { receiving: boolean }
    medicaid: {
      receiving: boolean
      basis: string  // "SSI", "EXPANSION", "QMB", etc.
    }
    medicare: {
      receiving: boolean
      partA: boolean
      partB: boolean
    }
    section8: { receiving: boolean }
    va: {
      receiving: boolean
      monthlyAmount: number
      type: string  // "PENSION", "DISABILITY_COMP"
    }
    workersComp: {
      receiving: boolean
      monthlyAmount: number
    }
  }
}
```

**Benefits:**
- Explicit structure for known benefits
- Type safety for benefit-specific fields
- Cleaner querying (`situation.currentBenefits.ssdi.receiving`)

**Drawbacks:**
- Rigid structure - new benefits require schema changes
- May duplicate information from enrollments/incomeSources

#### Option C: Interaction Rules Layer (Advanced)

Create a separate DMN layer specifically for interaction rules:

```
/src/main/resources/
  interactions/
    income-effects/
      ssdi-to-ssi-income.dmn    # SSDI counts as unearned income
      va-to-ssi-income.dmn      # VA pension counts as unearned income
      excluded-income.dmn       # Housing/SNAP exclusions
    categorical/
      ssi-to-medicaid.dmn       # SSI → Medicaid categorical eligibility
      ssdi-to-medicare.dmn      # SSDI → Medicare after 24 months
    offsets/
      wc-ssdi-offset.dmn        # Workers' Comp offset calculation
      windfall-offset.dmn       # SSI/SSDI windfall offset
    concurrent/
      ssi-ssdi-concurrent.dmn   # Calculate combined SSI+SSDI
```

**Benefits:**
- Maximum modularity
- Clear separation of concerns
- Each interaction rule is testable independently

**Drawbacks:**
- More complex architecture
- May require orchestration layer

### Recommended Approach: Hybrid

I recommend combining Options A and C:

1. **Extend enrollments** (Option A) for basic benefit tracking
2. **Create interaction rules** (Option C) as needed for specific use cases
3. **Start simple** with income counting, add offsets later

#### Implementation Phases

**Phase 1: Income Counting (High Value, Low Complexity)**
- Extend `tIncomeSource.type` to include benefit sources
- Create checks for "is income excluded" based on source
- Integrate into SSI income limit calculation

```feel
// Example: Check if income source is excluded for SSI
incomeSource.type in ["SECTION_8", "SNAP", "LIHEAP"] or
(incomeSource.type = "VA_STATE_ANNUITY" and ...)
```

**Phase 2: Categorical Linkages (Medium Value, Medium Complexity)**
- Create `ssi-to-medicaid.dmn` check
- Handle 209(b) vs SSI-criteria states
- Add Medicare derivation from SSDI

**Phase 3: Offset Calculations (Low Initial Value, High Complexity)**
- WC/PDB offset formula
- Windfall offset logic
- Requires payment calculation infrastructure

**Phase 4: Concurrent Benefits Advisor (Exploratory)**
- "What if" scenario modeling
- "You might also be eligible for..." suggestions
- Requires benefit amount estimation

---

## Part 4: Proposed Checks and Benefits

### New Checks to Implement

| Check Name | Category | Purpose | Priority |
|------------|----------|---------|----------|
| `is-income-excluded-for-ssi` | income | Determine if income source is excluded | HIGH |
| `person-receiving-benefit` | enrollment | Check if person receives specific benefit | HIGH |
| `ssi-concurrent-with-ssdi` | categorical | Check if eligible for both SSI and SSDI | MEDIUM |
| `ssdi-medicare-eligible` | categorical | Check if SSDI recipient qualifies for Medicare | MEDIUM |
| `ssi-medicaid-categorical` | categorical | Check if SSI recipient gets auto-Medicaid | MEDIUM |
| `wc-pdb-offset-applies` | offset | Determine if WC/PDB offset applies | LOW |

### New Benefits to Consider

| Benefit | Jurisdiction | Interactions |
|---------|--------------|--------------|
| NY Medicaid | ny | Categorical from SSI, income-based |
| SNAP | federal | Excluded from SSI income, Pure SSI HH |
| LIHEAP | federal | Excluded from SSI income |
| Medicare Savings (QMB) | federal | SSI-related income limits |

---

## Part 5: Data Requirements

To implement the interaction framework, the screener UI needs to collect:

### Already Collected (via tIncomeSource)
- [x] Gross wages (earned income)
- [x] Monthly amounts
- [x] Income type/category

### Needs to be Added
- [ ] **Benefit receipt status** - Currently receiving SSDI? VA? WC?
- [ ] **Benefit amounts** - How much per month from each source?
- [ ] **Benefit start dates** - When did SSDI start? (for Medicare)
- [ ] **State of residence** - For Medicaid categorical rules

### Data Source Questions for Nick
1. Do we want to track current benefit receipt in `tEnrollment` or create a new structure?
2. For income sources, should we require specifying if it's a government benefit vs. other?
3. How detailed do we need benefit history (just current, or historical)?

---

## Part 6: POMS Sections for Further Research

### SSI Income Exclusions
- SI 00830.630 - Federal Housing Assistance
- SI 00830.260 - State Veteran Annuities
- SI 00810.007 - Income Exclusions (general)
- SI 00830.316 - VA Benefits (Ninth Circuit)

### Categorical Eligibility
- SI 01701 - Medicaid and the SSI Program
- SI CHI01150.109 - 209(b) States

### Offsets
- DI 52101.001 - WC/PDB Offset Provisions
- SI 02004.120 - Immediate Payments in Concurrent Cases
- SI 00601.035 - Windfall Offset Procedures

### SNAP Interaction
- SI 01801.010 - SNAP Screening for SSI
- SI 01801.005 - Pure SSI Household definition

---

## Next Steps

1. **Review this framework** with Nick for alignment on priorities
2. **Choose data model approach** (Option A, B, or hybrid)
3. **Implement Phase 1** - Income counting interactions
4. **Research NYC HRA** - Local benefit rules (outside POMS scope)
5. **Create test scenarios** - For interaction edge cases

---

## Appendix: Quick Reference Tables

### Which Benefits Count as SSI Income?

| Benefit | Counts as Income? | Type | Notes |
|---------|-------------------|------|-------|
| SSDI | Yes | Unearned | Dollar-for-dollar after $20 exclusion |
| VA Pension | Yes | Unearned | |
| VA Disability Comp | Yes | Unearned | |
| Workers' Comp | Yes | Unearned | |
| Railroad Retirement | Yes | Unearned | |
| Private pension | Yes | Unearned | |
| Section 8 subsidy | **No** | Excluded | Statutory exclusion |
| SNAP | **No** | Excluded | Not cash |
| LIHEAP | **No** | Excluded | Energy assistance |
| State vet annuities | **No** | Excluded | Specific states |
| Disaster relief | **No** | Excluded | FEMA, etc. |

### Categorical Linkages Summary

```
SSI Recipient
    │
    ├─→ Medicaid (most states - automatic)
    │      └─ 209(b) states: CT, HI, IL, IN, MN, MO, NH, ND, OH, OK, VA
    │
    └─→ SNAP screening (offered at application/RZ)

SSDI Recipient
    │
    ├─→ Medicare (after 24-month wait)
    │      └─ No wait for ALS or ESRD
    │
    └─→ Medicaid (if also low income - QMB/SLMB/QI)
```
