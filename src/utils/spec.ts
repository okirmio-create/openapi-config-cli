import { readFileSync, writeFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import type { OpenAPISpec } from './types.js';

export const SPEC_FILE = 'openapi.yaml';

export function loadSpec(filePath: string = SPEC_FILE): OpenAPISpec {
  if (!existsSync(filePath)) {
    throw new Error(`Spec file not found: ${filePath}. Run 'openapi-config init' first.`);
  }
  const content = readFileSync(filePath, 'utf-8');
  return yaml.load(content) as OpenAPISpec;
}

export function saveSpec(spec: OpenAPISpec, filePath: string = SPEC_FILE): void {
  const content = yaml.dump(spec, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  });
  writeFileSync(filePath, content, 'utf-8');
}

export function parseSpec(filePath: string): OpenAPISpec {
  const content = readFileSync(filePath, 'utf-8');
  const ext = filePath.split('.').pop()?.toLowerCase();
  if (ext === 'json') {
    return JSON.parse(content) as OpenAPISpec;
  }
  return yaml.load(content) as OpenAPISpec;
}

export function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const result = { ...target };
  for (const key in source) {
    const sourceVal = source[key];
    const targetVal = result[key];
    if (
      sourceVal !== null &&
      typeof sourceVal === 'object' &&
      !Array.isArray(sourceVal) &&
      targetVal !== null &&
      typeof targetVal === 'object' &&
      !Array.isArray(targetVal)
    ) {
      result[key] = deepMerge(
        targetVal as Record<string, unknown>,
        sourceVal as Record<string, unknown>
      ) as T[typeof key];
    } else if (Array.isArray(sourceVal) && Array.isArray(targetVal)) {
      result[key] = [...targetVal, ...sourceVal] as T[typeof key];
    } else {
      result[key] = sourceVal as T[typeof key];
    }
  }
  return result;
}
