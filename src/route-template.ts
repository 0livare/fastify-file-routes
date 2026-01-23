import fs from 'node:fs'
import path from 'node:path'
import type {HttpMethod} from './filepath/method-extractor'
import {transformImportPaths} from './util/import-transformer'

interface TemplateOptions {
  templatePath?: string | null
  projectRoot?: string
  targetFilePath?: string
}

interface RequiredTemplateOptions {
  templatePath: string
  projectRoot: string
  targetFilePath: string
}

/**
 * Generates a Fastify route file template.
 *
 * @param url - The URL path for the route (e.g., '/api/users/:id')
 * @param method - The HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param options - Optional template configuration
 * @returns The complete file content as a string
 */
export function generateRouteTemplate(
  url: string,
  method: HttpMethod,
  options?: TemplateOptions,
): string {
  const {templatePath, projectRoot, targetFilePath} = options || {}

  if (templatePath) {
    return generateFromCustomTemplate(url, method, {
      templatePath,
      projectRoot: projectRoot || process.cwd(),
      targetFilePath: targetFilePath || '',
    })
  }

  return generateBasicTemplate(url, method)
}

/**
 * Generates the basic Fastify template (no type providers).
 */
function generateBasicTemplate(url: string, method: HttpMethod): string {
  return `import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: '${method}',
    url: '${url}',
    async handler(req, reply) {
      reply.code(200).send('Hello, World!')
    },
  })
}
`
  }
}
