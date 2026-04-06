import chalk from 'chalk';
import type { PathItem, OperationObject } from '../types.js';
import { loadSpec, saveSpec } from '../utils/spec.js';
import { success, error, info } from '../utils/logger.js';

function buildWebhookPayload(name: string): PathItem {
  const cleanName = name
    .split(/[-_.]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');

  const eventName = name.toLowerCase().replace(/[_\s]+/g, '.');

  const post: OperationObject = {
    operationId: `webhook${cleanName}`,
    summary: `${cleanName} webhook`,
    description: `Webhook fired when a ${eventName} event occurs`,
    tags: ['Webhooks'],
    requestBody: {
      required: true,
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['id', 'event', 'timestamp', 'data'],
            properties: {
              id: {
                type: 'string',
                format: 'uuid',
                description: 'Unique webhook delivery ID',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              event: {
                type: 'string',
                description: 'Event type identifier',
                example: eventName,
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'ISO 8601 timestamp when the event occurred',
                example: '2024-01-01T00:00:00Z',
              },
              version: {
                type: 'string',
                description: 'Webhook payload version',
                example: '1.0',
              },
              data: {
                type: 'object',
                description: `${cleanName} event payload`,
                properties: {
                  id: {
                    type: 'string',
                    description: 'Resource ID',
                  },
                  type: {
                    type: 'string',
                    description: 'Resource type',
                  },
                  attributes: {
                    type: 'object',
                    description: 'Resource attributes',
                    additionalProperties: true,
                  },
                },
              },
              meta: {
                type: 'object',
                description: 'Webhook delivery metadata',
                properties: {
                  deliveryId: { type: 'string', format: 'uuid' },
                  attempt: { type: 'integer', minimum: 1 },
                  maxRetries: { type: 'integer' },
                },
              },
            },
          },
          examples: {
            [`${name}-example`]: {
              summary: `Example ${name} webhook payload`,
              value: {
                id: '123e4567-e89b-12d3-a456-426614174000',
                event: eventName,
                timestamp: '2024-01-01T12:00:00Z',
                version: '1.0',
                data: {
                  id: 'resource-123',
                  type: name,
                  attributes: {},
                },
                meta: {
                  deliveryId: 'del_abc123',
                  attempt: 1,
                  maxRetries: 3,
                },
              },
            },
          },
        },
      },
    },
    responses: {
      '200': {
        description: 'Webhook received and acknowledged',
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: {
                received: { type: 'boolean', example: true },
              },
            },
          },
        },
      },
      '400': {
        description: 'Invalid webhook payload',
      },
      '401': {
        description: 'Webhook signature verification failed',
      },
    },
  };

  return { post };
}

export function addWebhookCommand(name: string): void {
  if (!name || name.trim() === '') {
    error('Webhook name cannot be empty');
    process.exit(1);
  }

  const spec = loadSpec();

  // OpenAPI 3.1 supports webhooks natively; 3.0 uses x-webhooks extension
  const isV31 = spec.openapi.startsWith('3.1');

  if (isV31) {
    if (!spec.webhooks) spec.webhooks = {};

    if (spec.webhooks[name]) {
      error(`Webhook "${name}" already exists`);
      process.exit(1);
    }

    spec.webhooks[name] = buildWebhookPayload(name);
    success(`Added webhook ${chalk.bold(name)} (OpenAPI 3.1 native webhooks)`);
  } else {
    // For 3.0, use x-webhooks extension
    if (!(spec as Record<string, unknown>)['x-webhooks']) {
      (spec as Record<string, unknown>)['x-webhooks'] = {};
    }
    const xWebhooks = (spec as Record<string, unknown>)['x-webhooks'] as Record<string, PathItem>;

    if (xWebhooks[name]) {
      error(`Webhook "${name}" already exists`);
      process.exit(1);
    }

    xWebhooks[name] = buildWebhookPayload(name);
    success(`Added webhook ${chalk.bold(name)} (as x-webhooks extension for OpenAPI 3.0)`);
    info('Note: Native webhooks require OpenAPI 3.1. Run "openapi-config init 3.1" for new specs.');
  }

  saveSpec(spec);

  info('Webhook includes: unique ID, event type, timestamp, payload data, delivery metadata');
  console.log(chalk.gray('\n  Security tip: Verify webhook signatures using HMAC-SHA256'));
  console.log(chalk.gray('  Add X-Webhook-Signature header to your webhook deliveries'));
}
