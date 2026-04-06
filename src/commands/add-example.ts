import chalk from 'chalk';
import type { ExampleObject, MediaTypeObject } from '../types.js';
import { loadSpec, saveSpec } from '../utils/spec.js';
import { success, error, info } from '../utils/logger.js';

function buildExamples(path: string, method: string): {
  requestExamples?: Record<string, ExampleObject>;
  responseExamples?: Record<string, ExampleObject>;
} {
  const resourceName = path.split('/').filter(Boolean).filter((s) => !s.startsWith('{')).pop() ?? 'resource';
  const cleanName = resourceName.charAt(0).toUpperCase() + resourceName.slice(1);
  const isList = method === 'get' && !path.endsWith('}');
  const isCreate = method === 'post';

  const requestExamples: Record<string, ExampleObject> = {};
  const responseExamples: Record<string, ExampleObject> = {};

  // Request body examples for mutating operations
  if (['post', 'put', 'patch'].includes(method)) {
    requestExamples['basic'] = {
      summary: `Basic ${cleanName.toLowerCase()} ${method === 'post' ? 'creation' : 'update'}`,
      description: `Minimal valid payload for ${method.toUpperCase()} ${path}`,
      value: {
        name: `Example ${cleanName}`,
        ...(method === 'post' ? { description: 'Auto-generated example' } : {}),
      },
    };

    requestExamples['full'] = {
      summary: `Full ${cleanName.toLowerCase()} ${method === 'post' ? 'creation' : 'update'} with all fields`,
      description: `Complete payload example with all available fields`,
      value: {
        name: `Example ${cleanName}`,
        description: 'Full example with all fields populated',
        status: 'active',
        tags: ['example', 'demo'],
      },
    };

    // File upload example for POST
    if (method === 'post') {
      requestExamples['with-file'] = {
        summary: 'Create with file attachment',
        description: 'Example showing multipart/form-data file upload',
        value: {
          name: `Example ${cleanName}`,
          file: '<binary file content>',
        },
      };
    }
  }

  // Response examples
  if (isList) {
    responseExamples['list-page-1'] = {
      summary: `First page of ${cleanName.toLowerCase()}s`,
      value: {
        data: [
          {
            id: '123e4567-e89b-12d3-a456-426614174000',
            name: `Example ${cleanName} 1`,
            createdAt: '2024-01-01T00:00:00Z',
          },
          {
            id: '223e4567-e89b-12d3-a456-426614174001',
            name: `Example ${cleanName} 2`,
            createdAt: '2024-01-02T00:00:00Z',
          },
        ],
        meta: {
          page: 1,
          limit: 20,
          total: 42,
          totalPages: 3,
          hasNext: true,
          hasPrev: false,
        },
        links: {
          self: `/api/v1${path}?page=1&limit=20`,
          first: `/api/v1${path}?page=1&limit=20`,
          next: `/api/v1${path}?page=2&limit=20`,
          last: `/api/v1${path}?page=3&limit=20`,
        },
      },
    };

    responseExamples['empty-list'] = {
      summary: 'Empty result set',
      description: 'Returned when no items match the query',
      value: {
        data: [],
        meta: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 0,
          hasNext: false,
          hasPrev: false,
        },
      },
    };

    responseExamples['cursor-paginated'] = {
      summary: 'Cursor-based pagination response',
      value: {
        data: [
          { id: 'item_001', name: `${cleanName} A` },
          { id: 'item_002', name: `${cleanName} B` },
        ],
        meta: {
          cursor: 'eyJpZCI6Iml0ZW1fMDAyIn0=',
          hasMore: true,
          limit: 20,
        },
      },
    };
  } else if (isCreate) {
    responseExamples['created'] = {
      summary: `Successfully created ${cleanName.toLowerCase()}`,
      value: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: `Example ${cleanName}`,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    };
  } else {
    responseExamples['success'] = {
      summary: `${cleanName} retrieved successfully`,
      value: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: `Example ${cleanName}`,
        status: 'active',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    };
  }

  // Error examples (always add)
  responseExamples['not-found'] = {
    summary: '404 Not Found',
    description: 'Resource not found (RFC 7807)',
    value: {
      type: 'https://api.example.com/errors/not-found',
      title: 'Resource not found',
      status: 404,
      detail: `${cleanName} with the specified ID was not found`,
      instance: `/requests/req_${Math.random().toString(36).slice(2, 10)}`,
    },
  };

  responseExamples['validation-error'] = {
    summary: '422 Validation Error',
    description: 'Input validation failed (RFC 7807)',
    value: {
      type: 'https://api.example.com/errors/validation',
      title: 'Validation Error',
      status: 422,
      detail: 'One or more fields failed validation',
      errors: [
        { field: 'name', message: 'name is required', code: 'required' },
        { field: 'email', message: 'Invalid email format', code: 'format', rejectedValue: 'not-an-email' },
      ],
    },
  };

  responseExamples['server-error'] = {
    summary: '500 Internal Server Error',
    value: {
      type: 'https://api.example.com/errors/internal',
      title: 'Internal Server Error',
      status: 500,
      detail: 'An unexpected error occurred. Please try again later.',
      instance: `/requests/req_${Math.random().toString(36).slice(2, 10)}`,
    },
  };

  // SSE streaming example
  responseExamples['sse-stream'] = {
    summary: 'Server-Sent Events streaming',
    description: 'Example of SSE text/event-stream format',
    value: [
      'id: 1\nevent: update\ndata: {"status":"processing","progress":25}\n',
      'id: 2\nevent: update\ndata: {"status":"processing","progress":75}\n',
      'id: 3\nevent: complete\ndata: {"status":"done","result":{}}\n',
    ].join('\n'),
  };

  return { requestExamples, responseExamples };
}

