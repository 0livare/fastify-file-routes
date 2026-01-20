import {describe, it, expect} from 'vitest'
import {parseRouteFile} from '../ast-parser'

describe('parseRouteFile', () => {
  describe('basic route parsing', () => {
    it('should extract url and method from a basic Fastify route', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle POST method', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'POST',
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('POST')
    })

    it('should handle PUT method', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'PUT',
            url: '/api/users/:id',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users/:id')
      expect(result.method).toBe('PUT')
    })

    it('should handle PATCH method', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'PATCH',
            url: '/api/users/:id',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users/:id')
      expect(result.method).toBe('PATCH')
    })

    it('should handle DELETE method', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'DELETE',
            url: '/api/users/:id',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users/:id')
      expect(result.method).toBe('DELETE')
    })
  })

  describe('quote styles', () => {
    it('should handle single quotes', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle double quotes', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: "GET",
            url: "/api/users",
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle template literals without expressions', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: \`GET\`,
            url: \`/api/users\`,
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle mixed quote styles', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: "POST",
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('POST')
    })
  })

  describe('complex route configurations', () => {
    it('should extract url and method from a route with complete configuration', () => {
      const code = `
        import {Result} from '@praha/byethrow'
        import type {FastifyInstance} from 'fastify'
        import type {FastifyZodOpenApiTypeProvider} from 'fastify-zod-openapi'
        import {z} from 'zod/v4'
        import {wrapInResultSchema} from '@/utils/index.js'

        export default async function (fastify: FastifyInstance) {
          fastify.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
            method: 'GET',
            url: '/foo/:count',
            preValidation: fastify.auth.user,
            schema: {
              description: 'Example endpoint',
              tags: ['Examples'],
              security: [{bearerAuth: []}],
              querystring: z.object({
                name: z.string().min(4),
              }),
              params: z.object({
                count: z.string().transform((val) => parseInt(val, 10)),
              }),
              response: {
                default: wrapInResultSchema({
                  value: z.string(),
                }),
              },
            },
            async handler(req, reply) {
              reply.code(200).send(Result.succeed('Hello'))
            },
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/foo/:count')
      expect(result.method).toBe('GET')
    })

    it('should handle route with parameter in url', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: '/api/users/:userId/posts/:postId',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users/:userId/posts/:postId')
      expect(result.method).toBe('GET')
    })

    it('should handle route with trailing slash', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: '/api/users/',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users/')
      expect(result.method).toBe('GET')
    })

    it('should handle root route', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: '/',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/')
      expect(result.method).toBe('GET')
    })
  })

  describe('property order', () => {
    it('should extract values regardless of property order', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            url: '/api/users',
            method: 'GET',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle properties with other fields between url and method', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'POST',
            preValidation: fastify.auth.user,
            url: '/api/users',
            schema: {},
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('POST')
    })
  })

  describe('edge cases', () => {
    it('should return null values for empty file', () => {
      const result = parseRouteFile('')
      expect(result.url).toBeNull()
      expect(result.method).toBeNull()
    })

    it('should return null values when no route() call exists', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          console.info('No route here')
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBeNull()
      expect(result.method).toBeNull()
    })

    it('should return null url when url field is missing', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBeNull()
      expect(result.method).toBe('GET')
    })

    it('should return null method when method field is missing', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBeNull()
    })

    it('should handle route() call with no arguments', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route()
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBeNull()
      expect(result.method).toBeNull()
    })

    it('should handle route() call with non-object argument', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route('not an object')
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBeNull()
      expect(result.method).toBeNull()
    })

    it('should ignore template literals with expressions', () => {
      const code = `
        const path = 'users'
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: \`/api/\${path}\`,
          })
        }
      `
      const result = parseRouteFile(code)
      // Template literals with expressions are not supported (return null)
      expect(result.url).toBeNull()
      expect(result.method).toBe('GET')
    })

    it('should handle multiple route() calls and extract from the first one', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.route({
            method: 'GET',
            url: '/api/users',
          })
          fastify.route({
            method: 'POST',
            url: '/api/posts',
          })
        }
      `
      const result = parseRouteFile(code)
      // Should extract from first route() call
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })
  })

  describe('whitespace and formatting', () => {
    it('should handle compact formatting', () => {
      const code = `export default async function(fastify:FastifyInstance){fastify.route({method:'GET',url:'/api/users'})}`
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle extra whitespace', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify  .  route  (  {
            method  :  'GET'  ,
            url  :  '/api/users'  ,
          }  )
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle comments in the code', () => {
      const code = `
        // This is a route handler
        export default async function (fastify: FastifyInstance) {
          // Register the route
          fastify.route({
            // HTTP method
            method: 'GET',
            // URL path
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })
  })

  describe('withTypeProvider pattern', () => {
    it('should extract from route() after withTypeProvider() call', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({
            method: 'GET',
            url: '/api/users',
          })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/users')
      expect(result.method).toBe('GET')
    })

    it('should handle chained calls before route()', () => {
      const code = `
        export default async function (fastify: FastifyInstance) {
          fastify
            .withTypeProvider<SomeType>()
            .withOtherThing()
            .route({
              method: 'POST',
              url: '/api/posts',
            })
        }
      `
      const result = parseRouteFile(code)
      expect(result.url).toBe('/api/posts')
      expect(result.method).toBe('POST')
    })
  })
})
