import { existsSync } from 'fs';
import chalk from 'chalk';
import type { OpenAPISpec, PathItem, OperationObject, SchemaObject } from '../types.js';
import { loadSpec, parseSpec } from '../utils/spec.js';
import { success, error, warn, info, header, listItem } from '../utils/logger.js';

interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  path?: string;
}

function validateSchema(schema: SchemaObject, path: string, issues: ValidationIssue[]): void {
  if (schema.$ref) {
    if (!schema.$ref.startsWith('#/') && !schema.$ref.startsWith('http')) {
      issues.push({ severity: 'warning', message: `Potentially invalid $ref: ${schema.$ref}`, path });
    }
    return;
  }

  if (schema.type === 'array' && !schema.items) {
    issues.push({ severity: 'warning', message: 'Array schema missing "items"', path });
  }

  if (schema.type === 'object' && schema.required) {
    const props = Object.keys(schema.properties ?? {});
    for (const req of schema.required) {
      if (!props.includes(req)) {
        issues.push({
          severity: 'error',
          message: `Required field "${req}" not in properties`,
          path,
        });
      }
    }
  }

  if (schema.properties) {
    for (const [key, prop] of Object.entries(schema.properties)) {
      validateSchema(prop, `${path}.properties.${key}`, issues);
    }
  }

  if (schema.items) {
    validateSchema(schema.items, `${path}.items`, issues);
  }
}

function validateOperation(
  op: OperationObject,
  method: string,
  path: string,
  issues: ValidationIssue[]
): void {
  const loc = `${method.toUpperCase()} ${path}`;

  if (!op.responses || Object.keys(op.responses).length === 0) {
    issues.push({ severity: 'error', message: 'No responses defined', path: loc });
  }

  // Check for at least one success response
  const successCodes = Object.keys(op.responses ?? {}).filter(
    (c) => c.startsWith('2') || c === 'default'
  );
  if (successCodes.length === 0) {
    issues.push({ severity: 'warning', message: 'No success (2xx) response defined', path: loc });
  }

  if (!op.operationId) {
    issues.push({ severity: 'warning', message: 'Missing operationId', path: loc });
  }

  if (!op.summary && !op.description) {
    issues.push({ severity: 'warning', message: 'Missing summary and description', path: loc });
  }

  // Validate path parameters
  const pathParams = (path.match(/\{([^}]+)\}/g) ?? []).map((p) => p.slice(1, -1));
  const definedParams = (op.parameters ?? [])
    .filter((p) => p.in === 'path')
    .map((p) => p.name);

  for (const param of pathParams) {
    if (!definedParams.includes(param)) {
      issues.push({
        severity: 'error',
        message: `Path parameter {${param}} not defined in parameters`,
        path: loc,
      });
    }
  }

  // Validate request body for methods that shouldn't have one
  if (op.requestBody && ['get', 'head', 'delete'].includes(method.toLowerCase())) {
    issues.push({
      severity: 'warning',
      message: `Request body on ${method.toUpperCase()} is unusual`,
      path: loc,
    });
  }
}

function validatePathItem(pathItem: PathItem, path: string, issues: ValidationIssue[]): void {
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
  for (const method of methods) {
    const op = pathItem[method];
    if (op) {
      validateOperation(op, method, path, issues);
    }
  }
}

