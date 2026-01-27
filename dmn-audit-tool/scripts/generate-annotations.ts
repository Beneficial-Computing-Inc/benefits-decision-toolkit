#!/usr/bin/env npx tsx
/**
 * BKM Annotation Generator
 *
 * Batch generates annotations for DMN checks using Groq LLM API.
 *
 * Usage:
 *   GROQ_API_KEY=your-key npx tsx scripts/generate-annotations.ts
 *
 * Options:
 *   --dry-run    Show what would be generated without calling LLM
 *   --check=ID   Generate annotations for a specific check only
 *   --force      Regenerate all annotations (ignore existing)
 */

import * as fs from 'fs';
import * as path from 'path';
import { XMLParser } from 'fast-xml-parser';

// Types
interface Annotation {
  id: string;
  explanation: string;
  pomsReferences: string[];
  plainLanguageSummary: string;
  source: 'llm' | 'manual' | 'imported';
  updatedAt: string;
  model?: string;
}

interface CheckAnnotations {
  checkId: string;
  modelAnnotation?: Annotation;
  decisionAnnotations: Record<string, Annotation>;
  contextEntryAnnotations: Record<string, Annotation>;
}

interface AnnotationsIndex {
  version: string;
  generatedAt: string;
  totalAnnotations: number;
  checks: Record<string, CheckAnnotations>;
}

interface ParsedDmn {
  id: string;
  name: string;
  category: string;
  description: string;
  decisions: Array<{
    name: string;
    description: string;
    contextEntries: Array<{
      variable: string;
      feelExpression: string;
    }>;
  }>;
}

// Configuration
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = 'openai/gpt-oss-120b';
const MIN_DELAY_MS = 1000; // Rate limiting
const MAX_RETRIES = 3;

// XML Parser
const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: false,
  parseAttributeValue: false,
  trimValues: true,
  isArray: (name) => ['dmn:import', 'dmn:itemComponent', 'dmn:contextEntry', 'dmn:binding', 'dmn:decision'].includes(name),
});

/**
 * Parses a DMN file and extracts relevant information.
 */
function parseDmnFile(filePath: string): ParsedDmn | null {
  try {
    const xml = fs.readFileSync(filePath, 'utf-8');
    const parsed = xmlParser.parse(xml);
    const definitions = parsed['dmn:definitions'];

    if (!definitions) return null;

    const id = definitions['@_name'] || 'Unknown';
    const description = definitions['dmn:description'] || '';

    // Extract category from file path
    const parts = filePath.split('/');
    const checksIndex = parts.indexOf('checks');
    const category = checksIndex >= 0 ? parts[checksIndex + 1] || 'general' : 'general';

    // Parse decisions
    const decisionNodes = definitions['dmn:decision'] || [];
    const decisions = (Array.isArray(decisionNodes) ? decisionNodes : [decisionNodes])
      .filter((d): d is Record<string, unknown> => d != null)
      .map((d) => {
        const context = d['dmn:context'] as Record<string, unknown> | undefined;
        const entries = context?.['dmn:contextEntry'] || [];
        const contextEntries = (Array.isArray(entries) ? entries : [entries])
          .filter((e): e is Record<string, unknown> => e != null)
          .map((e) => {
            const variable = e['dmn:variable'] as Record<string, unknown> | undefined;
            const literal = e['dmn:literalExpression'] as Record<string, unknown> | undefined;
            return {
              variable: variable?.['@_name'] as string || '',
              feelExpression: literal?.['dmn:text'] as string || '',
            };
          })
          .filter((e) => e.variable && e.feelExpression);

        return {
          name: d['@_name'] as string || '',
          description: d['dmn:description'] as string || '',
          contextEntries,
        };
      });

    return {
      id,
      name: toReadableName(id),
      category,
      description,
      decisions,
    };
  } catch (error) {
    console.error(`Failed to parse ${filePath}:`, error);
    return null;
  }
}

/**
 * Converts PascalCase/camelCase to readable name.
 */
