# Screener UX Improvements - Implementation Tickets

**Epic:** Screener User Experience
**Created:** 2026-01-27

---

## Ticket Overview

| ID | Title | Type | Size | Dependencies | Status |
|----|-------|------|------|--------------|--------|
| SCR-1 | Highlight form questions that caused ineligibility | Feature | M | None | **Done** |
| SCR-2 | Make explanatory help text collapsible/expandable | Feature | S | None | Open |

**Note:** Both tickets are independent and can be worked in parallel.

---

## Tickets

---

### [FEATURE] SCR-1: Highlight Form Questions That Caused Ineligibility

**Type:** Feature
**Priority:** P1 (High)
**Size:** M (2-3 days)
**Dependencies:** None
**Status:** Done
**Completed:** 2026-01-27

---

#### Summary

When a user is found ineligible, visually highlight which form question(s) contributed to the ineligibility result. Use accessible color indicators and ARIA attributes so screen readers can also convey this information.

---

#### User Story

As a claimant using the SSI screener,
I want to see which of my answers caused ineligibility,
so that I understand what changed my eligibility status and can verify my answers are correct.

---

#### Context

Currently, the screener shows an overall eligibility result with check-level pass/fail indicators in the results section. However, there's no visual connection back to the **original form questions** that caused the failure. Users must mentally map "incomeEligible: false" to the income fields they entered.

This feature will:
1. Map failed checks back to the form fields that contributed to them
2. Add visual indicators (border color, icon) to those fields
3. Ensure accessibility via ARIA attributes and sufficient color contrast

---

#### Requirements

##### Functional Requirements
- [x] Map eligibility check results to corresponding form field IDs
- [x] After submission, highlight form fields that contributed to failed checks
- [x] Show a small indicator icon (warning triangle or similar) next to highlighted fields
- [x] Provide a tooltip or inline message explaining why this field matters
- [ ] Allow users to click the indicator to jump to the relevant check in results (deferred)

##### Accessibility Requirements
- [x] Use `aria-invalid="true"` on highlighted fields
- [x] Add `aria-describedby` linking to explanation text
- [x] Ensure color contrast meets WCAG AA (4.5:1 minimum)
- [x] Don't rely on color alone — include icon/text indicator
- [x] Screen reader announces via `role="alert"` with explanation text

---

#### Acceptance Criteria

##### Scenario 1: Income exceeds limit
**Given:** User enters $2,000/month unearned income (exceeds FBR)
**When:** User submits form and sees ineligible result
**Then:** The "Monthly Unearned Income" field is highlighted with warning indicator

##### Scenario 2: Resources exceed limit
**Given:** User enters $5,000 countable resources (exceeds $2,000 limit)
**When:** User submits form and sees ineligible result
**Then:** The "Total Countable Resources" field is highlighted with warning indicator

##### Scenario 3: Multiple failing checks
**Given:** User has both excess income AND resources
**When:** User submits form
**Then:** Both income AND resource fields are highlighted

##### Scenario 4: Accessibility verification
**Given:** User is using a screen reader
**When:** User navigates to a highlighted field
**Then:** Screen reader announces the field has an eligibility impact

##### Rules
- [x] Highlighting only appears after form submission (not during entry)
- [x] Highlighting clears when user modifies the field
- [x] Works in both SME and claimant modes
- [x] Colors meet WCAG AA contrast requirements

---

#### Out of Scope

- Suggesting corrected values (just identify the problem field)
- Real-time validation during input (only post-submission)
- Detailed policy explanations (handled by existing check details)

---

#### Technical Notes

##### Check-to-Field Mapping

Create a mapping object:

```typescript
const CHECK_TO_FIELDS: Record<string, string[]> = {
  incomeEligible: ['earnedIncome', 'unearnedIncome', 'currentBenefits'],
  resourceEligible: ['countableResources', 'resources'],
  categoricalEligible: ['dateOfBirth', 'isBlind', 'isDisabled'],
  citizenshipEligible: ['citizenshipStatus', /* ...immigrationFields */],
  residenceEligible: ['residenceState'],
};
```

##### Visual Design

- Use `border-orange-500` or `border-amber-500` for warning state
- Add small `AlertTriangle` icon from lucide-react
- Position icon at end of input field

---

#### Files Created/Modified

- `src/lib/screener/check-field-mapping.ts` — **Created**: mapping logic, field highlight analysis
- `src/lib/screener/index.ts` — Updated: added export for check-field-mapping
- `src/components/screener/FormRenderer.tsx` — **Modified**: added highlight state/styling, ARIA attributes
- `src/components/screener/SsiScreener.tsx` — **Modified**: extracts failed checks, passes to FormRenderer
- `src/lib/screener/__tests__/check-field-mapping.test.ts` — **Created**: unit tests (11 tests)

---

#### Testing Notes

