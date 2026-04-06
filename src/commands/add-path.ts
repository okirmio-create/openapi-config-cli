import chalk from 'chalk';
import type { OperationObject, ParameterObject, RequestBodyObject, HttpMethod } from '../types.js';
import { loadSpec, saveSpec } from '../utils/spec.js';
import { success, error, info } from '../utils/logger.js';

/** Simple singularizer: strips trailing 's' or 'ies'→'y' */
function singularize(word: string): string {
  if (word.endsWith('ies')) return word.slice(0, -3) + 'y';
  if (word.endsWith('ses') || word.endsWith('xes') || word.endsWith('zes')) return word.slice(0, -2);
  if (word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

/** Extract the last non-param path segment (singular, PascalCase) */
function getResourceName(path: string): string {
  const raw = path.split('/').filter(Boolean).filter((s) => !s.startsWith('{')).pop() ?? 'resource';
  const singular = singularize(raw);
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/** True when path ends with a param like /users/{id} */
function isItemRoute(path: string): boolean {
  return path.trim().endsWith('}');
}

function buildPathParams(path: string): ParameterObject[] {
  const matches = path.match(/\{([^}]+)\}/g) ?? [];
  return matches.map((m) => ({
    name: m.slice(1, -1),
    in: 'path' as const,
    required: true,
    schema: { type: 'string' },
    description: `${m.slice(1, -1)} parameter`,
  }));
}

function buildRequestBody(method: string, path: string): RequestBodyObject | undefined {
  if (!['post', 'put', 'patch'].includes(method)) return undefined;

  const cleanName = getResourceName(path);

  return {
    required: true,
    content: {
      'application/json': {
        schema: {
          $ref: `#/components/schemas/${cleanName}Create`,
        },
        examples: {
          example1: {
            summary: `Example ${cleanName.toLowerCase()} creation`,
            value: {
              name: 'Example Name',
            },
          },
        },
      },
      'multipart/form-data': {
        schema: {
          type: 'object',
          properties: {
            file: {
              type: 'string',
              format: 'binary',
              description: 'File upload (optional)',
            },
          },
        },
      },
    },
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildResponses(method: string, path: string): Record<string, any> {
  const cleanName = getResourceName(path);
  const isList = method === 'get' && !isItemRoute(path);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const responses: Record<string, any> = {};

  if (method === 'delete') {
    responses['204'] = { description: 'Resource deleted successfully' };
  } else if (method === 'post') {
    responses['201'] = {
      description: 'Resource created successfully',
      content: {
        'application/json': {
          schema: { $ref: `#/components/schemas/${cleanName}` },
        },
      },
    };
  } else {
    // For list routes use an inline wrapper schema with data array + pagination meta
    const successSchema = isList
      ? {
          type: 'object',
          properties: {
            data: {
              type: 'array',
              items: { $ref: `#/components/schemas/${cleanName}` },
            },
            meta: { $ref: '#/components/schemas/PaginationMeta' },
          },
        }
      : { $ref: `#/components/schemas/${cleanName}` };

    responses['200'] = {
      description: 'Successful response',
      content: {
        'application/json': {
          schema: successSchema,
        },
        'text/event-stream': {
          schema: { $ref: '#/components/schemas/SSEEvent' },
        },
      },
    };
  }

  responses['400'] = {
    description: 'Bad request',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetail' },
      },
    },
  };
  responses['401'] = {
    description: 'Unauthorized',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetail' },
      },
    },
  };
  responses['404'] = {
    description: 'Resource not found',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetail' },
      },
    },
  };
  responses['422'] = {
    description: 'Validation error',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ValidationError' },
      },
    },
  };
  responses['500'] = {
    description: 'Internal server error',
    content: {
      'application/problem+json': {
        schema: { $ref: '#/components/schemas/ProblemDetail' },
      },
    },
  };

  return responses;
}

function buildQueryParams(method: string, path: string): ParameterObject[] {
  if (method !== 'get') return [];
  const isList = !path.endsWith('}');
  if (!isList) return [];

  return [
    {
      name: 'page',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, default: 1 },
      description: 'Page number',
    },
    {
      name: 'limit',
      in: 'query',
      required: false,
      schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
      description: 'Items per page',
    },
    {
      name: 'sort',
      in: 'query',
      required: false,
      schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' },
      description: 'Sort direction',
    },
    {
      name: 'search',
      in: 'query',
      required: false,
      schema: { type: 'string' },
      description: 'Search query',
    },
  ];
}

