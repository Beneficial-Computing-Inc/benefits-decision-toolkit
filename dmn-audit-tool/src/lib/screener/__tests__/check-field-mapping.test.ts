/**
 * Tests for check-field-mapping module.
 */

import { describe, it, expect } from 'vitest';
import {
  CHECK_TO_FIELDS,
  SUB_CHECK_TO_FIELDS,
  CITIZENSHIP_STATUS_TO_SUBCHECKS,
  getFieldsToHighlight,
  getChecksForField,
  analyzeFieldHighlights,
  analyzeFieldHighlightsPrecise,
} from '../check-field-mapping';
import type { EnrichedCheckResult } from '../result-enricher';

describe('check-field-mapping', () => {
  describe('CHECK_TO_FIELDS', () => {
    it('should have mappings for all major eligibility checks', () => {
      expect(CHECK_TO_FIELDS).toHaveProperty('categoricalEligible');
      expect(CHECK_TO_FIELDS).toHaveProperty('citizenshipEligible');
      expect(CHECK_TO_FIELDS).toHaveProperty('residenceEligible');
      expect(CHECK_TO_FIELDS).toHaveProperty('resourceEligible');
      expect(CHECK_TO_FIELDS).toHaveProperty('incomeEligible');
    });

    it('should map income check to income fields', () => {
      const incomeFields = CHECK_TO_FIELDS.incomeEligible;
      expect(incomeFields).toContain('earnedIncome');
      expect(incomeFields).toContain('unearnedIncome');
      expect(incomeFields).toContain('currentBenefits');
    });
  });

  describe('getFieldsToHighlight', () => {
    it('should return empty set for no failed checks', () => {
      const result = getFieldsToHighlight([]);
      expect(result.size).toBe(0);
    });

    it('should return fields for a single failed check', () => {
      const result = getFieldsToHighlight(['resourceEligible']);
      expect(result.has('countableResources')).toBe(true);
      expect(result.has('resources')).toBe(true);
    });

    it('should combine fields from multiple failed checks', () => {
      const result = getFieldsToHighlight(['incomeEligible', 'resourceEligible']);
      // Income fields
      expect(result.has('earnedIncome')).toBe(true);
      expect(result.has('unearnedIncome')).toBe(true);
      // Resource fields
      expect(result.has('countableResources')).toBe(true);
    });

    it('should handle unknown check names gracefully', () => {
      const result = getFieldsToHighlight(['unknownCheck']);
      expect(result.size).toBe(0);
    });
  });

  describe('getChecksForField', () => {
    it('should return checks that a field contributes to', () => {
      const checks = getChecksForField('earnedIncome');
      expect(checks).toContain('incomeEligible');
    });

    it('should return empty array for unknown field', () => {
      const checks = getChecksForField('unknownField');
      expect(checks).toEqual([]);
    });
  });

  describe('analyzeFieldHighlights', () => {
    it('should return empty map for no failed checks', () => {
      const result = analyzeFieldHighlights([]);
      expect(result.size).toBe(0);
    });

    it('should return highlight info with explanation', () => {
      const result = analyzeFieldHighlights(['incomeEligible']);
      const info = result.get('earnedIncome');
      expect(info).toBeDefined();
      expect(info?.failedChecks).toContain('incomeEligible');
      expect(info?.explanation).toBeTruthy();
    });

    it('should combine multiple checks for same field', () => {
      // Note: In current implementation, no field is shared between checks
      // This test verifies the logic still works
      const result = analyzeFieldHighlights(['incomeEligible', 'resourceEligible']);

      // earnedIncome only affects incomeEligible
      const incomeInfo = result.get('earnedIncome');
      expect(incomeInfo?.failedChecks).toEqual(['incomeEligible']);

      // countableResources only affects resourceEligible
      const resourceInfo = result.get('countableResources');
      expect(resourceInfo?.failedChecks).toEqual(['resourceEligible']);
    });
  });

  describe('SUB_CHECK_TO_FIELDS', () => {
    it('should have LPR-specific fields for laprWithException', () => {
      const fields = SUB_CHECK_TO_FIELDS.laprWithException;
      expect(fields).toContain('qualifyingQuarters');
      expect(fields).toContain('isVeteran');
      expect(fields).toContain('citizenshipStatus');
    });

    it('should have refugee-specific fields for refugeeAsylee', () => {
      const fields = SUB_CHECK_TO_FIELDS.refugeeAsylee;
      expect(fields).toContain('refugeeAdmissionDate');
      expect(fields).toContain('citizenshipStatus');
      // Should NOT contain LPR-specific fields
      expect(fields).not.toContain('qualifyingQuarters');
    });
  });

  describe('CITIZENSHIP_STATUS_TO_SUBCHECKS', () => {
    it('should map LPR status to laprWithException sub-check', () => {
      expect(CITIZENSHIP_STATUS_TO_SUBCHECKS.LPR).toContain('laprWithException');
    });

    it('should map REFUGEE status to refugeeAsylee sub-check', () => {
      expect(CITIZENSHIP_STATUS_TO_SUBCHECKS.REFUGEE).toContain('refugeeAsylee');
    });
  });

  describe('analyzeFieldHighlightsPrecise', () => {
    it('should return empty map for no checks', () => {
      const result = analyzeFieldHighlightsPrecise([], {});
      expect(result.size).toBe(0);
    });

    it('should return empty map when all checks pass', () => {
      const checks: EnrichedCheckResult[] = [
        {
          checkKey: 'citizenshipEligible',
          checkId: null,
          name: 'Citizenship',
          result: true, // passing
          feelExpression: null,
          explanation: 'Passed',
          confidence: null,
          citations: [],
          detailUrl: null,
          plainLanguage: 'You meet the citizenship requirement.',
        },
      ];
      const result = analyzeFieldHighlightsPrecise(checks, {});
      expect(result.size).toBe(0);
    });

    it('should only highlight fields the user actually filled in', () => {
      const checks: EnrichedCheckResult[] = [
        {
          checkKey: 'citizenshipEligible',
          checkId: 'CitizenshipEligibility',
          name: 'Citizenship',
          result: false,
          feelExpression: null,
          explanation: 'Not eligible',
          confidence: null,
          citations: [],
          detailUrl: null,
          plainLanguage: 'Does not meet citizenship requirement.',
        },
      ];
      // User only filled in status and qualifying quarters, left other fields empty
      const formValues = { citizenshipStatus: 'LPR', qualifyingQuarters: 30 };

      const result = analyzeFieldHighlightsPrecise(checks, formValues);

      // Should highlight fields the user filled in
      expect(result.has('qualifyingQuarters')).toBe(true);
      expect(result.has('citizenshipStatus')).toBe(true);

      // Should NOT highlight fields the user didn't fill in (even if they're LPR-related)
      expect(result.has('isVeteran')).toBe(false); // User didn't fill this in
      expect(result.has('usEntryDate')).toBe(false); // User didn't fill this in

      // Should NOT highlight refugee-specific fields
      expect(result.has('refugeeAdmissionDate')).toBe(false);
      expect(result.has('cubanHaitianEntryDate')).toBe(false);
    });

    it('should only highlight refugee fields the user filled in', () => {
      const checks: EnrichedCheckResult[] = [
        {
          checkKey: 'citizenshipEligible',
          checkId: 'CitizenshipEligibility',
          name: 'Citizenship',
          result: false,
          feelExpression: null,
          explanation: 'Not eligible',
          confidence: null,
          citations: [],
          detailUrl: null,
          plainLanguage: 'Does not meet citizenship requirement.',
        },
      ];
      // User filled in status and admission date
      const formValues = { citizenshipStatus: 'REFUGEE', refugeeAdmissionDate: '2020-01-01' };

      const result = analyzeFieldHighlightsPrecise(checks, formValues);

      // Should highlight refugee-related fields that user filled in
      expect(result.has('refugeeAdmissionDate')).toBe(true);
      expect(result.has('citizenshipStatus')).toBe(true);

      // Should NOT highlight LPR-specific fields
      expect(result.has('qualifyingQuarters')).toBe(false);
      expect(result.has('isVeteran')).toBe(false);
    });

    it('should use specific explanation for LPR path', () => {
      const checks: EnrichedCheckResult[] = [
        {
          checkKey: 'citizenshipEligible',
          checkId: 'CitizenshipEligibility',
          name: 'Citizenship',
          result: false,
          feelExpression: null,
          explanation: 'Not eligible',
          confidence: null,
          citations: [],
          detailUrl: null,
          plainLanguage: 'Does not meet citizenship requirement.',
        },
      ];
      const formValues = { citizenshipStatus: 'LPR', qualifyingQuarters: 30 };

      const result = analyzeFieldHighlightsPrecise(checks, formValues);
      const highlight = result.get('qualifyingQuarters');

      expect(highlight?.explanation).toContain('40 qualifying work quarters');
    });

    it('should only highlight income fields user filled in', () => {
      const checks: EnrichedCheckResult[] = [
        {
          checkKey: 'incomeEligible',
          checkId: 'SsiIncomeLimit',
          name: 'Income',
          result: false,
          feelExpression: null,
          explanation: 'Income exceeds limit',
          confidence: null,
          citations: [],
          detailUrl: null,
          plainLanguage: 'Income exceeds the SSI limit.',
        },
      ];
      // User only filled in unearned income, left earned income empty
      const formValues = { unearnedIncome: 2000 };

      const result = analyzeFieldHighlightsPrecise(checks, formValues);

      // Should highlight the field user filled in
      expect(result.has('unearnedIncome')).toBe(true);

      // Should NOT highlight fields user didn't fill in
      expect(result.has('earnedIncome')).toBe(false);
      expect(result.has('spouseEarnedIncome')).toBe(false);
    });

    it('should highlight resource fields user filled in', () => {
      const checks: EnrichedCheckResult[] = [
        {
          checkKey: 'resourceEligible',
          checkId: 'SsiResourceLimit',
          name: 'Resources',
          result: false,
          feelExpression: null,
          explanation: 'Resources exceed limit',
          confidence: null,
          citations: [],
          detailUrl: null,
          plainLanguage: 'Resources exceed the SSI limit.',
        },
      ];
      const formValues = { countableResources: 5000 };

      const result = analyzeFieldHighlightsPrecise(checks, formValues);

      expect(result.has('countableResources')).toBe(true);
    });
  });
});