function validateSpec(spec: OpenAPISpec): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Required fields
  if (!spec.openapi) {
    issues.push({ severity: 'error', message: 'Missing required field: openapi' });
  } else if (!spec.openapi.match(/^3\.[01]\.\d+$/)) {
    issues.push({
      severity: 'error',
      message: `Invalid openapi version: ${spec.openapi}. Must be 3.0.x or 3.1.x`,
    });
  }

  if (!spec.info) {
    issues.push({ severity: 'error', message: 'Missing required field: info' });
  } else {
    if (!spec.info.title) {
      issues.push({ severity: 'error', message: 'Missing required field: info.title' });
    }
    if (!spec.info.version) {
      issues.push({ severity: 'error', message: 'Missing required field: info.version' });
    }
  }

  if (!spec.paths && !spec.webhooks) {
    issues.push({ severity: 'warning', message: 'No paths or webhooks defined' });
  }

  // Validate paths
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    if (!path.startsWith('/')) {
      issues.push({ severity: 'error', message: `Path must start with /: ${path}` });
    }
    validatePathItem(pathItem, path, issues);
  }

  // Validate schemas
  for (const [name, schema] of Object.entries(spec.components?.schemas ?? {})) {
    validateSchema(schema, `components.schemas.${name}`, issues);
  }

  // Validate security schemes referenced in operations
  const definedSchemes = Object.keys(spec.components?.securitySchemes ?? {});
  const checkSecurity = (security: Array<Record<string, string[]>>, loc: string) => {
    for (const req of security) {
      for (const schemeName of Object.keys(req)) {
        if (!definedSchemes.includes(schemeName)) {
          issues.push({
            severity: 'error',
            message: `Security scheme "${schemeName}" not defined in components.securitySchemes`,
            path: loc,
          });
        }
      }
    }
  };

  if (spec.security) {
    checkSecurity(spec.security, 'global security');
  }

  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
    for (const method of methods) {
      const op = pathItem[method];
      if (op?.security) {
        checkSecurity(op.security, `${method.toUpperCase()} ${path}`);
      }
    }
  }

  // Validate $ref references
  function checkRefs(obj: unknown, path: string) {
    if (typeof obj !== 'object' || obj === null) return;
    if (Array.isArray(obj)) {
      obj.forEach((item, i) => checkRefs(item, `${path}[${i}]`));
      return;
    }
    const record = obj as Record<string, unknown>;
    if (record['$ref'] && typeof record['$ref'] === 'string') {
      const ref = record['$ref'] as string;
      if (ref.startsWith('#/')) {
        // Check internal ref
        const parts = ref.slice(2).split('/');
        let current: unknown = spec;
        for (const part of parts) {
          if (typeof current !== 'object' || current === null) {
            current = undefined;
            break;
          }
          current = (current as Record<string, unknown>)[part];
        }
        if (current === undefined) {
          issues.push({
            severity: 'error',
            message: `Broken $ref: ${ref}`,
            path,
          });
        }
      }
    }
    for (const [key, val] of Object.entries(record)) {
      if (key !== '$ref') {
        checkRefs(val, `${path}.${key}`);
      }
    }
  }

  checkRefs(spec, 'root');

  // Servers validation
  if (spec.servers && spec.servers.length > 0) {
    for (const server of spec.servers) {
      if (!server.url) {
        issues.push({ severity: 'error', message: 'Server missing url field' });
      }
    }
  }

  // Check for duplicate operationIds
  const operationIds = new Map<string, string>();
  for (const [path, pathItem] of Object.entries(spec.paths ?? {})) {
    const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
    for (const method of methods) {
      const op = pathItem[method];
      if (op?.operationId) {
        const existing = operationIds.get(op.operationId);
        if (existing) {
          issues.push({
            severity: 'error',
            message: `Duplicate operationId "${op.operationId}" (also used in ${existing})`,
            path: `${method.toUpperCase()} ${path}`,
          });
        } else {
          operationIds.set(op.operationId, `${method.toUpperCase()} ${path}`);
        }
      }
    }
  }

  return issues;
}

export function validateCommand(file?: string): void {
  const targetFile = file ?? 'openapi.yaml';

  if (!existsSync(targetFile)) {
    error(`File not found: ${targetFile}`);
    process.exit(1);
  }

  let spec: OpenAPISpec;
  try {
    spec = parseSpec(targetFile);
  } catch (e) {
    error(`Failed to parse ${targetFile}: ${(e as Error).message}`);
    process.exit(1);
  }

  header(`Validating ${targetFile}`);

  const issues = validateSpec(spec);
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');

  if (errors.length > 0) {
    console.log(chalk.red(`\n  Errors (${errors.length}):`));
    for (const issue of errors) {
      console.log(chalk.red('  ✗') + ' ' + (issue.path ? chalk.gray(`[${issue.path}] `) : '') + issue.message);
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`\n  Warnings (${warnings.length}):`));
    for (const issue of warnings) {
      console.log(chalk.yellow('  ⚠') + ' ' + (issue.path ? chalk.gray(`[${issue.path}] `) : '') + issue.message);
    }
  }

  // Summary stats
  console.log('');
  const pathCount = Object.keys(spec.paths ?? {}).length;
  const schemaCount = Object.keys(spec.components?.schemas ?? {}).length;
  const securityCount = Object.keys(spec.components?.securitySchemes ?? {}).length;
  const webhookCount = Object.keys(spec.webhooks ?? {}).length;
  const serverCount = spec.servers?.length ?? 0;

  info(`OpenAPI ${spec.openapi} — ${spec.info?.title ?? 'Untitled'} v${spec.info?.version ?? '?'}`);
  listItem(`Paths: ${pathCount}`);
  listItem(`Schemas: ${schemaCount}`);
  listItem(`Security schemes: ${securityCount}`);
  listItem(`Servers: ${serverCount}`);
  if (webhookCount > 0) listItem(`Webhooks: ${webhookCount}`);

  console.log('');
  if (errors.length === 0 && warnings.length === 0) {
    success('Spec is valid — no issues found');
  } else if (errors.length === 0) {
    success(`Valid with ${warnings.length} warning(s)`);
  } else {
    error(`Invalid — ${errors.length} error(s), ${warnings.length} warning(s)`);
    process.exit(1);
  }
}
