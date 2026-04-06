import chalk from 'chalk';
import type { SchemaObject } from '../types.js';
import { loadSpec, saveSpec } from '../utils/spec.js';
import { success, error, info } from '../utils/logger.js';

type SchemaName = 'user' | 'product' | 'error' | 'pagination' | 'list-response' | 'auth-token';

const SCHEMAS: Record<SchemaName, () => Record<string, SchemaObject>> = {
  user: () => ({
    User: {
      type: 'object',
      required: ['id', 'email', 'name', 'createdAt'],
      properties: {
        id: { type: 'string', format: 'uuid', readOnly: true, description: 'Unique user ID' },
        email: { type: 'string', format: 'email', description: 'User email address' },
        name: { type: 'string', minLength: 1, maxLength: 255, description: 'Full name' },
        role: { type: 'string', enum: ['admin', 'user', 'viewer'], default: 'user' },
        avatar: { type: 'string', format: 'uri', nullable: true, description: 'Avatar URL' },
        createdAt: { type: 'string', format: 'date-time', readOnly: true },
        updatedAt: { type: 'string', format: 'date-time', readOnly: true },
      },
      example: {
        id: '123e4567-e89b-12d3-a456-426614174000',
        email: 'user@example.com',
        name: 'John Doe',
        role: 'user',
        avatar: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    },
    UserCreate: {
      type: 'object',
      required: ['email', 'name', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        name: { type: 'string', minLength: 1, maxLength: 255 },
        password: { type: 'string', format: 'password', minLength: 8, writeOnly: true },
        role: { type: 'string', enum: ['admin', 'user', 'viewer'], default: 'user' },
      },
    },
    UserUpdate: {
      type: 'object',
      properties: {
        name: { type: 'string', minLength: 1, maxLength: 255 },
        avatar: { type: 'string', format: 'uri', nullable: true },
        role: { type: 'string', enum: ['admin', 'user', 'viewer'] },
      },
    },
  }),

  product: () => ({
    Product: {
      type: 'object',
      required: ['id', 'name', 'price', 'sku'],
      properties: {
        id: { type: 'string', format: 'uuid', readOnly: true },
        sku: { type: 'string', pattern: '^[A-Z0-9-]+$', description: 'Stock Keeping Unit' },
        name: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string', nullable: true },
        price: { type: 'number', format: 'float', minimum: 0, description: 'Price in cents' },
        currency: { type: 'string', pattern: '^[A-Z]{3}$', default: 'USD' },
        category: { type: 'string', description: 'Product category' },
        tags: { type: 'array', items: { type: 'string' }, default: [] },
        stock: { type: 'integer', minimum: 0, description: 'Available stock' },
        images: {
          type: 'array',
          items: { type: 'string', format: 'uri' },
          description: 'Product image URLs',
        },
        status: { type: 'string', enum: ['active', 'draft', 'archived'], default: 'draft' },
        createdAt: { type: 'string', format: 'date-time', readOnly: true },
        updatedAt: { type: 'string', format: 'date-time', readOnly: true },
      },
    },
    ProductCreate: {
      type: 'object',
      required: ['name', 'price', 'sku'],
      properties: {
        sku: { type: 'string', pattern: '^[A-Z0-9-]+$' },
        name: { type: 'string', minLength: 1, maxLength: 500 },
        description: { type: 'string' },
        price: { type: 'number', format: 'float', minimum: 0 },
        currency: { type: 'string', pattern: '^[A-Z]{3}$', default: 'USD' },
        category: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        stock: { type: 'integer', minimum: 0, default: 0 },
      },
    },
  }),

  error: () => ({
    ProblemDetail: {
      type: 'object',
      description: 'RFC 7807 Problem Details for HTTP APIs',
      properties: {
        type: {
          type: 'string',
          format: 'uri',
          description: 'URI reference identifying the problem type',
          example: 'https://api.example.com/errors/not-found',
        },
        title: {
          type: 'string',
          description: 'Short, human-readable summary',
          example: 'Resource not found',
        },
        status: {
          type: 'integer',
          description: 'HTTP status code',
          example: 404,
        },
        detail: {
          type: 'string',
          description: 'Human-readable explanation specific to this occurrence',
          example: 'User with ID 123 was not found',
        },
        instance: {
          type: 'string',
          format: 'uri',
          description: 'URI reference identifying the specific occurrence',
          example: '/requests/req_abc123',
        },
      },
      example: {
        type: 'https://api.example.com/errors/not-found',
        title: 'Resource not found',
        status: 404,
        detail: 'User with ID 123 was not found',
        instance: '/requests/req_abc123',
      },
    },
    ValidationError: {
      allOf: [
        { $ref: '#/components/schemas/ProblemDetail' },
        {
          type: 'object',
          description: 'RFC 7807 validation error with field details',
          properties: {
            errors: {
              type: 'array',
              description: 'List of validation errors',
              items: {
                type: 'object',
                required: ['field', 'message'],
                properties: {
                  field: { type: 'string', description: 'Field path (dot notation)' },
                  message: { type: 'string', description: 'Validation error message' },
                  code: { type: 'string', description: 'Machine-readable error code' },
                  rejectedValue: { description: 'The value that failed validation' },
                },
              },
            },
          },
        },
      ],
    },
    NotFoundError: {
      allOf: [
        { $ref: '#/components/schemas/ProblemDetail' },
        {
          type: 'object',
          properties: {
            resourceType: { type: 'string', description: 'Type of resource not found' },
            resourceId: { type: 'string', description: 'ID of resource not found' },
          },
        },
      ],
    },
    ConflictError: {
      allOf: [
        { $ref: '#/components/schemas/ProblemDetail' },
        {
          type: 'object',
          properties: {
            conflictingField: { type: 'string' },
            conflictingValue: { type: 'string' },
          },
        },
      ],
    },
  }),

  pagination: () => ({
    PaginationMeta: {
      type: 'object',
      required: ['page', 'limit', 'total', 'totalPages'],
      description: 'Pagination metadata',
      properties: {
        page: { type: 'integer', minimum: 1, description: 'Current page number' },
        limit: { type: 'integer', minimum: 1, description: 'Items per page' },
        total: { type: 'integer', minimum: 0, description: 'Total number of items' },
        totalPages: { type: 'integer', minimum: 0, description: 'Total number of pages' },
        hasNext: { type: 'boolean', description: 'Whether there is a next page' },
        hasPrev: { type: 'boolean', description: 'Whether there is a previous page' },
      },
      example: {
        page: 1,
        limit: 20,
        total: 100,
        totalPages: 5,
        hasNext: true,
        hasPrev: false,
      },
    },
    CursorPagination: {
      type: 'object',
      required: ['cursor', 'limit', 'hasMore'],
      description: 'Cursor-based pagination metadata',
      properties: {
        cursor: { type: 'string', nullable: true, description: 'Cursor for next page' },
        prevCursor: { type: 'string', nullable: true, description: 'Cursor for previous page' },
        limit: { type: 'integer', minimum: 1, description: 'Items per page' },
        hasMore: { type: 'boolean', description: 'Whether more items exist' },
      },
    },
  }),

  'list-response': () => ({
    ListResponseMeta: {
      type: 'object',
      required: ['data', 'meta'],
      description: 'Generic paginated list response wrapper',
      properties: {
        data: {
          type: 'array',
          items: {},
          description: 'List of items (replace items.$ref with your schema)',
        },
        meta: { $ref: '#/components/schemas/PaginationMeta' },
        links: {
          type: 'object',
          description: 'HATEOAS links',
          properties: {
            self: { type: 'string', format: 'uri' },
            first: { type: 'string', format: 'uri' },
            prev: { type: 'string', format: 'uri', nullable: true },
            next: { type: 'string', format: 'uri', nullable: true },
            last: { type: 'string', format: 'uri' },
          },
        },
      },
    },
  }),

  'auth-token': () => ({
    AuthToken: {
      type: 'object',
      required: ['accessToken', 'tokenType', 'expiresIn'],
      description: 'Authentication token response',
      properties: {
        accessToken: {
          type: 'string',
          description: 'JWT access token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        tokenType: {
          type: 'string',
          enum: ['Bearer'],
          default: 'Bearer',
        },
        expiresIn: {
          type: 'integer',
          description: 'Token expiry in seconds',
          example: 3600,
        },
        refreshToken: {
          type: 'string',
          description: 'Refresh token for obtaining new access tokens',
          nullable: true,
        },
        scope: {
          type: 'string',
          description: 'Granted OAuth scopes',
          example: 'read write',
        },
      },
    },
    RefreshTokenRequest: {
      type: 'object',
      required: ['refreshToken'],
      properties: {
        refreshToken: { type: 'string', description: 'Refresh token' },
      },
    },
    LoginRequest: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', format: 'email' },
        password: { type: 'string', format: 'password', minLength: 8 },
      },
    },
  }),
};

export function addSchemaCommand(name: string): void {
  const validNames = Object.keys(SCHEMAS) as SchemaName[];
  if (!validNames.includes(name as SchemaName)) {
    error(`Unknown schema "${name}". Valid: ${validNames.join(', ')}`);
    process.exit(1);
  }

  const spec = loadSpec();
  if (!spec.components) spec.components = {};
  if (!spec.components.schemas) spec.components.schemas = {};

  const schemas = SCHEMAS[name as SchemaName]();
  const added: string[] = [];
  const skipped: string[] = [];

  for (const [schemaName, schema] of Object.entries(schemas)) {
    if (spec.components.schemas[schemaName]) {
      skipped.push(schemaName);
    } else {
      spec.components.schemas[schemaName] = schema;
      added.push(schemaName);
    }
  }

  saveSpec(spec);

  if (added.length > 0) {
    success(`Added schemas: ${added.map(s => chalk.bold(s)).join(', ')}`);
  }
  if (skipped.length > 0) {
    info(`Skipped (already exist): ${skipped.join(', ')}`);
  }
}
