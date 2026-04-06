export interface OpenAPISpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    securitySchemes?: Record<string, SecurityScheme>;
    examples?: Record<string, ExampleObject>;
    responses?: Record<string, ResponseObject>;
  };
  servers?: ServerObject[];
  security?: SecurityRequirement[];
  webhooks?: Record<string, PathItem>;
  tags?: TagObject[];
}

export interface PathItem {
  get?: OperationObject;
  post?: OperationObject;
  put?: OperationObject;
  patch?: OperationObject;
  delete?: OperationObject;
  head?: OperationObject;
  options?: OperationObject;
  trace?: OperationObject;
  parameters?: ParameterObject[];
  summary?: string;
  description?: string;
}

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
  security?: SecurityRequirement[];
  deprecated?: boolean;
}

export interface ParameterObject {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
}

export interface RequestBodyObject {
  description?: string;
  content: Record<string, MediaTypeObject>;
  required?: boolean;
}

export interface ResponseObject {
  description: string;
  content?: Record<string, MediaTypeObject>;
  headers?: Record<string, HeaderObject>;
  links?: Record<string, LinkObject>;
}

export interface MediaTypeObject {
  schema?: SchemaObject;
  example?: unknown;
  examples?: Record<string, ExampleObject>;
}

export interface SchemaObject {
  type?: string;
  format?: string;
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  required?: string[];
  description?: string;
  example?: unknown;
  enum?: unknown[];
  allOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  discriminator?: DiscriminatorObject;
  nullable?: boolean;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  $ref?: string;
  additionalProperties?: SchemaObject | boolean;
  default?: unknown;
  readOnly?: boolean;
  writeOnly?: boolean;
}

export interface DiscriminatorObject {
  propertyName: string;
  mapping?: Record<string, string>;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface ServerObject {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

export interface TagObject {
  name: string;
  description?: string;
}

export interface ExampleObject {
  summary?: string;
  description?: string;
  value?: unknown;
  externalValue?: string;
}

export interface HeaderObject {
  description?: string;
  required?: boolean;
  schema?: SchemaObject;
}

export interface LinkObject {
  operationRef?: string;
  operationId?: string;
  parameters?: Record<string, unknown>;
  requestBody?: unknown;
  description?: string;
}

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'head' | 'options' | 'trace';