function addExamplesToMediaType(
  mediaType: MediaTypeObject,
  examples: Record<string, ExampleObject>
): void {
  if (!mediaType.examples) mediaType.examples = {};
  Object.assign(mediaType.examples, examples);
}

export function addExampleCommand(path: string): void {
  if (!path.startsWith('/')) {
    error('Path must start with /');
    process.exit(1);
  }

  const spec = loadSpec();

  if (!spec.paths[path]) {
    error(`Path "${path}" not found in spec. Run 'openapi-config add-path <method> ${path}' first.`);
    process.exit(1);
  }

  const pathItem = spec.paths[path];
  const methods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options', 'trace'] as const;
  let added = 0;

  for (const method of methods) {
    const op = pathItem[method];
    if (!op) continue;

    const { requestExamples, responseExamples } = buildExamples(path, method);

    // Add request body examples
    if (requestExamples && op.requestBody) {
      for (const [, mediaType] of Object.entries(op.requestBody.content)) {
        addExamplesToMediaType(mediaType, requestExamples);
      }
    }

    // Add response examples
    if (responseExamples) {
      for (const [statusCode, response] of Object.entries(op.responses)) {
        if (response.content) {
          for (const [, mediaType] of Object.entries(response.content)) {
            const examplesForStatus: Record<string, ExampleObject> = {};

            if (statusCode.startsWith('2')) {
              // Add success examples to 2xx responses
              for (const [k, v] of Object.entries(responseExamples)) {
                if (!['not-found', 'validation-error', 'server-error'].includes(k)) {
                  examplesForStatus[k] = v;
                }
              }
            } else if (statusCode === '404') {
              examplesForStatus['not-found'] = responseExamples['not-found'];
            } else if (statusCode === '422') {
              examplesForStatus['validation-error'] = responseExamples['validation-error'];
            } else if (statusCode === '500') {
              examplesForStatus['server-error'] = responseExamples['server-error'];
            } else if (statusCode.startsWith('4') || statusCode.startsWith('5')) {
              examplesForStatus['error'] = responseExamples['not-found'];
            }

            if (Object.keys(examplesForStatus).length > 0) {
              addExamplesToMediaType(mediaType, examplesForStatus);
            }
          }
        }
      }
    }

    added++;
    info(`Added examples to ${chalk.bold(method.toUpperCase())} ${path}`);
  }

  if (added === 0) {
    error(`No operations found for path "${path}"`);
    process.exit(1);
  }

  saveSpec(spec);
  success(`Added examples to ${added} operation(s) at ${chalk.bold(path)}`);
  info('Examples include: CRUD, pagination, cursor pagination, SSE streaming, RFC 7807 errors');
}