- [x] Unit test: check-to-field mapping returns correct fields (11 tests passing)
- [ ] Integration test: form highlights correct fields for each failing check
- [ ] Accessibility test: Run axe-core, verify screen reader behavior
- [ ] Visual test: Verify contrast with browser dev tools

---

#### Definition of Done

- [x] Failed checks highlight corresponding form fields
- [x] Accessibility requirements met (ARIA, contrast, non-color indicators)
- [x] Works in both SME and claimant modes
- [x] No regressions in existing form functionality
- [ ] PR reviewed and approved

---

---

### [FEATURE] SCR-2: Make Explanatory Help Text Collapsible/Expandable

**Type:** Feature
**Priority:** P2 (Medium)
**Size:** S (1-2 days)
**Dependencies:** None
**Status:** Open

---

#### Summary

Convert the detailed explanatory text blocks in income, benefits, and resources sections from always-visible to expandable/collapsible. This reduces visual clutter while keeping help available for users who need it.

---

#### User Story

As a claimant filling out the SSI screener,
I want the detailed help text to be hidden by default but expandable,
so that I can focus on entering my information without information overload.

---

#### Context

The current form has detailed explanatory text blocks:
- **Income section**: "Understanding Income Types" with earned/unearned definitions
- **Benefits section**: Lists which benefits count vs. are excluded
- **Resources section**: "What Doesn't Count as Resources" with exemptions list

These are valuable for first-time users but create visual noise for repeat users or those who already understand the concepts. Making them collapsible improves UX while preserving access to help.

---

#### Requirements

##### Functional Requirements
- [ ] Add collapsible wrapper to explanatory text blocks
- [ ] Show a brief summary label (e.g., "i What counts as income?") when collapsed
- [ ] Clicking expands to show full help text
- [ ] Remember expanded/collapsed state during form session
- [ ] Default to collapsed state

##### Accessibility Requirements
- [ ] Use proper `aria-expanded` attribute
- [ ] Ensure keyboard navigation works (Enter/Space to toggle)
- [ ] Collapsed content not read by screen readers until expanded

---

#### Acceptance Criteria

##### Scenario 1: Income help is collapsible
**Given:** User is on the Income section
**When:** Page loads
**Then:** Help text shows collapsed with label "i Understanding Income Types"

##### Scenario 2: User expands help
**Given:** Help text is collapsed
**When:** User clicks the expand trigger
**Then:** Full explanation text is revealed with smooth animation

##### Scenario 3: State persists during session
**Given:** User expanded income help text
**When:** User scrolls away and returns to income section
**Then:** Help text remains expanded

##### Scenario 4: Keyboard accessibility
**Given:** User focuses on collapsed help trigger
**When:** User presses Enter or Space
**Then:** Help text expands

---

#### Out of Scope

- Persisting state across sessions (localStorage)
- Making ALL text collapsible (only help blocks)
- Adding new help content

---

#### Technical Notes

##### Implementation Options

**Option A: New CollapsibleHelp component**
```tsx
<CollapsibleHelp
  label="Understanding Income Types"
  defaultExpanded={false}
>
  <MarkdownContent content={incomeHelpText} />
</CollapsibleHelp>
```

**Option B: New field type in schema**
```typescript
{
  id: 'income_help',
  type: 'collapsible_text',  // New type
  label: 'Understanding Income Types',
  text: '...',
  defaultExpanded: false,
}
```

Recommend **Option A** for faster implementation, with Option B as a future enhancement.

##### Fields to Convert

1. `income_help` (id in schema) — "Understanding Income Types"
2. `benefits_intro` — Benefits explanation
3. `resources_exemptions_info` — "What Doesn't Count as Resources"
4. `life_insurance_info` — Life insurance note

---

#### Files to Create/Modify

- `src/components/screener/CollapsibleHelp.tsx` — New: collapsible wrapper component
- `src/lib/screener/ssi-form-schema.ts` — Update text fields to use collapsible pattern
- `src/components/screener/FormRenderer.tsx` — Render CollapsibleHelp for designated fields

---

#### Testing Notes

- [ ] Unit test: CollapsibleHelp toggles correctly
- [ ] Accessibility test: Verify aria-expanded, keyboard nav
- [ ] Visual test: Animation is smooth, no layout shift

---

#### Definition of Done

- [ ] Help text blocks are collapsible by default
- [ ] Expand/collapse works via click and keyboard
- [ ] ARIA attributes properly set
- [ ] No regressions in form functionality
- [ ] PR reviewed and approved

---

---

## Dependency Graph

```
SCR-1 (Ineligibility highlighting)  ──┐
                                      ├──▶ Can be worked in parallel
SCR-2 (Collapsible help text)       ──┘
```

---

## Sprint Planning Notes

Both tickets are independent:
- **SCR-1** is higher priority (P1) and larger (M)
- **SCR-2** is lower priority (P2) but smaller (S)

Recommended approach: Start SCR-1 first, or work both in parallel if capacity allows.
