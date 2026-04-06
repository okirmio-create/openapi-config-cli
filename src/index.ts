import { Command } from 'commander';
import chalk from 'chalk';
import { initCommand } from './commands/init.js';
import { addPathCommand } from './commands/add-path.js';
import { addSchemaCommand } from './commands/add-schema.js';
import { addAuthCommand } from './commands/add-auth.js';
import { addServerCommand } from './commands/add-server.js';
import { addWebhookCommand } from './commands/add-webhook.js';
import { mergeCommand } from './commands/merge.js';
import { validateCommand } from './commands/validate.js';
import { addExampleCommand } from './commands/add-example.js';

const program = new Command();

program
  .name('openapi-config')
  .description(
    chalk.bold('OpenAPI Config CLI') +
      '\n\nGenerate and manage OpenAPI/Swagger specification files'
  )
  .version('1.0.0');

program
  .command('init <version>')
  .description('Generate OpenAPI spec file (version: 3.0 | 3.1)')
  .action((version: string) => {
    initCommand(version);
  });

program
  .command('add-path <method> <path>')
  .description(
    'Add API endpoint with request/response schemas\n' +
      '  Includes: path params, query params (GET list), request body, RFC 7807 errors, SSE'
  )
  .action((method: string, path: string) => {
    addPathCommand(method, path);
  });

program
  .command('add-schema <name>')
  .description(
    'Add component schema\n' +
      '  Schemas: user | product | error | pagination | list-response | auth-token'
  )
  .action((name: string) => {
    addSchemaCommand(name);
  });

program
  .command('add-auth <type>')
  .description(
    'Add security scheme\n' +
      '  Types: bearer | apiKey | oauth2 | openid-connect | basic'
  )
  .action((type: string) => {
    addAuthCommand(type);
  });

program
  .command('add-server <url>')
  .description('Add server with auto-detected environment and URL variable support')
  .action((url: string) => {
    addServerCommand(url);
  });

program
  .command('add-webhook <name>')
  .description(
    'Add webhook definition (native for 3.1, x-webhooks extension for 3.0)\n' +
      '  Includes: event payload, delivery metadata, signature tip'
  )
  .action((name: string) => {
    addWebhookCommand(name);
  });

program
  .command('merge <file1> <file2>')
  .description(
    'Merge two OpenAPI specs into openapi.yaml\n' +
      '  Detects conflicts, merges paths/schemas/servers/webhooks'
  )
  .action((file1: string, file2: string) => {
    mergeCommand(file1, file2);
  });

program
  .command('validate [file]')
  .description(
    'Validate OpenAPI specification (defaults to openapi.yaml)\n' +
      '  Checks: required fields, $ref integrity, duplicate operationIds, path params, security schemes'
  )
  .action((file?: string) => {
    validateCommand(file);
  });

program
  .command('add-example <path>')
  .description(
    'Add request/response examples to all operations at path\n' +
      '  Templates: CRUD, pagination, cursor pagination, SSE streaming, RFC 7807 errors'
  )
  .action((path: string) => {
    addExampleCommand(path);
  });

program.addHelpText(
  'after',
  `
${chalk.bold('Examples:')}
  ${chalk.gray('# Initialize a new spec')}
  $ openapi-config init 3.1

  ${chalk.gray('# Add CRUD endpoints')}
  $ openapi-config add-path get /users
  $ openapi-config add-path post /users
  $ openapi-config add-path get /users/{id}
  $ openapi-config add-path put /users/{id}
  $ openapi-config add-path delete /users/{id}

  ${chalk.gray('# Add schemas and auth')}
  $ openapi-config add-schema user
  $ openapi-config add-schema error
  $ openapi-config add-schema pagination
  $ openapi-config add-auth bearer
  $ openapi-config add-auth oauth2

  ${chalk.gray('# Add servers and webhooks')}
  $ openapi-config add-server https://api.example.com/v1
  $ openapi-config add-server https://staging.example.com/v1
  $ openapi-config add-webhook user.created
  $ openapi-config add-webhook order.completed

  ${chalk.gray('# Add examples and validate')}
  $ openapi-config add-example /users
  $ openapi-config validate
  $ openapi-config validate my-other-spec.yaml

  ${chalk.gray('# Merge specs')}
  $ openapi-config merge users-api.yaml products-api.yaml
`
);

program.parse(process.argv);