function toReadableName(id: string): string {
  return id
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Calls Groq API to generate an annotation.
 */
async function generateAnnotation(
  elementType: 'model' | 'decision' | 'contextEntry',
  checkName: string,
  elementName: string,
  category: string,
  feelExpression?: string,
  existingDescription?: string
): Promise<{ explanation: string; pomsReferences: string[]; plainLanguageSummary: string } | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    console.error('GROQ_API_KEY environment variable not set');
    return null;
  }

  const prompt = buildPrompt(elementType, checkName, elementName, category, feelExpression, existingDescription);

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'system',
              content: `You are an expert in Social Security Administration rules and DMN decision modeling.
Generate concise annotations for DMN eligibility rules.
Your response must be valid JSON with this structure:
{
  "explanation": "Technical explanation of what this rule/expression does",
  "pomsReferences": ["SI 00501.001", "SI 00810.010"],
  "plainLanguageSummary": "Simple explanation for non-technical users"
}`,
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
          temperature: 0.3,
          max_tokens: 1000,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        if (response.status === 429) {
          // Rate limited, wait and retry
          const delay = Math.pow(2, attempt + 1) * 1000;
          console.log(`Rate limited, waiting ${delay}ms...`);
          await sleep(delay);
          continue;
        }
        throw new Error(`API error: ${response.status} ${error}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('Empty response from API');
      }

      // Parse JSON from response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      return {
        explanation: parsed.explanation || '',
        pomsReferences: parsed.pomsReferences || [],
        plainLanguageSummary: parsed.plainLanguageSummary || '',
      };
    } catch (error) {
      console.error(`Attempt ${attempt + 1} failed:`, error);
      if (attempt === MAX_RETRIES - 1) {
        return null;
      }
      await sleep(MIN_DELAY_MS * (attempt + 1));
    }
  }

  return null;
}

/**
 * Builds the prompt for annotation generation.
 */
function buildPrompt(
  elementType: 'model' | 'decision' | 'contextEntry',
  checkName: string,
  elementName: string,
  category: string,
  feelExpression?: string,
  existingDescription?: string
): string {
  const parts = [
    `Generate an annotation for a DMN ${elementType} in an SSI eligibility screener.`,
    `\nCheck: ${checkName}`,
    `Category: ${category}`,
    `Element: ${elementName}`,
  ];

  if (existingDescription) {
    parts.push(`\nExisting description: ${existingDescription}`);
  }

  if (feelExpression) {
    parts.push(`\nFEEL expression:\n${feelExpression}`);
  }

  parts.push(`\nProvide:
1. Technical explanation of what this ${elementType === 'contextEntry' ? 'expression' : elementType} does
2. Relevant POMS (Program Operations Manual System) section references
3. Plain language summary for claimants/non-technical users`);

  return parts.join('\n');
}

/**
 * Sleeps for the specified duration.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Finds all DMN files in the public/dmn directory.
 */
function findDmnFiles(dir: string): string[] {
  const files: string[] = [];

  if (!fs.existsSync(dir)) {
    return files;
  }

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findDmnFiles(fullPath));
    } else if (entry.name.endsWith('.dmn')) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main function.
 */
async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const force = args.includes('--force');
  const checkFilter = args.find((a) => a.startsWith('--check='))?.split('=')[1];

  console.log('BKM Annotation Generator');
  console.log('========================');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'GENERATE'}`);
  console.log(`Force: ${force}`);
  if (checkFilter) {
    console.log(`Filter: ${checkFilter}`);
  }
  console.log('');

  // Find DMN files
  const dmnDir = path.join(process.cwd(), 'public', 'dmn');
  const dmnFiles = findDmnFiles(dmnDir);

  console.log(`Found ${dmnFiles.length} DMN files`);

  // Load existing annotations
  const annotationsPath = path.join(process.cwd(), 'public', 'data', 'annotations.json');
  let existingIndex: AnnotationsIndex = {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalAnnotations: 0,
    checks: {},
  };

  if (fs.existsSync(annotationsPath) && !force) {
    try {
      existingIndex = JSON.parse(fs.readFileSync(annotationsPath, 'utf-8'));
      console.log(`Loaded ${existingIndex.totalAnnotations} existing annotations`);
    } catch {
      console.log('Failed to load existing annotations, starting fresh');
    }
  }

  // Process each DMN file
  let generated = 0;
  let skipped = 0;

  for (const filePath of dmnFiles) {
    const dmn = parseDmnFile(filePath);
    if (!dmn) {
      console.log(`Skipping ${filePath} (parse failed)`);
      continue;
    }

    if (checkFilter && dmn.id !== checkFilter) {
      continue;
    }

    console.log(`\nProcessing: ${dmn.id}`);

    // Check if already annotated
    if (existingIndex.checks[dmn.id] && !force) {
      console.log(`  Already annotated, skipping`);
      skipped++;
      continue;
    }

    if (dryRun) {
      console.log(`  Would generate annotations for:`);
      console.log(`    - Model annotation`);
      for (const decision of dmn.decisions) {
        console.log(`    - Decision: ${decision.name}`);
        for (const entry of decision.contextEntries) {
          console.log(`      - Context: ${entry.variable}`);
        }
      }
      continue;
    }

    // Generate annotations
    const checkAnnotations: CheckAnnotations = {
      checkId: dmn.id,
      decisionAnnotations: {},
      contextEntryAnnotations: {},
    };

    // Model-level annotation
    console.log(`  Generating model annotation...`);
    const modelResult = await generateAnnotation(
      'model',
      dmn.name,
      dmn.id,
      dmn.category,
      undefined,
      dmn.description
    );

    if (modelResult) {
      checkAnnotations.modelAnnotation = {
        id: `${dmn.id}.model`,
        ...modelResult,
        source: 'llm',
        updatedAt: new Date().toISOString(),
        model: GROQ_MODEL,
      };
      generated++;
    }

    await sleep(MIN_DELAY_MS);

    // Decision-level annotations
    for (const decision of dmn.decisions) {
      if (!decision.name) continue;

      console.log(`  Generating decision annotation: ${decision.name}...`);
      const decisionResult = await generateAnnotation(
        'decision',
        dmn.name,
        decision.name,
        dmn.category,
        undefined,
        decision.description
      );

      if (decisionResult) {
        checkAnnotations.decisionAnnotations[decision.name] = {
          id: `${dmn.id}.${decision.name}`,
          ...decisionResult,
          source: 'llm',
          updatedAt: new Date().toISOString(),
          model: GROQ_MODEL,
        };
        generated++;
      }

      await sleep(MIN_DELAY_MS);

      // Context entry annotations (limit to important ones)
      const importantEntries = decision.contextEntries.filter(
        (e) => e.variable === 'result' || e.variable === 'checkResult' || e.feelExpression.length > 20
      );

      for (const entry of importantEntries.slice(0, 5)) {
        console.log(`    Generating context annotation: ${entry.variable}...`);
        const entryResult = await generateAnnotation(
          'contextEntry',
          dmn.name,
          entry.variable,
          dmn.category,
          entry.feelExpression,
          undefined
        );

        if (entryResult) {
          const key = `${decision.name}.${entry.variable}`;
          checkAnnotations.contextEntryAnnotations[key] = {
            id: `${dmn.id}.${key}`,
            ...entryResult,
            source: 'llm',
            updatedAt: new Date().toISOString(),
            model: GROQ_MODEL,
          };
          generated++;
        }

        await sleep(MIN_DELAY_MS);
      }
    }

    existingIndex.checks[dmn.id] = checkAnnotations;
  }

  // Update totals
  existingIndex.totalAnnotations = Object.values(existingIndex.checks).reduce((sum, check) => {
    return sum +
      (check.modelAnnotation ? 1 : 0) +
      Object.keys(check.decisionAnnotations).length +
      Object.keys(check.contextEntryAnnotations).length;
  }, 0);
  existingIndex.generatedAt = new Date().toISOString();

  // Save annotations
  if (!dryRun) {
    const dataDir = path.join(process.cwd(), 'public', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(annotationsPath, JSON.stringify(existingIndex, null, 2));
    console.log(`\nSaved annotations to ${annotationsPath}`);
  }

  console.log(`\nSummary:`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped: ${skipped}`);
  console.log(`  Total: ${existingIndex.totalAnnotations}`);
}

main().catch(console.error);
