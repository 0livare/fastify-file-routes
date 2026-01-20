import {describe, it, expect} from 'vitest'
import {modifyRouteUrl, modifyRouteFields} from '../ast-modifier'

describe('modifyRouteUrl', () => {
  describe('basic modification', () => {
    it('should modify url field with single quotes', () => {
      const code = `
fastify.route({
  url: '/old/path',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: '/new/path',
  method: 'GET',
})
      `.trim(),
      )
    })

    it('should modify url field with double quotes', () => {
      const code = `
fastify.route({
  url: "/old/path",
  method: "GET",
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: "/new/path",
  method: "GET",
})
      `.trim(),
      )
    })

    it('should modify url field with template literals', () => {
      const code = `
fastify.route({
  url: \`/old/path\`,
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: \`/new/path\`,
  method: 'GET',
})
      `.trim(),
      )
    })
  })

  describe('formatting preservation', () => {
    it('should preserve indentation', () => {
      const code = `
  fastify.route({
    url: '/old/path',
    method: 'GET',
  })
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
  fastify.route({
    url: '/new/path',
    method: 'GET',
  })
      `.trim(),
      )
    })

    it('should preserve tabs', () => {
      const code = `
\tfastify.route({
\t\turl: '/old/path',
\t\tmethod: 'GET',
\t})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
\tfastify.route({
\t\turl: '/new/path',
\t\tmethod: 'GET',
\t})
      `.trim(),
      )
    })

    it('should preserve trailing commas', () => {
      const code = `
fastify.route({
  url: '/old/path',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content?.includes("'/new/path',")).toBe(true)
    })

    it('should preserve property order', () => {
      const code = `
fastify.route({
  method: 'GET',
  url: '/old/path',
  handler: async () => {},
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      const lines = result.content!.split('\n')
      expect(lines[1].trim()).toBe("method: 'GET',")
      expect(lines[2].trim()).toBe("url: '/new/path',")
      expect(lines[3].trim()).toBe('handler: async () => {},')
    })

    it('should preserve comments', () => {
      const code = `
// Route for users
fastify.route({
  url: '/old/path', // The URL path
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toContain('// Route for users')
      expect(result.content).toContain('// The URL path')
    })

    it('should preserve multiline comments', () => {
      const code = `
/*
 * Route for users
 */
fastify.route({
  url: '/old/path',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toContain('/*')
      expect(result.content).toContain(' * Route for users')
      expect(result.content).toContain(' */')
    })
  })

  describe('withTypeProvider chaining', () => {
    it('should modify url in chained route call', () => {
      const code = `
fastify
  .withTypeProvider<TypeBoxProvider>()
  .route({
    url: '/old/path',
    method: 'GET',
  })
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/new/path',")
    })
  })

  describe('complex scenarios', () => {
    it('should handle routes with schemas', () => {
      const code = `
fastify.route({
  url: '/old/path',
  method: 'POST',
  schema: {
    body: {
      type: 'object',
      properties: {
        name: {type: 'string'},
      },
    },
  },
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/new/path',")
      expect(result.content).toContain('schema: {')
    })

    it('should handle routes with handlers', () => {
      const code = `
fastify.route({
  url: '/old/path',
  method: 'GET',
  handler: async (request, reply) => {
    return {message: 'Hello'}
  },
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/new/path',")
      expect(result.content).toContain('handler: async (request, reply) => {')
    })

    it('should only modify first route when multiple routes present', () => {
      const code = `
fastify.route({
  url: '/first',
  method: 'GET',
})

fastify.route({
  url: '/second',
  method: 'POST',
})
      `.trim()

      const result = modifyRouteUrl(code, '/updated')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/updated',")
      expect(result.content).toContain("url: '/second',")
      // Count occurrences of '/updated' - should only appear once
      const count = (result.content!.match(/\/updated/g) || []).length
      expect(count).toBe(1)
    })
  })

  describe('parameter handling', () => {
    it('should handle URLs with route parameters', () => {
      const code = `
fastify.route({
  url: '/users/:id',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/users/:userId')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/users/:userId',")
    })

    it('should handle URLs with multiple parameters', () => {
      const code = `
fastify.route({
  url: '/users/:userId/posts/:postId',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/users/:id/posts/:id')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/users/:id/posts/:id',")
    })
  })

  describe('safety checks', () => {
    it('should return error when no route found', () => {
      const code = `
const x = 5
console.info(x)
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
      expect(result.error).toBe(
        'No valid url field found in route configuration',
      )
    })

    it('should return error when route has no url field', () => {
      const code = `
fastify.route({
  method: 'GET',
  handler: async () => {},
})
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
      expect(result.error).toBe(
        'No valid url field found in route configuration',
      )
    })

    it('should return error when route config is not an object literal', () => {
      const code = `
const config = {url: '/path', method: 'GET'}
fastify.route(config)
      `.trim()

      const result = modifyRouteUrl(code, '/new/path')

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
      expect(result.error).toBe(
        'No valid url field found in route configuration',
      )
    })
  })

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const result = modifyRouteUrl('', '/new/path')

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
    })

    it('should handle file with only whitespace', () => {
      const result = modifyRouteUrl('   \n\n  ', '/new/path')

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
    })

    it('should handle URLs with special characters', () => {
      const code = `
fastify.route({
  url: '/old',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/api/v2/users/:id/posts')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/api/v2/users/:id/posts',")
    })

    it('should handle URLs with query parameters in new URL', () => {
      const code = `
fastify.route({
  url: '/old',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteUrl(code, '/users')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/users',")
    })
  })

  describe('real-world examples', () => {
    it('should handle typical Fastify route file', () => {
      const code = `
import {FastifyInstance} from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users/:id',
    method: 'GET',
    handler: async (request, reply) => {
      const {id} = request.params
      return {id}
    },
  })
}
      `.trim()

      const result = modifyRouteUrl(code, '/api/users/:userId')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/api/users/:userId',")
      expect(result.content).toContain('import {FastifyInstance}')
      expect(result.content).toContain('handler: async (request, reply) => {')
    })

    it('should handle TypeScript route file with type provider', () => {
      const code = `
import {FastifyInstance} from 'fastify'
import {TypeBoxProvider} from '@fastify/type-provider-typebox'

export default async function (fastify: FastifyInstance) {
  fastify
    .withTypeProvider<TypeBoxProvider>()
    .route({
      url: '/api/posts',
      method: 'POST',
      schema: {
        body: PostSchema,
      },
      handler: async (request, reply) => {
        return createPost(request.body)
      },
    })
}
      `.trim()

      const result = modifyRouteUrl(code, '/api/v2/posts')

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/api/v2/posts',")
      expect(result.content).toContain('withTypeProvider<TypeBoxProvider>()')
    })
  })
})

describe('modifyRouteFields', () => {
  describe('modifying method only', () => {
    it('should modify method field with single quotes', () => {
      const code = `
fastify.route({
  url: '/users',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'POST'})

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: '/users',
  method: 'POST',
})
      `.trim(),
      )
    })

    it('should modify method field with double quotes', () => {
      const code = `
fastify.route({
  url: "/users",
  method: "GET",
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'DELETE'})

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: "/users",
  method: "DELETE",
})
      `.trim(),
      )
    })
  })

  describe('modifying url only', () => {
    it('should modify url field with single quotes', () => {
      const code = `
fastify.route({
  url: '/old/path',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteFields(code, {url: '/new/path'})

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: '/new/path',
  method: 'GET',
})
      `.trim(),
      )
    })
  })

  describe('modifying both url and method', () => {
    it('should modify both url and method with single quotes', () => {
      const code = `
fastify.route({
  url: '/users',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteFields(code, {url: '/posts', method: 'POST'})

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
fastify.route({
  url: '/posts',
  method: 'POST',
})
      `.trim(),
      )
    })

    it('should modify both url and method preserving quote styles', () => {
      const code = `
fastify.route({
  url: "/users",
  method: 'GET',
})
      `.trim()

      const result = modifyRouteFields(code, {
        url: '/products/:id',
        method: 'PATCH',
      })

      expect(result.modified).toBe(true)
      expect(result.content).toContain('url: "/products/:id",')
      expect(result.content).toContain("method: 'PATCH',")
    })

    it('should handle method change from GET to POST', () => {
      const code = `
fastify.route({
  url: '/users/:id',
  method: 'GET',
  handler: async (req, reply) => {
    return {id: req.params.id}
  }
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'POST'})

      expect(result.modified).toBe(true)
      expect(result.content).toContain("method: 'POST',")
      expect(result.content).toContain("url: '/users/:id',")
      expect(result.content).toContain('handler: async (req, reply) => {')
    })

    it('should handle method change from POST to DELETE', () => {
      const code = `
fastify.route({
  url: '/users/:id',
  method: 'POST',
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'DELETE'})

      expect(result.modified).toBe(true)
      expect(result.content).toContain("method: 'DELETE',")
    })
  })

  describe('formatting preservation', () => {
    it('should preserve indentation when modifying both fields', () => {
      const code = `
  fastify.route({
    url: '/old',
    method: 'GET',
  })
      `.trim()

      const result = modifyRouteFields(code, {url: '/new', method: 'PUT'})

      expect(result.modified).toBe(true)
      expect(result.content).toBe(
        `
  fastify.route({
    url: '/new',
    method: 'PUT',
  })
      `.trim(),
      )
    })

    it('should preserve comments when modifying method', () => {
      const code = `
// User routes
fastify.route({
  url: '/users', // Users endpoint
  method: 'GET', // HTTP GET
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'POST'})

      expect(result.modified).toBe(true)
      expect(result.content).toContain('// User routes')
      expect(result.content).toContain('// Users endpoint')
      expect(result.content).toContain('// HTTP GET')
      expect(result.content).toContain("method: 'POST',")
    })

    it('should preserve property order when modifying method', () => {
      const code = `
fastify.route({
  method: 'GET',
  url: '/users',
  handler: async () => {},
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'DELETE'})

      expect(result.modified).toBe(true)
      const lines = result.content!.split('\n')
      expect(lines[1].trim()).toBe("method: 'DELETE',")
      expect(lines[2].trim()).toBe("url: '/users',")
      expect(lines[3].trim()).toBe('handler: async () => {},')
    })
  })

  describe('real-world file rename scenarios', () => {
    it('should handle renaming from users.get.ts to users.post.ts', () => {
      const code = `
import {FastifyInstance} from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/users',
    method: 'GET',
    handler: async (request, reply) => {
      return {users: []}
    },
  })
}
      `.trim()

      const result = modifyRouteFields(code, {method: 'POST'})

      expect(result.modified).toBe(true)
      expect(result.content).toContain("method: 'POST',")
      expect(result.content).toContain("url: '/users',")
      expect(result.content).toContain('import {FastifyInstance}')
      expect(result.content).toContain('handler: async (request, reply) => {')
    })

    it('should handle renaming from users.$id.get.ts to users.$id.patch.ts', () => {
      const code = `
import {FastifyInstance} from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/users/:id',
    method: 'GET',
    handler: async (request, reply) => {
      const {id} = request.params
      return {id}
    },
  })
}
      `.trim()

      const result = modifyRouteFields(code, {method: 'PATCH'})

      expect(result.modified).toBe(true)
      expect(result.content).toContain("method: 'PATCH',")
      expect(result.content).toContain("url: '/users/:id',")
    })

    it('should handle complete file move and method change', () => {
      const code = `
fastify.route({
  url: '/api/v1/users',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteFields(code, {
        url: '/api/v2/products',
        method: 'DELETE',
      })

      expect(result.modified).toBe(true)
      expect(result.content).toContain("url: '/api/v2/products',")
      expect(result.content).toContain("method: 'DELETE',")
    })
  })

  describe('safety checks', () => {
    it('should return error when no route found', () => {
      const code = `
const x = 5
console.info(x)
      `.trim()

      const result = modifyRouteFields(code, {method: 'POST'})

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
      expect(result.error).toBe(
        'No valid fields found in route configuration to modify',
      )
    })

    it('should return error when neither field is specified', () => {
      const code = `
fastify.route({
  url: '/users',
  method: 'GET',
})
      `.trim()

      const result = modifyRouteFields(code, {})

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
      expect(result.error).toBe(
        'No valid fields found in route configuration to modify',
      )
    })

    it('should return error when route has no matching fields', () => {
      const code = `
fastify.route({
  handler: async () => {},
})
      `.trim()

      const result = modifyRouteFields(code, {url: '/test', method: 'GET'})

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
    })
  })

  describe('edge cases', () => {
    it('should handle empty file', () => {
      const result = modifyRouteFields('', {method: 'POST'})

      expect(result.modified).toBe(false)
      expect(result.content).toBe(null)
    })

    it('should handle only modifying method when url not in config', () => {
      const code = `
fastify.route({
  method: 'GET',
  handler: async () => {},
})
      `.trim()

      const result = modifyRouteFields(code, {method: 'POST'})

      expect(result.modified).toBe(true)
      expect(result.content).toContain("method: 'POST',")
    })
  })
})
