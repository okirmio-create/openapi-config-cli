import { writeFileSync, existsSync } from 'fs';
import yaml from 'js-yaml';
import chalk from 'chalk';
import type { OpenAPISpec } from '../types.js';
import { success, error, info } from '../utils/logger.js';

export function initCommand(version: string): void {
  if (!['3.0', '3.1'].includes(version)) {
    error(`Invalid version "${version}". Use 3.0 or 3.1`);
    process.exit(1);
  }

  const outFile = 'openapi.yaml';
  if (existsSync(outFile)) {
    error(`${outFile} already exists. Delete it first if you want to reinitialize.`);
    process.exit(1);
  }

  const openapiVersion = version === '3.0' ? '3.0.3' : '3.1.0';

  const spec: OpenAPISpec = {
    openapi: openapiVersion,
    info: {
      title: 'My API',
      version: '1.0.0',
      description: 'API description',
    },
    paths: {},
    components: {
      schemas: {},
      securitySchemes: {},
    },
    servers: [
      {
        url: 'https://api.example.com/v1',
        description: 'Production server',
      },
    ],
    tags: [],
  };

  // Add version-specific features
  if (version === '3.1') {
    // OpenAPI 3.1 uses JSON Schema draft 2020-12
    (spec as Record<string, unknown>)['jsonSchemaDialect'] =
      'https://json-schema.org/draft/2020-12/schema';
  }

  const content = yaml.dump(spec, {
    indent: 2,
    lineWidth: 120,
    noRefs: true,
  });

  writeFileSync(outFile, content, 'utf-8');

  success(`Created ${chalk.bold(outFile)} (OpenAPI ${openapiVersion})`);
  info('Next steps:');
  console.log('  openapi-config add-path get /users');
  console.log('  openapi-config add-schema user');
  console.log('  openapi-config add-auth bearer');
  console.log('  openapi-config validate');
}
