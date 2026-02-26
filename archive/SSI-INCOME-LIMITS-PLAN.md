# SSI Income Limits - Full Implementation Plan

## Overview

Implement complete SSI countable income calculation with earned/unearned income exclusions following POMS SI 00810.000 - SI 00830.000, comparing result against Federal Benefit Rate (FBR).

**Goal**: Accept income sources from the user, automatically apply POMS exclusion rules in correct order, calculate countable income, and check against FBR limit.

---

## POMS Research Summary

### Key POMS Sections Retrieved

**Main sections:**
- SI 00810.000 - General Income Rules for SSI
- SI 00810.420 - $20 Per Month General Income Exclusion
- SI 00820.500 - Earned Income Exclusions General
- SI 00830.000 - Unearned Income for SSI

**Key findings from POMS API research:**

1. **$20 General Income Exclusion**:
   - Applied to ANY income (earned or unearned)
   - Applied first to unearned income
   - If unearned income < $20, remainder can be applied to earned income

2. **Earned Income Exclusions** (applied in order):
   - $65 exclusion (after any unused portion of $20 general exclusion)
   - One-half of remaining earned income excluded

3. **Calculation Formula**:
   ```
   Step 1: Unearned Income
     Total Unearned Income
     - $20 general exclusion
     = Countable Unearned Income

   Step 2: Earned Income
     Total Earned Income
     - Unused portion of $20 general exclusion (if any)
     - $65 earned income exclusion
     - 50% of remainder
     = Countable Earned Income

   Step 3: Total
     Countable Unearned + Countable Earned = Total Countable Income

   Step 4: Compare to Limit
     Total Countable Income < FBR (Federal Benefit Rate)
   ```

4. **Federal Benefit Rate (FBR)** (2025):
   - Individual: $967/month
   - Couple: $1,450/month
   - **Note**: FBR changes annually, should be configurable

5. **Additional Exclusions** (deferred to future):
   - Student Earned Income Exclusion (SEIE): Up to $2,290/month, $9,230/year for students
   - Plan to Achieve Self-Support (PASS): Income set aside for approved self-support plan
   - Infrequent or Irregular Income: Up to $30/month unearned, $65/month earned (if infrequent)
   - Impairment-Related Work Expenses (IRWE): Costs related to working with a disability

---

## Phase 1: Research & Data Modeling

### 1.1 Extended POMS Research (Completed Above)

Key findings documented in POMS Research Summary above.

### 1.2 Data Model Design

**Add to BDT.dmn:**

```xml
<!-- Income source type definition -->
<dmn:itemDefinition id="_income_type" name="tIncomeSource" isCollection="false">
  <dmn:itemComponent id="_income_id" name="id" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_income_source_type" name="type" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
    <!-- Values: "earned" or "unearned" -->
  </dmn:itemComponent>
  <dmn:itemComponent id="_income_category" name="category" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
    <!-- For earned: "wages", "self_employment"
         For unearned: "social_security", "pension", "interest", "dividend", "rental", "support", "other" -->
  </dmn:itemComponent>
  <dmn:itemComponent id="_income_amount" name="monthlyAmount" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_income_description" name="description" isCollection="false">
    <dmn:typeRef>string</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_income_is_infrequent" name="isInfrequentOrIrregular" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
</dmn:itemDefinition>

<dmn:itemDefinition id="_income_list" name="tIncomeSourceList" isCollection="true">
  <dmn:typeRef>tIncomeSource</dmn:typeRef>
</dmn:itemDefinition>

<!-- Income calculation result -->
<dmn:itemDefinition id="_income_calc_result" name="tIncomeCalculation" isCollection="false">
  <dmn:itemComponent id="_calc_total_earned" name="totalEarnedIncome" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_total_unearned" name="totalUnearnedIncome" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_general_exclusion" name="generalExclusionApplied" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_earned_exclusion" name="earnedIncomeExclusionApplied" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_countable_unearned" name="countableUnearnedIncome" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_countable_earned" name="countableEarnedIncome" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_countable_total" name="totalCountableIncome" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_fbr" name="applicableFBR" isCollection="false">
    <dmn:typeRef>number</dmn:typeRef>
  </dmn:itemComponent>
  <dmn:itemComponent id="_calc_meets_limit" name="meetsIncomeLimit" isCollection="false">
    <dmn:typeRef>boolean</dmn:typeRef>
  </dmn:itemComponent>
</dmn:itemDefinition>
```

