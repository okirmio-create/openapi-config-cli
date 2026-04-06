import { existsSync } from 'fs';
import type { OpenAPISpec } from '../types.js';
import { loadSpec, parseSpec, saveSpec, deepMerge } from '../utils/spec.js';
import { success, error, info, warn } from '../utils/logger.js';

export function mergeCommand(file1: string, file2: string): void {
  if (!existsSync(file1)) {
    error(`File not found: ${file1}`);
    process.exit(1);
  }
  if (!existsSync(file2)) {
    error(`File not found: ${file2}`);
    process.exit(1);
  }

  let spec1: OpenAPISpec;
  let spec2: OpenAPISpec;

  try {
    spec1 = parseSpec(file1);
  } catch (e) {
    error(`Failed to parse ${file1}: ${(e as Error).message}`);
    process.exit(1);
  }

  try {
    spec2 = parseSpec(file2);
  } catch (e) {
    error(`Failed to parse ${file2}: ${(e as Error).message}`);
    process.exit(1);
  }

  // Check version compatibility
  const v1Major = spec1.openapi.split('.')[0];
  const v2Major = spec2.openapi.split('.')[0];
  if (v1Major !== v2Major) {
    warn(`Merging specs with different major versions: ${spec1.openapi} and ${spec2.openapi}`);
  }

  // Detect path conflicts
  const paths1 = Object.keys(spec1.paths ?? {});
  const paths2 = Object.keys(spec2.paths ?? {});
  const conflictingPaths: string[] = [];

  for (const path of paths2) {
    if (paths1.includes(path)) {
      const methods1 = Object.keys(spec1.paths[path] ?? {});
      const methods2 = Object.keys(spec2.paths[path] ?? {});
      const conflictingMethods = methods1.filter((m) => methods2.includes(m));
      if (conflictingMethods.length > 0) {
        conflictingPaths.push(`${path} [${conflictingMethods.join(', ')}]`);
      }
    }
  }

  if (conflictingPaths.length > 0) {
    warn(`Conflicts detected (spec2 will override spec1):`);
    conflictingPaths.forEach((p) => console.log(`  - ${p}`));
  }

  // Detect schema conflicts
  const schemas1 = Object.keys(spec1.components?.schemas ?? {});
  const schemas2 = Object.keys(spec2.components?.schemas ?? {});
  const conflictingSchemas = schemas1.filter((s) => schemas2.includes(s));
  if (conflictingSchemas.length > 0) {
    warn(`Schema conflicts (spec2 will override spec1): ${conflictingSchemas.join(', ')}`);
  }

  const merged = deepMerge(spec1 as unknown as Record<string, unknown>, spec2 as unknown as Record<string, unknown>) as unknown as OpenAPISpec;

  // Use the higher version
  if (spec2.openapi > spec1.openapi) {
    merged.openapi = spec2.openapi;
  } else {
    merged.openapi = spec1.openapi;
  }

  // Merge info
  merged.info = { ...spec1.info, ...spec2.info };

  // Merge paths (spec2 overrides spec1 at method level)
  merged.paths = { ...spec1.paths };
  for (const [path, pathItem] of Object.entries(spec2.paths ?? {})) {
    if (merged.paths[path]) {
      merged.paths[path] = { ...merged.paths[path], ...pathItem };
    } else {
      merged.paths[path] = pathItem;
    }
  }

  // Merge components
  merged.components = {
    schemas: {
      ...(spec1.components?.schemas ?? {}),
      ...(spec2.components?.schemas ?? {}),
    },
    securitySchemes: {
      ...(spec1.components?.securitySchemes ?? {}),
      ...(spec2.components?.securitySchemes ?? {}),
    },
  };

  // Merge servers (deduplicate by URL)
  const allServers = [...(spec1.servers ?? []), ...(spec2.servers ?? [])];
  const seenUrls = new Set<string>();
  merged.servers = allServers.filter((s) => {
    if (seenUrls.has(s.url)) return false;
    seenUrls.add(s.url);
    return true;
  });

  // Merge tags (deduplicate by name)
  const allTags = [...(spec1.tags ?? []), ...(spec2.tags ?? [])];
  const seenTags = new Set<string>();
  merged.tags = allTags.filter((t) => {
    if (seenTags.has(t.name)) return false;
    seenTags.add(t.name);
    return true;
  });

  // Merge webhooks (3.1)
  if (spec1.webhooks ?? spec2.webhooks) {
    merged.webhooks = {
      ...(spec1.webhooks ?? {}),
      ...(spec2.webhooks ?? {}),
    };
  }

  saveSpec(merged);

  success(`Merged ${file1} + ${file2} → openapi.yaml`);
  info(`Paths: ${Object.keys(merged.paths).length}`);
  info(`Schemas: ${Object.keys(merged.components?.schemas ?? {}).length}`);
  info(`Servers: ${merged.servers?.length ?? 0}`);
}
