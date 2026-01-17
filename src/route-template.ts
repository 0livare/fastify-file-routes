import type {HttpMethod} from './method-extractor'

/**
 * Generates a Fastify route file template with the correct URL and method.
 *
 * @param url - The URL path for the route (e.g., '/users/:id')
 * @param method - The HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @returns The complete file content as a string
 */
export function generateRouteTemplate(url: string, method: HttpMethod): string {
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
}