**Update tPerson in BDT.dmn:**
```xml
<!-- Add income sources to person -->
<dmn:itemComponent id="_person_income_sources" name="incomeSources" isCollection="false">
  <dmn:typeRef>tIncomeSourceList</dmn:typeRef>
</dmn:itemComponent>
```

---

## Phase 2: DMN Architecture

### 2.1 Create Base Module: Income.dmn

**Location**: `src/main/resources/checks/income/Income.dmn`

**Purpose**: Define income-related types and shared BKMs

**Content:**
- Import BDT.dmn
- Define income types (tIncomeSource, tIncomeSourceList, tIncomeCalculation)
- BKM: `sum income by type` - Calculate total for earned or unearned
- BKM: `filter income by category` - Filter by specific categories
- BKM: `apply general exclusion` - Apply $20 to unearned first, track remainder

### 2.2 Income Calculation Check: `calculate-countable-income.dmn`

**Location**: `src/main/resources/checks/income/calculate-countable-income.dmn`

**Purpose**: Apply all income exclusions in correct POMS order and calculate countable income

**Inputs:**
- situation (tSituation)
- parameters (context with personId, FBR value)

**Output:**
- incomeCalculation (tIncomeCalculation)

**Logic (context-based decision):**
```feel
{
  // Step 1: Extract person and their income sources
  person: situation.people[id = parameters.personId][1],
  incomeSources: person.incomeSources,

  // Step 2: Separate earned vs. unearned income
  earnedIncome: for i in incomeSources return if i.type = "earned" then i.monthlyAmount else 0,
  unearnedIncome: for i in incomeSources return if i.type = "unearned" then i.monthlyAmount else 0,

  totalEarnedIncome: sum(earnedIncome),
  totalUnearnedIncome: sum(unearnedIncome),

  // Step 3: Apply $20 general exclusion to unearned income first
  generalExclusionToUnearned: if totalUnearnedIncome >= 20 then 20 else totalUnearnedIncome,
  unusedGeneralExclusion: if totalUnearnedIncome < 20 then 20 - totalUnearnedIncome else 0,

  // Step 4: Calculate countable unearned income
  countableUnearnedIncome: if totalUnearnedIncome > 20
                          then totalUnearnedIncome - 20
                          else 0,

  // Step 5: Apply exclusions to earned income
  // First: Apply unused general exclusion (if any)
  earnedAfterGeneralExclusion: if totalEarnedIncome > unusedGeneralExclusion
                               then totalEarnedIncome - unusedGeneralExclusion
                               else 0,

  // Second: Apply $65 earned income exclusion
  earnedAfter65Exclusion: if earnedAfterGeneralExclusion > 65
                         then earnedAfterGeneralExclusion - 65
                         else 0,

  // Third: Exclude 50% of remainder
  countableEarnedIncome: earnedAfter65Exclusion / 2,

  // Track total exclusions applied
  earnedExclusionApplied: totalEarnedIncome - countableEarnedIncome,

  // Step 6: Calculate total countable income
  totalCountableIncome: countableUnearnedIncome + countableEarnedIncome,

  // Step 7: Determine applicable FBR (from parameters or default to individual rate)
  applicableFBR: if parameters.FBR != null then parameters.FBR else 967,

  // Step 8: Check if meets income limit
  meetsIncomeLimit: totalCountableIncome < applicableFBR,

  // Step 9: Return full calculation
  result: {
    totalEarnedIncome: totalEarnedIncome,
    totalUnearnedIncome: totalUnearnedIncome,
    generalExclusionApplied: generalExclusionToUnearned + unusedGeneralExclusion,
    earnedIncomeExclusionApplied: earnedExclusionApplied,
    countableUnearnedIncome: countableUnearnedIncome,
    countableEarnedIncome: countableEarnedIncome,
    totalCountableIncome: totalCountableIncome,
    applicableFBR: applicableFBR,
    meetsIncomeLimit: meetsIncomeLimit
  }
}
```

### 2.3 Create `ssi-income-limit.dmn`

**Location**: `src/main/resources/checks/income/ssi-income-limit.dmn`

**Purpose**: Wrapper check that calls calculate-countable-income and extracts boolean result

