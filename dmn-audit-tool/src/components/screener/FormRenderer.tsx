/**
 * FormRenderer component.
 * Renders a form based on a schema definition with support for
 * collapsible sections and dynamic lists.
 */

import { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { AlertTriangle } from 'lucide-react';
import type {
  FormSchema,
  FormField,
  FormValues,
  FormSubmitHandler,
  DynamicListField,
  SectionField,
  TextField,
  ToggleField,
} from '../../lib/screener/types';
import { validateDateField } from '../../lib/screener/validation';
import {
  analyzeFieldHighlightsPrecise,
  type FieldHighlightInfo,
} from '../../lib/screener/check-field-mapping';
import type { EnrichedCheckResult } from '../../lib/screener/result-enricher';

interface FormRendererProps {
  schema: FormSchema;
  onSubmit: FormSubmitHandler;
  initialValues?: FormValues;
  isLoading?: boolean;
  /** Enriched check results from eligibility evaluation (for precise highlighting) */
  enrichedChecks?: EnrichedCheckResult[];
  /** Called when any form field changes (used to clear results on edit) */
  onFormChange?: () => void;
}

export function FormRenderer({
  schema,
  onSubmit,
  initialValues = {},
  isLoading = false,
  enrichedChecks = [],
  onFormChange,
}: FormRendererProps) {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    schema.components.forEach((field) => {
      if (field.type === 'section' && field.collapsed) {
        collapsed.add(field.id);
      }
    });
    return collapsed;
  });

  // Track collapsed state for collapsible text blocks (default: collapsed)
  const [collapsedTextBlocks, setCollapsedTextBlocks] = useState<Set<string>>(() => {
    const collapsed = new Set<string>();
    const findCollapsibleText = (fields: FormField[]) => {
      for (const f of fields) {
        if (f.type === 'text' && f.collapsible) collapsed.add(f.id);
        if (f.type === 'section') findCollapsibleText(f.components);
      }
    };
    findCollapsibleText(schema.components);
    return collapsed;
  });

  const toggleTextBlock = useCallback((textId: string) => {
    setCollapsedTextBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(textId)) {
        next.delete(textId);
      } else {
        next.add(textId);
      }
      return next;
    });
  }, []);

  // Compute field highlights from enriched check results and current form values
  // Uses precise analysis to only highlight fields relevant to the user's specific path
  const fieldHighlights = useMemo(
    () => analyzeFieldHighlightsPrecise(enrichedChecks, values),
    [enrichedChecks, values]
  );

  const handleChange = useCallback((key: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    // Notify parent that form changed (clears eligibility results/highlights)
    onFormChange?.();
  }, [errors, onFormChange]);

  // Validate date field on blur for immediate feedback
  const handleDateBlur = useCallback((key: string, value: string, label?: string) => {
    if (value) {
      const result = validateDateField(key, value, label);
      if (!result.isValid && result.error) {
        setErrors((prev) => ({ ...prev, [key]: result.error! }));
      }
    }
  }, []);

  const toggleSection = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) {
        next.delete(sectionId);
      } else {
        next.add(sectionId);
      }
      return next;
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();

      const newErrors: Record<string, string> = {};
      let firstErrorKey: string | null = null;
      let firstErrorSectionId: string | null = null;

      const validateFields = (fields: FormField[], currentSectionId: string | null = null) => {
        for (const field of fields) {
          if (field.type === 'section') {
            validateFields(field.components, field.id);
          } else if ('key' in field && field.key) {
            const value = values[field.key];

            // Check required validation
            if (field.validate?.required) {
              if (value === undefined || value === null || value === '') {
                newErrors[field.key] = 'This field is required';
                if (!firstErrorKey) {
                  firstErrorKey = field.key;
                  firstErrorSectionId = currentSectionId;
                }
                continue; // Skip other validations if required fails
              }
            }

            // Validate date fields
            if (field.type === 'date' && value) {
              const dateResult = validateDateField(field.key, String(value), field.label);
              if (!dateResult.isValid && dateResult.error) {
                newErrors[field.key] = dateResult.error;
                if (!firstErrorKey) {
                  firstErrorKey = field.key;
                  firstErrorSectionId = currentSectionId;
                }
              }
            }
          }
        }
      };
      validateFields(schema.components);

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);

        // Expand section containing first error if it's collapsed
        if (firstErrorSectionId && collapsedSections.has(firstErrorSectionId)) {
          setCollapsedSections(prev => {
            const next = new Set(prev);
            next.delete(firstErrorSectionId!);
            return next;
          });
        }

        // Scroll to first error field after a brief delay
        if (firstErrorKey) {
          setTimeout(() => {
            const element = document.querySelector(`[data-field-key="${firstErrorKey}"]`);
            if (element) {
              element.scrollIntoView({ behavior: 'smooth', block: 'center' });
              // Try to focus the input
              const input = element.querySelector('input, select, textarea') as HTMLElement;
              input?.focus();
            }
          }, 150); // Slightly longer delay to allow section expansion
        }
        return;
      }

      onSubmit(values);
    },
    [schema, values, onSubmit, collapsedSections]
  );

  const isHidden = useCallback(
    (field: FormField): boolean => {
      if (!field.conditional?.hide) return false;

      const expr = field.conditional.hide;
      const match = expr.match(/^=(\w+)\s*(!=|==)\s*['"]?([^'"]+)['"]?$/);
      if (!match) return false;

      const [, key, op, expected] = match;
      const actual = values[key];

      // Evaluate the expression and return whether the field should be hidden
      // hide: '=hasSpouse != true' means "hide when hasSpouse is not true"
      if (expected === 'true') {
        // For != true: hide when actual is NOT true (i.e., false/undefined)
        // For == true: hide when actual IS true
        return op === '!=' ? actual !== true : actual === true;
      }
      if (expected === 'false') {
        // For != false: hide when actual is NOT false
        // For == false: hide when actual IS false
        return op === '!=' ? actual !== false : actual === false;
      }

      // String comparison
      if (op === '!=') {
        return String(actual) !== expected;
      }
      return String(actual) === expected;
    },
    [values]
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {schema.components.map((field) => {
        // Check if field is hidden (works for both regular fields and sections)
        if (isHidden(field)) return null;

        return (
          <FieldRenderer
            key={field.id}
            field={field}
            values={values}
            errors={errors}
            onChange={handleChange}
            onDateBlur={handleDateBlur}
            isLoading={isLoading}
            isHidden={isHidden}
            collapsedSections={collapsedSections}
            onToggleSection={toggleSection}
            fieldHighlights={fieldHighlights}
            collapsedTextBlocks={collapsedTextBlocks}
            onToggleTextBlock={toggleTextBlock}
          />
        );
      })}
    </form>
  );
}