export function addPathCommand(method: string, path: string): void {
  const normalizedMethod = method.toLowerCase() as HttpMethod;
  const validMethods: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'];

  if (!validMethods.includes(normalizedMethod)) {
    error(`Invalid HTTP method "${method}". Valid: ${validMethods.join(', ')}`);
    process.exit(1);
  }

  if (!path.startsWith('/')) {
    error('Path must start with /');
    process.exit(1);
  }

  const spec = loadSpec();

  if (!spec.paths[path]) {
    spec.paths[path] = {};
  }

  if (spec.paths[path][normalizedMethod]) {
    error(`${method.toUpperCase()} ${path} already exists`);
    process.exit(1);
  }

  const pathParams = buildPathParams(path);
  const queryParams = buildQueryParams(normalizedMethod, path);
  const allParams = [...pathParams, ...queryParams];

  const cleanName = getResourceName(path);
  // Use plural (raw) segment for tag display
  const rawSegment = path.split('/').filter(Boolean).filter((s) => !s.startsWith('{')).pop() ?? 'resource';
  const tag = rawSegment.charAt(0).toUpperCase() + rawSegment.slice(1).replace(/-/g, ' ');
  // Distinguish list vs item in operationId: getUsers vs getUser
  const isItem = isItemRoute(path);
  const operationIdName = isItem ? cleanName : (rawSegment.charAt(0).toUpperCase() + rawSegment.slice(1));
  const methodPrefix = normalizedMethod === 'get' && !isItem ? 'list' : normalizedMethod;

  const operation: OperationObject = {
    operationId: `${methodPrefix}${operationIdName}`,
    summary: `${method.toUpperCase()} ${path}`,
    description: `Endpoint for ${method.toUpperCase()} ${path}`,
    tags: [tag],
    parameters: allParams.length > 0 ? allParams : undefined,
    requestBody: buildRequestBody(normalizedMethod, path),
    responses: buildResponses(normalizedMethod, path),
    security: [{ bearerAuth: [] }],
  };

  spec.paths[path][normalizedMethod] = operation;

  // Ensure the tag is in the tags array
  if (!spec.tags) spec.tags = [];
  if (!spec.tags.find((t) => t.name === tag)) {
    spec.tags.push({ name: tag, description: `${tag} endpoints` });
  }

  // Add ProblemDetail schema if not present
  if (!spec.components) spec.components = {};
  if (!spec.components.schemas) spec.components.schemas = {};

  if (!spec.components.schemas['ProblemDetail']) {
    spec.components.schemas['ProblemDetail'] = {
      type: 'object',
      description: 'RFC 7807 Problem Details',
      properties: {
        type: { type: 'string', format: 'uri', description: 'Problem type URI' },
        title: { type: 'string', description: 'Short summary' },
        status: { type: 'integer', description: 'HTTP status code' },
        detail: { type: 'string', description: 'Human-readable explanation' },
        instance: { type: 'string', format: 'uri', description: 'Problem instance URI' },
      },
    };
  }

  if (!spec.components.schemas['ValidationError']) {
    spec.components.schemas['ValidationError'] = {
      allOf: [
        { $ref: '#/components/schemas/ProblemDetail' },
        {
          type: 'object',
          properties: {
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string' },
                  message: { type: 'string' },
                  code: { type: 'string' },
                },
                required: ['field', 'message'],
              },
            },
          },
        },
      ],
    };
  }

  if (!spec.components.schemas['SSEEvent']) {
    spec.components.schemas['SSEEvent'] = {
      type: 'object',
      description: 'Server-Sent Event for streaming responses',
      properties: {
        id: { type: 'string', description: 'Event ID' },
        event: { type: 'string', description: 'Event type' },
        data: { type: 'string', description: 'Event data (JSON string)' },
        retry: { type: 'integer', description: 'Reconnection time in milliseconds' },
      },
    };
  }

  saveSpec(spec);

  success(`Added ${chalk.bold(method.toUpperCase())} ${chalk.bold(path)}`);
  info('Included: path params, query params (for GET list), request body (for POST/PUT/PATCH), RFC 7807 error responses, SSE streaming');
}
