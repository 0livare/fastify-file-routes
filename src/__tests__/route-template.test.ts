import {describe, it, expect} from 'vitest'
import {generateRouteTemplate} from '../route-template'

describe('generateRouteTemplate', () => {
  describe('basic template generation', () => {
    it('should generate template with GET method', () => {
      const template = generateRouteTemplate('/users', 'GET')

      expect(template).toContain("method: 'GET'")
      expect(template).toContain("url: '/users'")
      expect(template).toContain('import type { FastifyInstance }')
      expect(template).toContain('import type { FastifyZodOpenApiTypeProvider }')
      expect(template).toContain("import { z } from 'zod'")
      expect(template).toContain('withTypeProvider<FastifyZodOpenApiTypeProvider>()')
      expect(template).toContain('async handler(req, reply)')
    })

    it('should generate template with POST method', () => {
      const template = generateRouteTemplate('/users', 'POST')

      expect(template).toContain("method: 'POST'")
      expect(template).toContain("url: '/users'")
    })

    it('should generate template with PUT method', () => {
      const template = generateRouteTemplate('/users/:id', 'PUT')

      expect(template).toContain("method: 'PUT'")
      expect(template).toContain("url: '/users/:id'")
    })

    it('should generate template with PATCH method', () => {
      const template = generateRouteTemplate('/users/:id', 'PATCH')

      expect(template).toContain("method: 'PATCH'")
      expect(template).toContain("url: '/users/:id'")
    })

    it('should generate template with DELETE method', () => {
      const template = generateRouteTemplate('/users/:id', 'DELETE')

      expect(template).toContain("method: 'DELETE'")
      expect(template).toContain("url: '/users/:id'")
    })
  })

  describe('URL handling', () => {
    it('should handle simple paths', () => {
      const template = generateRouteTemplate('/products', 'GET')

      expect(template).toContain("url: '/products'")
    })

    it('should handle paths with parameters', () => {
      const template = generateRouteTemplate('/users/:userId', 'GET')

      expect(template).toContain("url: '/users/:userId'")
    })

    it('should handle deeply nested paths', () => {
      const template = generateRouteTemplate('/api/v2/users/:id/posts/:postId', 'GET')

      expect(template).toContain("url: '/api/v2/users/:id/posts/:postId'")
    })

    it('should handle root path', () => {
      const template = generateRouteTemplate('/', 'GET')

      expect(template).toContain("url: '/'")
    })

    it('should handle paths with multiple parameters', () => {
      const template = generateRouteTemplate('/orgs/:orgId/projects/:projectId', 'GET')

      expect(template).toContain("url: '/orgs/:orgId/projects/:projectId'")
    })
  })

  describe('template structure', () => {
    it('should include all necessary imports', () => {
      const template = generateRouteTemplate('/test', 'GET')

      expect(template).toContain("import type { FastifyInstance } from 'fastify'")
      expect(template).toContain("import type { FastifyZodOpenApiTypeProvider } from 'fastify-zod-openapi'")
      expect(template).toContain("import { z } from 'zod'")
    })

    it('should export default async function', () => {
      const template = generateRouteTemplate('/test', 'GET')

      expect(template).toContain('export default async function (fastify: FastifyInstance)')
    })

    it('should include withTypeProvider', () => {
      const template = generateRouteTemplate('/test', 'GET')

      expect(template).toContain('fastify.withTypeProvider<FastifyZodOpenApiTypeProvider>().route({')
    })

    it('should include response schema', () => {
      const template = generateRouteTemplate('/test', 'GET')

      expect(template).toContain('schema: {')
      expect(template).toContain('response: {')
      expect(template).toContain('200: z.string(),')
    })

    it('should include async handler', () => {
      const template = generateRouteTemplate('/test', 'GET')

      expect(template).toContain('async handler(req, reply) {')
      expect(template).toContain("reply.code(200).send('Hello, World!')")
    })

    it('should be valid TypeScript', () => {
      const template = generateRouteTemplate('/test', 'GET')

      // Check for balanced braces
      const openBraces = (template.match(/{/g) || []).length
      const closeBraces = (template.match(/}/g) || []).length
      expect(openBraces).toBe(closeBraces)

      // Check for balanced parentheses
      const openParens = (template.match(/\(/g) || []).length
      const closeParens = (template.match(/\)/g) || []).length
      expect(openParens).toBe(closeParens)
    })

    it('should end with newline', () => {
      const template = generateRouteTemplate('/test', 'GET')

      expect(template.endsWith('\n')).toBe(true)
    })
  })

  describe('real-world scenarios', () => {
    it('should generate template for user list endpoint', () => {
      const template = generateRouteTemplate('/users', 'GET')

      expect(template).toContain("method: 'GET'")
      expect(template).toContain("url: '/users'")
      expect(template).toContain('FastifyInstance')
    })

    it('should generate template for user detail endpoint', () => {
      const template = generateRouteTemplate('/users/:id', 'GET')

      expect(template).toContain("method: 'GET'")
      expect(template).toContain("url: '/users/:id'")
    })

    it('should generate template for user creation endpoint', () => {
      const template = generateRouteTemplate('/users', 'POST')

      expect(template).toContain("method: 'POST'")
      expect(template).toContain("url: '/users'")
    })

    it('should generate template for user update endpoint', () => {
      const template = generateRouteTemplate('/users/:id', 'PATCH')

      expect(template).toContain("method: 'PATCH'")
      expect(template).toContain("url: '/users/:id'")
    })

    it('should generate template for user deletion endpoint', () => {
      const template = generateRouteTemplate('/users/:id', 'DELETE')

      expect(template).toContain("method: 'DELETE'")
      expect(template).toContain("url: '/users/:id'")
    })

    it('should generate template for nested resource', () => {
      const template = generateRouteTemplate('/users/:userId/posts/:postId', 'GET')

      expect(template).toContain("method: 'GET'")
      expect(template).toContain("url: '/users/:userId/posts/:postId'")
    })

    it('should generate template for API versioned endpoint', () => {
      const template = generateRouteTemplate('/api/v2/products', 'GET')

      expect(template).toContain("method: 'GET'")
      expect(template).toContain("url: '/api/v2/products'")
    })
  })

  describe('consistency', () => {
    it('should generate consistent output for same inputs', () => {
      const template1 = generateRouteTemplate('/test', 'GET')
      const template2 = generateRouteTemplate('/test', 'GET')

      expect(template1).toBe(template2)
    })

    it('should generate different output for different methods', () => {
      const getTemplate = generateRouteTemplate('/test', 'GET')
      const postTemplate = generateRouteTemplate('/test', 'POST')

      expect(getTemplate).not.toBe(postTemplate)
      expect(getTemplate).toContain("method: 'GET'")
      expect(postTemplate).toContain("method: 'POST'")
    })

    it('should generate different output for different URLs', () => {
      const usersTemplate = generateRouteTemplate('/users', 'GET')
      const productsTemplate = generateRouteTemplate('/products', 'GET')

      expect(usersTemplate).not.toBe(productsTemplate)
      expect(usersTemplate).toContain("url: '/users'")
      expect(productsTemplate).toContain("url: '/products'")
    })
  })
})