**Inputs:**
- situation (tSituation)
- parameters (context with personId, optional FBR)

**Output:**
- checkResult (boolean)

**Logic:**
```feel
{
  // Calculate countable income
  calculation: CalculateCountableIncome.CalculateCountableIncomeService(situation, parameters),

  // Extract result
  result: calculation.meetsIncomeLimit
}
```

### 2.4 Update `ssi-eligibility.dmn`

**Import SsiIncomeLimit:**
```xml
<dmn:import
  id="_import_income"
  name="SsiIncomeLimit"
  namespace="https://kie.apache.org/dmn/[NAMESPACE_ID]"
  locationURI="../../checks/income/ssi-income-limit.dmn"
  importType="http://www.omg.org/spec/DMN/20180521/MODEL/"/>
```

**Add to checks context:**
```xml
<!-- Income eligibility check -->
<dmn:contextEntry>
  <dmn:variable id="_var_income" name="incomeEligible" typeRef="boolean"/>
  <dmn:invocation id="_invoke_income">
    <dmn:literalExpression id="_invoke_income_expr">
      <dmn:text>SsiIncomeLimit.SsiIncomeLimitService</dmn:text>
    </dmn:literalExpression>
    <dmn:binding>
      <dmn:parameter id="_param_income_situation" name="situation" typeRef="BDT.tSituation"/>
      <dmn:literalExpression id="_bind_income_situation">
        <dmn:text>situation</dmn:text>
      </dmn:literalExpression>
    </dmn:binding>
    <dmn:binding>
      <dmn:parameter id="_param_income_parameters" name="parameters" typeRef="SsiIncomeLimit.tParameters"/>
      <dmn:context id="_bind_income_parameters">
        <dmn:contextEntry>
          <dmn:variable id="_param_income_personId" name="personId" typeRef="string"/>
          <dmn:literalExpression id="_param_income_personId_expr">
            <dmn:text>situation.primaryPersonId</dmn:text>
          </dmn:literalExpression>
        </dmn:contextEntry>
        <dmn:contextEntry>
          <dmn:variable id="_param_income_fbr" name="FBR" typeRef="number"/>
          <dmn:literalExpression id="_param_income_fbr_expr">
            <dmn:text>967</dmn:text>  <!-- 2025 individual FBR -->
          </dmn:literalExpression>
        </dmn:contextEntry>
      </dmn:context>
    </dmn:binding>
  </dmn:invocation>
</dmn:contextEntry>
```

---

## Phase 3: Testing Strategy

### 3.1 Unit Tests - Income Calculation

`test/bdt/checks/income/CalculateCountableIncome/`

**Basic calculations:**
- `Pass - No income.bru`
  - Empty income sources → $0 countable → true
- `Pass - Unearned only below limit.bru`
  - Unearned $500 → $480 countable ($500 - $20) → true
- `Pass - Earned only below limit.bru`
  - Earned $1000 → $438 countable (($1000 - $20 - $65) / 2) → true
- `Fail - Unearned above limit.bru`
  - Unearned $1000 → $980 countable → false
- `Fail - Earned above limit.bru`
  - Earned $3000 → $1958 countable → false (over $967)

**Combined income:**
- `Pass - Mixed income below limit.bru`
  - Unearned $200 + Earned $1000
  - Countable unearned: $200 - $20 = $180
  - Countable earned: (($1000 - $65) / 2) = $468
  - Total: $648 → true
- `Fail - Mixed income above limit.bru`
  - Unearned $500 + Earned $2000
  - Countable unearned: $480
  - Countable earned: $968
  - Total: $1448 → false

**General exclusion spillover:**
- `Pass - Unearned below $20, applies remainder to earned.bru`
  - Unearned $10 + Earned $1000
  - Unearned uses $10 of general exclusion → $0 countable unearned
  - Earned gets remaining $10 of general exclusion: (($1000 - $10 - $65) / 2) = $463
  - Total: $463 → true

**Edge cases:**
- `Edge Case - Exactly at $20 unearned.bru`
  - Unearned $20 → $0 countable (exactly excluded by general exclusion)
- `Edge Case - Exactly at $65 earned (after general).bru`
  - Earned $65 → $0 countable (exactly excluded after general exclusion)
