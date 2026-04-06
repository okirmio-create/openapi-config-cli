import chalk from 'chalk';
import type { SecurityScheme, OAuthFlows } from '../types.js';
import { loadSpec, saveSpec } from '../utils/spec.js';
import { success, error, info } from '../utils/logger.js';

type AuthType = 'bearer' | 'apiKey' | 'oauth2' | 'openid-connect' | 'basic';

const AUTH_SCHEMES: Record<AuthType, { name: string; scheme: SecurityScheme }> = {
  bearer: {
    name: 'bearerAuth',
    scheme: {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
      description: 'JWT Bearer token authentication. Include the token in the Authorization header: Bearer <token>',
    },
  },
  basic: {
    name: 'basicAuth',
    scheme: {
      type: 'http',
      scheme: 'basic',
      description: 'HTTP Basic authentication. Include Base64-encoded credentials in the Authorization header.',
    },
  },
  apiKey: {
    name: 'apiKeyAuth',
    scheme: {
      type: 'apiKey',
      in: 'header',
      name: 'X-API-Key',
      description: 'API key authentication via X-API-Key header',
    },
  },
  oauth2: {
    name: 'oauth2',
    scheme: {
      type: 'oauth2',
      description: 'OAuth 2.0 authentication',
      flows: {
        authorizationCode: {
          authorizationUrl: 'https://auth.example.com/oauth/authorize',
          tokenUrl: 'https://auth.example.com/oauth/token',
          refreshUrl: 'https://auth.example.com/oauth/refresh',
          scopes: {
            'read:users': 'Read user data',
            'write:users': 'Write user data',
            'read:admin': 'Read admin data',
            'write:admin': 'Write admin data',
          },
        },
        clientCredentials: {
          tokenUrl: 'https://auth.example.com/oauth/token',
          scopes: {
            'read:api': 'Read API data',
            'write:api': 'Write API data',
          },
        },
      } as OAuthFlows,
    },
  },
  'openid-connect': {
    name: 'openIdConnect',
    scheme: {
      type: 'openIdConnect',
      openIdConnectUrl: 'https://auth.example.com/.well-known/openid-configuration',
      description: 'OpenID Connect authentication. Discovery document provides all endpoint details.',
    },
  },
};

export function addAuthCommand(type: string): void {
  const validTypes = Object.keys(AUTH_SCHEMES) as AuthType[];
  if (!validTypes.includes(type as AuthType)) {
    error(`Unknown auth type "${type}". Valid: ${validTypes.join(', ')}`);
    process.exit(1);
  }

  const spec = loadSpec();
  if (!spec.components) spec.components = {};
  if (!spec.components.securitySchemes) spec.components.securitySchemes = {};

  const { name, scheme } = AUTH_SCHEMES[type as AuthType];

  if (spec.components.securitySchemes[name]) {
    error(`Security scheme "${name}" already exists`);
    process.exit(1);
  }

  spec.components.securitySchemes[name] = scheme;

  // Set as global security requirement
  if (!spec.security) spec.security = [];
  const alreadyGlobal = spec.security.some((req) => name in req);
  if (!alreadyGlobal) {
    spec.security.push({ [name]: [] });
  }

  saveSpec(spec);

  success(`Added ${chalk.bold(type)} security scheme as ${chalk.bold(name)}`);
  info(`Scheme set as global security requirement`);

  if (type === 'bearer') {
    console.log(chalk.gray('\n  Usage in requests:'));
    console.log(chalk.gray('  Authorization: Bearer <your-jwt-token>'));
  } else if (type === 'apiKey') {
    console.log(chalk.gray('\n  Usage in requests:'));
    console.log(chalk.gray('  X-API-Key: <your-api-key>'));
  } else if (type === 'oauth2') {
    console.log(chalk.gray('\n  Flows: authorization_code, client_credentials'));
    console.log(chalk.gray('  Customize the scopes in openapi.yaml'));
  }
}
