/**
 * Form Schema Generator
 *
 * Transforms OpenAPI type schemas into form-js compatible form schemas.
 * Applies UX overrides for labels, help text, enums, and section groupings.
 */

import type { FormSchema, FormField, FieldType } from './types';
import type { ExtractedSchemas, PropertySchema } from './openapi-schema';

// ============================================================================
// Types
// ============================================================================

export interface UXOverrides {
  fields: Record<string, FieldOverride>;
  sections: SectionDefinition[];
  convenienceFields: ConvenienceFieldDefinition[];
  spouseFields: SpouseFieldConfig;
}

export interface FieldOverride {
  label?: string;
  description?: string;
  helpText?: string;
  placeholder?: string;
  values?: Array<{ label: string; value: string }>;
  type?: string; // Override the auto-detected type
  validate?: {
    required?: boolean;
    min?: number;
    max?: number;
  };
}

export interface SectionDefinition {
  id: string;
  label: string;
  collapsed?: boolean;
  fields: string[];
  description?: string;
}

export interface ConvenienceFieldDefinition {
  id: string;
  key: string;
  type: string;
  label: string;
  description?: string;
  validate?: {
    required?: boolean;
    min?: number;
    max?: number;
  };
}

export interface SpouseFieldConfig {
  enabled: boolean;
  sourceFields: string[]; // Which tPerson fields to duplicate for spouse
  triggerField: string; // e.g., 'hasSpouse'
}

// Internal type for building fields dynamically
type PartialField = Record<string, unknown>;

// ============================================================================
// Type Mapping
// ============================================================================

function mapOpenAPITypeToFormType(
  type: string,
  format?: string,
  isArrayItem = false
): FieldType {
  if (format === 'date') return 'date';

  switch (type) {
    case 'string':
      return 'textfield';
    case 'boolean':
      // Use checkbox for array items (more compact), yes_no for main form
      return isArrayItem ? 'checkbox' : 'yes_no';
    case 'number':
    case 'integer':
      return 'number';
    case 'array':
      return 'dynamiclist';
    default:
      return 'textfield';
  }
}

function camelToLabel(camelCase: string): string {
  return camelCase
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}

// ============================================================================
// Field Generators
// ============================================================================

function generateFieldFromProperty(
  prop: PropertySchema,
  overrides: UXOverrides,
  category: string,
  isArrayItem = false
): PartialField {
  const override = overrides.fields[prop.name] || {};
  const formType =
    (override.type as FieldType) ||
    mapOpenAPITypeToFormType(prop.type, prop.format, isArrayItem);

  const field: PartialField = {
    id: `${category}_${prop.name}`,
    type: formType,
    key: prop.name,
    label: override.label || camelToLabel(prop.name),
  };

  // Add description/help text
  if (override.description || override.helpText || prop.description) {
    field.description =
      override.description || override.helpText || prop.description;
  }

  // Add enum values for select fields
  if (override.values && formType === 'select') {
    field.values = override.values;
  }

  // Add validation
  if (override.validate) {
    field.validate = override.validate;
  }

  return field;
}

function generateDynamicListField(
  key: string,
  label: string,
  properties: Record<string, PropertySchema>,
  overrides: UXOverrides
): PartialField {
  const components: PartialField[] = [];

  for (const [propName, prop] of Object.entries(properties)) {
    // Skip 'id' field - it's internal
    if (propName === 'id') continue;

    const field = generateFieldFromProperty(prop, overrides, key, true);
    components.push(field);
  }

  return {
    id: key,
    type: 'dynamiclist' as FieldType,
    key,
    label,
    path: key,
    components,
  };
}

// ============================================================================
// Section Generator
// ============================================================================

function generateSection(
  section: SectionDefinition,
  allFields: Map<string, PartialField>
): PartialField | null {
  const sectionFields: PartialField[] = [];

  for (const fieldKey of section.fields) {
    const field = allFields.get(fieldKey);
    if (field) {
      sectionFields.push(field);
      allFields.delete(fieldKey); // Remove from pool
    }
  }

  if (sectionFields.length === 0) {
    return null;
  }

  // Add section description as text field if present
  const components: PartialField[] = [];
  if (section.description) {
    components.push({
      id: `${section.id}_desc`,
      type: 'text' as FieldType,
      text: section.description,
    });
  }
  components.push(...sectionFields);

  return {
    id: section.id,
    type: 'section' as FieldType,
    label: section.label,
    collapsed: section.collapsed ?? false,
    components,
  };
}

// ============================================================================
// Spouse Field Generator
// ============================================================================