- `Edge Case - Null income sources.bru`
  - No incomeSources field → treat as $0 income → true

### 3.2 Integration Tests - SSI Income Limit Check

`test/bdt/checks/income/SsiIncomeLimit/`

- Update tests to use new income source structure
- Test various income scenarios
- Test FBR parameter (individual vs. couple rates)

### 3.3 End-to-End Tests - SSI Eligibility

`test/bdt/benefits/federal/SsiEligibility/`

- Add income to existing comprehensive scenarios
- Test all 5 eligibility requirements together

---

## Phase 4: Form Updates

### 4.1 Update SSI Screener Form Schema

**Location**: `builder-frontend/src/components/ssi-screener/ssiFormSchema.json`

**Add income collection:**

```json
{
  "type": "group",
  "id": "incomeGroup",
  "label": "Income",
  "components": [
    {
      "type": "checklist",
      "id": "incomeTypes",
      "label": "Do you receive any of the following types of income?",
      "values": [
        { "label": "Wages from employment", "value": "earned_wages" },
        { "label": "Self-employment income", "value": "earned_self_employment" },
        { "label": "Social Security benefits", "value": "unearned_social_security" },
        { "label": "Pension or retirement", "value": "unearned_pension" },
        { "label": "Interest or dividends", "value": "unearned_investment" },
        { "label": "Rental income", "value": "unearned_rental" },
        { "label": "Child support or alimony", "value": "unearned_support" },
        { "label": "Other income", "value": "other" }
      ]
    },
    {
      "type": "dynamiclist",
      "id": "incomeSources",
      "label": "Income Sources",
      "description": "Provide details for each source of income",
      "conditional": {
        "hide": "=count(incomeTypes) = 0"
      },
      "components": [
        {
          "type": "select",
          "id": "type",
          "label": "Income Type",
          "values": [
            { "label": "Earned (from work)", "value": "earned" },
            { "label": "Unearned (not from work)", "value": "unearned" }
          ],
          "validate": {
            "required": true
          }
        },
        {
          "type": "select",
          "id": "category",
          "label": "Category",
          "values": [
            { "label": "Wages", "value": "wages" },
            { "label": "Self-employment", "value": "self_employment" }
          ],
          "conditional": {
            "hide": "=type != 'earned'"
          },
          "validate": {
            "required": true
          }
        },
        {
          "type": "select",
          "id": "category",
          "label": "Category",
          "values": [
            { "label": "Social Security", "value": "social_security" },
            { "label": "Pension/Retirement", "value": "pension" },
            { "label": "Interest/Dividends", "value": "interest" },
            { "label": "Rental Income", "value": "rental" },
            { "label": "Child Support/Alimony", "value": "support" },
            { "label": "Other", "value": "other" }
          ],
          "conditional": {
            "hide": "=type != 'unearned'"
          },
          "validate": {
            "required": true
          }
        },
        {
          "type": "number",
          "id": "monthlyAmount",
          "label": "Monthly Amount",
          "description": "Average monthly amount in dollars",
          "validate": {
            "required": true,
            "min": 0
          }
        },
        {
          "type": "textfield",
          "id": "description",
          "label": "Description",
          "description": "Brief description (e.g., 'Part-time job at grocery store', 'Pension from previous employer')"
        },
        {
          "type": "checkbox",
          "id": "isInfrequentOrIrregular",
          "label": "Is this income infrequent or irregular? (Received inconsistently or rarely)"
        }
      ]
    },
    {
      "type": "html",
      "id": "incomeExplanation",
      "content": "<p><strong>Note:</strong> We will automatically apply SSI income exclusions including:<ul><li>$20 general income exclusion</li><li>$65 earned income exclusion</li><li>50% of remaining earned income excluded</li></ul></p>"
    }
  ]
}
```

### 4.2 Update Data Transformation

**Location**: `builder-frontend/src/components/ssi-screener/ssiUtils.ts`

**Update `transformFormDataToSituation` function:**

```typescript
people: [{
  id: "p1",
  // ... existing fields ...
  incomeSources: formData.incomeSources?.map((income: any) => ({
    id: uuidv4(),
    type: income.type, // "earned" or "unearned"
    category: income.category,
    monthlyAmount: income.monthlyAmount,
    description: income.description || null,
    isInfrequentOrIrregular: income.isInfrequentOrIrregular || false
  })) || []
}]
```

