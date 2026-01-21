import fs from 'node:fs'
import path from 'node:path'
import type {HttpMethod} from './filepath/method-extractor'

/**
 * Checks if fastify-type-provider-zod is installed by looking in package.json
 */
export function isZodInstalled(projectRoot: string = process.cwd()): boolean {
  try {
    const packageJsonPath = path.join(projectRoot, 'package.json')
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))

    const dependencies = packageJson.dependencies || {}
    const devDependencies = packageJson.devDependencies || {}

    return !!(
      dependencies['fastify-type-provider-zod'] ||
      devDependencies['fastify-type-provider-zod']
    )
  } catch {
    // If package.json doesn't exist or can't be read, default to false
    return false
  }
}

/**
 * Generates a Fastify route file template with the correct URL and method.
 *
 * @param url - The URL path for the route (e.g., '/users/:id')
 * @param method - The HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param useZod - Whether to include Zod schema validation (defaults to checking package.json)
 * @returns The complete file content as a string
 */
export function generateRouteTemplate(
  url: string,
  method: HttpMethod,
  useZod?: boolean,
): string {
  const shouldUseZod = useZod ?? isZodInstalled()

  if (shouldUseZod) {
    return `import type { FastifyInstance } from 'fastify'
import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi'
import { z } from 'zod'

export default async function (fastify: FastifyInstance) {
  fastify.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
    method: '${method}',
    url: '${url}',
    schema: {
      response: {
        200: z.string(),
      },
    },
    async handler(req, reply) {
      reply.code(200).send('Hello, World!')
    },
  })
}
`
  } else {
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