function generateSpouseFields(
  personFields: Map<string, PartialField>,
  config: SpouseFieldConfig,
  overrides: UXOverrides
): PartialField[] {
  if (!config.enabled) return [];

  const spouseFields: PartialField[] = [];

  // Add the trigger field (hasSpouse)
  const triggerOverride = overrides.fields[config.triggerField] || {};
  spouseFields.push({
    id: config.triggerField,
    type: 'yes_no' as FieldType,
    key: config.triggerField,
    label: triggerOverride.label || 'Does the person have a spouse?',
    description: triggerOverride.description,
  });

  // Generate spouse variants of specified fields
  for (const fieldKey of config.sourceFields) {
    const sourceField = personFields.get(fieldKey);
    if (!sourceField) continue;

    const spouseKey = `spouse${fieldKey.charAt(0).toUpperCase()}${fieldKey.slice(1)}`;
    const spouseOverride = overrides.fields[spouseKey] || {};

    const spouseField: PartialField = {
      ...sourceField,
      id: `spouse_${fieldKey}`,
      key: spouseKey,
      label:
        spouseOverride.label || `Spouse ${sourceField.label as string}`,
      conditional: { hide: `=${config.triggerField} != true` },
    };

    if (spouseOverride.description) {
      spouseField.description = spouseOverride.description;
    }

    spouseFields.push(spouseField);
  }

  return spouseFields;
}

// ============================================================================
// Main Generator
// ============================================================================

export async function generateFormSchema(
  schemas: ExtractedSchemas,
  overrides: UXOverrides,
  options: { benefitId?: string } = {}
): Promise<FormSchema> {
  const allFields = new Map<string, PartialField>();

  // Generate fields from tPerson
  for (const [propName, prop] of Object.entries(schemas.tPerson.properties)) {
    // Skip internal fields and arrays (handled separately)
    if (['id', 'resources', 'incomeSources'].includes(propName)) continue;

    const field = generateFieldFromProperty(prop, overrides, 'person');
    allFields.set(propName, field);
  }

  // Generate resources dynamiclist
  const resourcesField = generateDynamicListField(
    'resources',
    'Resources',
    schemas.tResource.properties,
    overrides
  );
  allFields.set('resources', resourcesField);

  // Generate incomeSources dynamiclist
  const incomeField = generateDynamicListField(
    'incomeSources',
    'Income Sources',
    schemas.tIncomeSource.properties,
    overrides
  );
  allFields.set('incomeSources', incomeField);

  // Generate simpleChecks fields
  for (const [propName, prop] of Object.entries(
    schemas.tSimpleChecks.properties
  )) {
    const field = generateFieldFromProperty(prop, overrides, 'simpleChecks');
    allFields.set(propName, field);
  }

  // Generate situation-level fields (evaluationDate, primaryPersonId)
  for (const [propName, prop] of Object.entries(
    schemas.tSituation.properties
  )) {
    if (
      ['people', 'relationships', 'simpleChecks', 'enrollments'].includes(
        propName
      )
    ) {
      continue;
    }
    const field = generateFieldFromProperty(prop, overrides, 'situation');
    allFields.set(propName, field);
  }

  // Add convenience fields (quick entry totals)
  for (const convField of overrides.convenienceFields) {
    const field: PartialField = {
      id: convField.id,
      type: convField.type as FieldType,
      key: convField.key,
      label: convField.label,
    };
    if (convField.description) {
      field.description = convField.description;
    }
    if (convField.validate) {
      field.validate = convField.validate;
    }
    allFields.set(convField.key, field);
  }

  // Generate spouse fields
  const spouseFields = generateSpouseFields(
    allFields,
    overrides.spouseFields,
    overrides
  );
  for (const field of spouseFields) {
    allFields.set(field.key as string, field);
  }

  // Build sections
  const components: PartialField[] = [];

  // Header
  components.push({
    id: 'header',
    type: 'text' as FieldType,
    text: '## SSI Eligibility Check (Auto-Generated)\n\nThis form is auto-generated from the OpenAPI schema.',
  });

  // Add sections in order
  for (const section of overrides.sections) {
    const sectionField = generateSection(section, allFields);
    if (sectionField) {
      components.push(sectionField);
    }
  }

  // Add any remaining fields that weren't in sections
  const remainingFields = Array.from(allFields.values());
  if (remainingFields.length > 0) {
    components.push({
      id: 'section_other',
      type: 'section' as FieldType,
      label: 'Other Fields',
      collapsed: true,
      components: remainingFields,
    });
  }

  // Submit button
  components.push({
    id: 'submit',
    type: 'button' as FieldType,
    label: 'Check Eligibility',
    action: 'submit',
  });

  return {
    type: 'default',
    id: `Form_${options.benefitId || 'SSI'}_Auto`,
    schemaVersion: 2,
    exporter: {
      name: 'DMN Audit Tool (Auto-Generator)',
      version: '3.0.0',
    },
    components: components as unknown as FormField[],
  };
}