---

## Phase 5: Implementation Checklist

### 5.1 Backend (library-api)

- [ ] **Data Model**
  - [ ] Add tIncomeSource type to BDT.dmn
  - [ ] Add tIncomeSourceList type to BDT.dmn
  - [ ] Add tIncomeCalculation type to BDT.dmn
  - [ ] Add incomeSources field to tPerson

- [ ] **Create Base Module**
  - [ ] Create Income.dmn with shared BKMs

- [ ] **Income Calculation**
  - [ ] Create calculate-countable-income.dmn with POMS-compliant logic
  - [ ] Implement $20 general exclusion
  - [ ] Implement $65 earned income exclusion
  - [ ] Implement 50% earned income exclusion
  - [ ] Handle exclusion spillover (unearned to earned)

- [ ] **Income Limit Check**
  - [ ] Create ssi-income-limit.dmn wrapper

- [ ] **Update SSI Eligibility**
  - [ ] Import SsiIncomeLimit into ssi-eligibility.dmn
  - [ ] Add incomeEligible to checks context
  - [ ] Update isEligible to include income check
  - [ ] Update descriptions

- [ ] **DMN Validation**
  - [ ] Run mvn clean compile
  - [ ] Verify all DMN files validate without errors

### 5.2 Testing

- [ ] **Unit Tests - Income Calculation**
  - [ ] No income test
  - [ ] Unearned only tests (Pass, Fail)
  - [ ] Earned only tests (Pass, Fail)
  - [ ] Mixed income tests (Pass, Fail)
  - [ ] General exclusion spillover test
  - [ ] Edge cases (exactly $20, exactly $65, null)

- [ ] **Integration Tests - Income Limit**
  - [ ] SsiIncomeLimit tests with various scenarios
  - [ ] Test FBR parameter (967 individual, 1450 couple)

- [ ] **End-to-End Tests - SSI Eligibility**
  - [ ] Update existing tests to include income
  - [ ] Comprehensive scenario with all 5 requirements

- [ ] **Run all tests**
  - [ ] cd test/bdt && bru run checks/income
  - [ ] cd test/bdt && bru run benefits/federal/SsiEligibility

### 5.3 Frontend (builder-frontend)

- [ ] **Update Form Schema**
  - [ ] Add income types checklist
  - [ ] Add incomeSources dynamic list
  - [ ] Add conditional category fields
  - [ ] Add income explanation HTML

- [ ] **Update Data Transformation**
  - [ ] Update ssiUtils.ts transformFormDataToSituation
  - [ ] Test data transformation

- [ ] **UI/UX Testing**
  - [ ] Test adding/removing income sources
  - [ ] Test conditional field visibility
  - [ ] Test form validation
  - [ ] Test end-to-end screener flow

### 5.4 Documentation

- [ ] **Update Implementation Progress**
  - [ ] Mark income limits as completed in SSI-IMPLEMENTATION-PROGRESS.md
  - [ ] Update status to 5 of 5 core requirements complete

- [ ] **Create Review Notes**
  - [ ] Document POMS research findings
  - [ ] Document exclusion formula and order
  - [ ] Document FBR configuration approach
  - [ ] Document known limitations (SEIE, PASS, etc.)

---

## Phase 6: Future Enhancements (Deferred)

### 6.1 Student Earned Income Exclusion (SEIE)
- Add student status tracking to tPerson
- Implement SEIE calculation: $2,290/month, $9,230/year (2025 limits)
- Apply before general earned income exclusions

### 6.2 Plan to Achieve Self-Support (PASS)
- Track PASS-designated income and expenses
- Exclude income set aside for approved PASS
- Require PASS approval documentation

### 6.3 Infrequent or Irregular Income Exclusion
- Track income frequency
- Exclude up to $30/month unearned if infrequent
- Exclude up to $65/month earned if infrequent
- Define "infrequent": < 4 months/year

### 6.4 Impairment-Related Work Expenses (IRWE)
- Track work-related disability expenses
- Deduct from earned income before other exclusions
- Require documentation of expenses and necessity

### 6.5 Couple FBR
- Detect if applicant has eligible spouse
- Apply couple FBR ($1,450 instead of $967)

### 6.6 Deeming
- Count income from ineligible spouse
- Count income from parents (for children)
- Apply deeming exclusions and allocations

