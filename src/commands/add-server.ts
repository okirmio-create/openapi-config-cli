import chalk from 'chalk';
import type { ServerObject, ServerVariable } from '../types.js';
import { loadSpec, saveSpec } from '../utils/spec.js';
import { success, error, info } from '../utils/logger.js';

function inferEnvironment(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('dev') || lower.includes('localhost') || lower.includes('127.0.0.1')) return 'development';
  if (lower.includes('staging') || lower.includes('stage') || lower.includes('stg')) return 'staging';
  if (lower.includes('test') || lower.includes('qa')) return 'testing';
  return 'production';
}

function buildServerWithVariables(url: string): ServerObject {
  const env = inferEnvironment(url);

  // Extract base URL pattern to create a server with variables
  let baseUrl = url;
  let variables: Record<string, ServerVariable> | undefined;

  // Check if URL contains version pattern like /v1 or /v2
  const versionMatch = url.match(/\/(v\d+)/);
  if (versionMatch) {
    baseUrl = url.replace(`/${versionMatch[1]}`, '/{version}');
    variables = {
      ...variables,
      version: {
        default: versionMatch[1],
        enum: ['v1', 'v2', 'v3'],
        description: 'API version',
      },
    };
  }

  // Add environment variable if we can detect environment
  if (env !== 'production' || url.includes('{')) {
    // Keep as-is
  }

  const server: ServerObject = {
    url: baseUrl,
    description: `${env.charAt(0).toUpperCase() + env.slice(1)} server`,
  };

  if (variables && Object.keys(variables).length > 0) {
    server.variables = variables;
  }

  return server;
}

export function addServerCommand(url: string): void {
  // Basic URL validation
  try {
    new URL(url);
  } catch {
    // Allow URLs with template variables like https://api.{env}.example.com
    if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
      error(`Invalid URL "${url}". Must start with http://, https://, or /`);
      process.exit(1);
    }
  }

  const spec = loadSpec();
  if (!spec.servers) spec.servers = [];

  // Check for duplicate
  const existing = spec.servers.find((s) => s.url === url);
  if (existing) {
    error(`Server "${url}" already exists`);
    process.exit(1);
  }

  const server = buildServerWithVariables(url);
  spec.servers.push(server);

  // Also add sensible dev/staging/prod servers if this looks like a prod server
  const env = inferEnvironment(url);
  if (env === 'production' && spec.servers.length === 1) {
    info('Tip: Add environment-specific servers with variables for multi-environment support');
  }

  saveSpec(spec);

  success(`Added server: ${chalk.bold(url)}`);
  if (server.description) {
    info(`Description: ${server.description}`);
  }
  if (server.variables) {
    info(`Variables: ${Object.keys(server.variables).join(', ')}`);
    console.log(chalk.gray('  Customize variable enums and defaults in openapi.yaml'));
  }
}