interface FieldRendererProps {
  field: FormField;
  values: FormValues;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  onDateBlur: (key: string, value: string, label?: string) => void;
  isLoading: boolean;
  isHidden: (field: FormField) => boolean;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
  fieldHighlights: Map<string, FieldHighlightInfo>;
  collapsedTextBlocks: Set<string>;
  onToggleTextBlock: (textId: string) => void;
}

function FieldRenderer({
  field,
  values,
  errors,
  onChange,
  onDateBlur,
  isLoading,
  isHidden,
  collapsedSections,
  onToggleSection,
  fieldHighlights,
  collapsedTextBlocks,
  onToggleTextBlock,
}: FieldRendererProps) {
  const value = 'key' in field ? values[field.key!] : undefined;
  const error = 'key' in field && field.key ? errors[field.key] : undefined;
  const highlight = 'key' in field && field.key ? fieldHighlights.get(field.key) : undefined;

  const baseInputClass =
    'w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
  // Priority: error (red) > highlight (amber) > normal (gray)
  const borderClass = error
    ? 'border-red-500'
    : highlight
    ? 'border-amber-500 border-2'
    : 'border-gray-300';

  // Render highlight indicator for fields that affect failed checks
  const HighlightIndicator = highlight ? (
    <div
      className="flex items-start gap-2 mt-1 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800"
      role="alert"
      aria-live="polite"
    >
      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{highlight.explanation}</span>
    </div>
  ) : null;

  switch (field.type) {
    case 'section':
      return (
        <SectionRenderer
          field={field}
          values={values}
          errors={errors}
          onChange={onChange}
          onDateBlur={onDateBlur}
          isLoading={isLoading}
          isHidden={isHidden}
          isCollapsed={collapsedSections.has(field.id)}
          onToggle={() => onToggleSection(field.id)}
          collapsedSections={collapsedSections}
          onToggleSection={onToggleSection}
          fieldHighlights={fieldHighlights}
          collapsedTextBlocks={collapsedTextBlocks}
          onToggleTextBlock={onToggleTextBlock}
        />
      );

    case 'text':
      if (field.collapsible) {
        return (
          <CollapsibleText
            field={field}
            isCollapsed={collapsedTextBlocks.has(field.id)}
            onToggle={() => onToggleTextBlock(field.id)}
          />
        );
      }
      return (
        <div className="prose prose-sm max-w-none">
          <ReactMarkdown>{field.text}</ReactMarkdown>
        </div>
      );

    case 'textfield':
      return (
        <div className="space-y-1" data-field-key={field.key} aria-invalid={!!highlight}>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.validate?.required && <span className="text-red-500 ml-1">*</span>}
            {highlight && <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-2" aria-hidden="true" />}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
          <input
            type="text"
            value={String(value || '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={`${baseInputClass} ${borderClass}`}
            disabled={isLoading}
            aria-describedby={highlight ? `${field.key}-highlight` : undefined}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          {HighlightIndicator && <div id={`${field.key}-highlight`}>{HighlightIndicator}</div>}
        </div>
      );

    case 'date':
      return (
        <div className="space-y-1" data-field-key={field.key} aria-invalid={!!highlight}>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.validate?.required && <span className="text-red-500 ml-1">*</span>}
            {highlight && <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-2" aria-hidden="true" />}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
          <input
            type="date"
            value={String(value || '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            onBlur={(e) => onDateBlur(field.key, e.target.value, field.label)}
            className={`${baseInputClass} ${borderClass}`}
            disabled={isLoading}
            aria-describedby={highlight ? `${field.key}-highlight` : undefined}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          {HighlightIndicator && <div id={`${field.key}-highlight`}>{HighlightIndicator}</div>}
        </div>
      );

    case 'number':
      return (
        <div className="space-y-1" data-field-key={field.key} aria-invalid={!!highlight}>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.validate?.required && <span className="text-red-500 ml-1">*</span>}
            {highlight && <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-2" aria-hidden="true" />}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
          <input
            type="number"
            value={value === undefined || value === null ? '' : Number(value)}
            onChange={(e) => onChange(field.key, e.target.value ? Number(e.target.value) : undefined)}
            className={`${baseInputClass} ${borderClass}`}
            disabled={isLoading}
            min={field.validate?.min}
            max={field.validate?.max}
            aria-describedby={highlight ? `${field.key}-highlight` : undefined}
          />
          {error && <p className="text-xs text-red-500">{error}</p>}
          {HighlightIndicator && <div id={`${field.key}-highlight`}>{HighlightIndicator}</div>}
        </div>
      );

    case 'select':
      return (
        <div className="space-y-1" data-field-key={field.key} aria-invalid={!!highlight}>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.validate?.required && <span className="text-red-500 ml-1">*</span>}
            {highlight && <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-2" aria-hidden="true" />}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
          <select
            value={String(value || '')}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={`${baseInputClass} ${borderClass}`}
            disabled={isLoading}
            aria-describedby={highlight ? `${field.key}-highlight` : undefined}
          >
            <option value="">Select...</option>
            {field.values.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {HighlightIndicator && <div id={`${field.key}-highlight`}>{HighlightIndicator}</div>}
        </div>
      );

    case 'yes_no':
      return (
        <div className="space-y-1" data-field-key={field.key} aria-invalid={!!highlight}>
          <label className="block text-sm font-medium text-gray-700">
            {field.label}
            {field.validate?.required && <span className="text-red-500 ml-1">*</span>}
            {highlight && <AlertTriangle className="w-4 h-4 text-amber-500 inline ml-2" aria-hidden="true" />}
          </label>
          {field.description && (
            <p className="text-xs text-gray-500">{field.description}</p>
          )}
          <div
            className={`flex gap-4 p-2 rounded ${highlight ? 'bg-amber-50 border border-amber-200' : ''}`}
            role="radiogroup"
            aria-describedby={highlight ? `${field.key}-highlight` : undefined}
          >
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.key}
                checked={value === true}
                onChange={() => onChange(field.key, true)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">Yes</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name={field.key}
                checked={value === false}
                onChange={() => onChange(field.key, false)}
                disabled={isLoading}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm">No</span>
            </label>
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          {HighlightIndicator && <div id={`${field.key}-highlight`}>{HighlightIndicator}</div>}
        </div>
      );

    case 'checkbox':
      return (
        <div className="space-y-1" data-field-key={field.key}>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(field.key, e.target.checked)}
              disabled={isLoading}
              className="w-4 h-4 text-blue-600 rounded"
            />
            <span className="text-sm font-medium text-gray-700">{field.label}</span>
          </label>
          {field.description && (
            <p className="text-xs text-gray-500 ml-6">{field.description}</p>
          )}
          {error && <p className="text-xs text-red-500">{error}</p>}
        </div>
      );

    case 'toggle':
      return (
        <ToggleRenderer
          field={field}
          value={value as string | undefined}
          onChange={onChange}
          isLoading={isLoading}
        />
      );

    case 'dynamiclist':
      return (
        <DynamicListRenderer
          field={field}
          values={values}
          onChange={onChange}
          isLoading={isLoading}
        />
      );

    case 'button':
      return (
        <button
          type={field.action === 'submit' ? 'submit' : 'button'}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Processing...' : field.label}
        </button>
      );

    default:
      return null;
  }
}

interface SectionRendererProps {
  field: SectionField;
  values: FormValues;
  errors: Record<string, string>;
  onChange: (key: string, value: unknown) => void;
  onDateBlur: (key: string, value: string, label?: string) => void;
  isLoading: boolean;
  isHidden: (field: FormField) => boolean;
  isCollapsed: boolean;
  onToggle: () => void;
  collapsedSections: Set<string>;
  onToggleSection: (sectionId: string) => void;
  fieldHighlights: Map<string, FieldHighlightInfo>;
  collapsedTextBlocks: Set<string>;
  onToggleTextBlock: (textId: string) => void;
}

function SectionRenderer({
  field,
  values,
  errors,
  onChange,
  onDateBlur,
  isLoading,
  isHidden,
  isCollapsed,
  onToggle,
  collapsedSections,
  onToggleSection,
  fieldHighlights,
  collapsedTextBlocks,
  onToggleTextBlock,
}: SectionRendererProps) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
      >
        <span className="font-medium text-gray-800">
          {field.label}
          {field.required && <span className="text-red-500 ml-1">*</span>}
        </span>
        <svg
          className={`w-5 h-5 text-gray-500 transform transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="p-4 space-y-4 bg-white">
          {field.components.map((child) => {
            if (isHidden(child)) return null;
            return (
              <FieldRenderer
                key={child.id}
                field={child}
                values={values}
                errors={errors}
                onChange={onChange}
                onDateBlur={onDateBlur}
                isLoading={isLoading}
                isHidden={isHidden}
                collapsedSections={collapsedSections}
                onToggleSection={onToggleSection}
                fieldHighlights={fieldHighlights}
                collapsedTextBlocks={collapsedTextBlocks}
                onToggleTextBlock={onToggleTextBlock}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

interface CollapsibleTextProps {
  field: TextField;
  isCollapsed: boolean;
  onToggle: () => void;
}

function CollapsibleText({ field, isCollapsed, onToggle }: CollapsibleTextProps) {
  // Extract summary from field or derive from first markdown header
  const summary = field.summary || extractSummary(field.text);

  return (
    <div className="border border-blue-200 rounded-md overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onToggle();
          }
        }}
        className="w-full px-3 py-2 bg-blue-50 flex items-center justify-between hover:bg-blue-100 transition-colors text-left"
        aria-expanded={!isCollapsed}
      >
        <span className="text-sm font-medium text-blue-800">{summary}</span>
        <svg
          className={`w-4 h-4 text-blue-600 transform transition-transform ${
            isCollapsed ? '' : 'rotate-180'
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {!isCollapsed && (
        <div className="p-3 bg-white prose prose-sm max-w-none">
          <ReactMarkdown>{field.text}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}

/**
 * Extract summary from text content.
 * Looks for first markdown header or uses first line.
 */
function extractSummary(text: string): string {
  const headerMatch = text.match(/^#+\s+(.+)$/m);
  if (headerMatch) {
    return headerMatch[1];
  }
  const firstLine = text.split('\n')[0].trim();
  return firstLine.length > 50 ? firstLine.slice(0, 47) + '...' : firstLine;
}

interface DynamicListRendererProps {
  field: DynamicListField;
  values: FormValues;
  onChange: (key: string, value: unknown) => void;
  isLoading: boolean;
}

function DynamicListRenderer({
  field,
  values,
  onChange,
  isLoading,
}: DynamicListRendererProps) {
  const items = (values[field.key] as Record<string, unknown>[] | undefined) || [];

  const addItem = () => {
    const newItem: Record<string, unknown> = { id: `${field.key}_${Date.now()}` };
    field.components.forEach((comp) => {
      if ('key' in comp && comp.key) {
        newItem[comp.key] = comp.type === 'number' ? 0 : '';
      }
    });
    onChange(field.key, [...items, newItem]);
  };

  const removeItem = (index: number) => {
    onChange(field.key, items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, itemKey: string, itemValue: unknown) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [itemKey]: itemValue } : item
    );
    onChange(field.key, updated);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">
          {field.label}
        </label>
        <button
          type="button"
          onClick={addItem}
          disabled={isLoading}
          className="px-3 py-1 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:bg-gray-400"
        >
          + Add
        </button>
      </div>
      {field.description && (
        <p className="text-xs text-gray-500">{field.description}</p>
      )}
      {items.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No items added yet</p>
      ) : (
        <div className="space-y-3">
          {items.map((item, index) => (
            <div
              key={item.id as string || index}
              className="p-3 border border-gray-200 rounded-md bg-gray-50"
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-xs font-medium text-gray-500">
                  Item {index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  disabled={isLoading}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {field.components.map((comp) => {
                  if (!('key' in comp) || !comp.key) return null;
                  const compKey = comp.key; // Store in variable for type narrowing
                  const itemValue = item[compKey];

                  if (comp.type === 'select') {
                    return (
                      <div key={comp.id} className="space-y-1">
                        <label className="block text-xs font-medium text-gray-600">
                          {comp.label}
                        </label>
                        <select
                          value={String(itemValue || '')}
                          onChange={(e) => updateItem(index, compKey, e.target.value)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          disabled={isLoading}
                        >
                          <option value="">Select...</option>
                          {comp.values.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }

                  if (comp.type === 'number') {
                    return (
                      <div key={comp.id} className="space-y-1">
                        <label className="block text-xs font-medium text-gray-600">
                          {comp.label}
                        </label>
                        <input
                          type="number"
                          value={itemValue === undefined ? '' : Number(itemValue)}
                          onChange={(e) => updateItem(index, compKey, e.target.value ? Number(e.target.value) : 0)}
                          className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                          disabled={isLoading}
                          min={comp.validate?.min}
                        />
                      </div>
                    );
                  }

                  if (comp.type === 'checkbox') {
                    return (
                      <div key={comp.id} className="flex items-center col-span-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={itemValue === true}
                            onChange={(e) => updateItem(index, compKey, e.target.checked)}
                            disabled={isLoading}
                            className="w-4 h-4 text-blue-600 rounded"
                          />
                          <span className="text-sm text-gray-700">{comp.label}</span>
                        </label>
                      </div>
                    );
                  }

                  return (
                    <div key={comp.id} className="space-y-1">
                      <label className="block text-xs font-medium text-gray-600">
                        {comp.label}
                      </label>
                      <input
                        type="text"
                        value={String(itemValue || '')}
                        onChange={(e) => updateItem(index, compKey, e.target.value)}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded"
                        disabled={isLoading}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

interface ToggleRendererProps {
  field: ToggleField;
  value: string | undefined;
  onChange: (key: string, value: unknown) => void;
  isLoading: boolean;
}

function ToggleRenderer({ field, value, onChange, isLoading }: ToggleRendererProps) {
  // Use defaultValue if no value is set
  const currentValue = value ?? field.defaultValue ?? field.options[0].value;

  return (
    <div className="space-y-2" data-field-key={field.key}>
      {field.label && (
        <label className="block text-sm font-medium text-gray-700">{field.label}</label>
      )}
      <div className="flex flex-col sm:flex-row gap-2">
        {field.options.map((option) => {
          const isSelected = currentValue === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(field.key, option.value)}
              disabled={isLoading}
              className={`flex-1 p-3 rounded-lg border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    isSelected ? 'border-blue-500' : 'border-gray-300'
                  }`}
                >
                  {isSelected && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <span className={`font-medium text-sm ${isSelected ? 'text-blue-700' : 'text-gray-700'}`}>
                  {option.label}
                </span>
              </div>
              {option.description && (
                <p className={`mt-1 text-xs ml-6 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`}>
                  {option.description}
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default FormRenderer;