### 6.7 In-Kind Support and Maintenance (ISM)
- Calculate value of food/shelter provided by others
- Apply presumed maximum value (PMV) rule
- Reduce FBR by ISM amount

---

## Calculation Examples

### Example 1: Unearned Income Only

**Input:**
- Social Security: $500/month

**Calculation:**
```
Total Unearned: $500
- $20 general exclusion
= $480 countable income

$480 < $967 (FBR) → ELIGIBLE ✓
```

### Example 2: Earned Income Only

**Input:**
- Wages: $1,000/month

**Calculation:**
```
Total Earned: $1,000
- $20 general exclusion = $980
- $65 earned exclusion = $915
- 50% exclusion = $458 (remaining)
= $458 countable income

$458 < $967 (FBR) → ELIGIBLE ✓
```

### Example 3: Mixed Income (Common Scenario)

**Input:**
- Social Security (unearned): $400/month
- Part-time wages (earned): $600/month

**Calculation:**
```
Step 1: Unearned Income
  $400 unearned
  - $20 general exclusion
  = $380 countable unearned

Step 2: Earned Income
  $600 earned
  - $0 (general exclusion already used)
  - $65 earned exclusion = $535
  - $268 excluded (50% of $535)
  = $268 countable earned

Step 3: Total
  $380 + $268 = $648 total countable income

$648 < $967 (FBR) → ELIGIBLE ✓
```

### Example 4: Low Unearned, General Exclusion Spillover

**Input:**
- Interest (unearned): $15/month
- Wages (earned): $800/month

**Calculation:**
```
Step 1: Unearned Income
  $15 unearned
  - $15 general exclusion (only uses $15 of available $20)
  = $0 countable unearned
  Unused general exclusion: $5

Step 2: Earned Income
  $800 earned
  - $5 (unused general exclusion)
  - $65 earned exclusion = $730
  - $365 excluded (50% of $730)
  = $365 countable earned

Step 3: Total
  $0 + $365 = $365 total countable income

$365 < $967 (FBR) → ELIGIBLE ✓
```

### Example 5: Above Income Limit

**Input:**
- Pension (unearned): $600/month
- Part-time wages (earned): $1,500/month

**Calculation:**
```
Step 1: Unearned Income
  $600 unearned
  - $20 general exclusion
  = $580 countable unearned

Step 2: Earned Income
  $1,500 earned
  - $0 (general exclusion already used)
  - $65 earned exclusion = $1,435
  - $718 excluded (50% of $1,435)
  = $718 countable earned

Step 3: Total
  $580 + $718 = $1,298 total countable income

$1,298 > $967 (FBR) → INELIGIBLE ✗
```

---

## Estimated Effort

**Phase 1 (Research & Design)**: 0.5-1 hour (COMPLETED)
**Phase 2 (DMN Implementation)**: 3-4 hours
**Phase 3 (Testing)**: 2-3 hours
**Phase 4 (Form Updates)**: 1-2 hours
**Phase 5 (Documentation)**: 0.5-1 hour

**Total**: 7.5-11 hours

---

## Success Criteria

✅ User can enter multiple income sources (earned and unearned)
✅ DMN automatically applies exclusions in correct POMS order
✅ $20 general exclusion applied to unearned first, spillover to earned if applicable
✅ $65 + 50% exclusions applied to earned income correctly
✅ Countable income calculated accurately
✅ Income limit check passes/fails based on FBR comparison
✅ All Bruno tests passing (unit, integration, end-to-end)
✅ Form UX guides user through income entry with clear categories
✅ Documentation complete with POMS references and calculation examples
✅ **SSI Eligibility screener complete: ALL 5 core requirements implemented!**

---

## Key Differences from Resource Limits

**Simpler in some ways:**
- Fewer exclusion types (mainly $20, $65, 50%)
- More straightforward calculation (no complex conditional logic per resource type)
- Clear sequential application order

**More complex in some ways:**
- Interaction between earned/unearned (general exclusion spillover)
- Must track multiple exclusions in sequence
- FBR configuration (changes annually)
- More deferred enhancements (SEIE, PASS, IRWE, deeming, ISM)

---

**Created**: 2026-01-03
**Status**: Planning - Ready for implementation
**POMS Research**: Completed using POMS API
