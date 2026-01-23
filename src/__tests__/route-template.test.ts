import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {generateRouteTemplate} from '../route-template'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'

describe('generateRouteTemplate', () => {
  describe('basic template generation', () => {
    it('should generate template with GET method', () => {
      const template = generateRouteTemplate('/api/users', 'GET')

      expect(template).toContain("method: 'GET'")
      expect(template).toContain("url: '/api/users'")
      expect(template).toContain('import type { FastifyInstance }')
      expect(template).not.toContain('FastifyZodOpenApiTypeProvider')
      expect(template).not.toContain('zod')
      expect(template).not.toContain('withTypeProvider')
      expect(template).toContain('fastify.route({')
      expect(template).toContain('async handler(req, reply)')
    })

    it('should generate template with POST method', () => {
      const template = generateRouteTemplate('/api/users', 'POST')

      expect(template).toContain("method: 'POST'")
      expect(template).toContain("url: '/api/users'")
      expect(template).not.toContain('schema')
    })

    it('should generate template with PUT method', () => {
      const template = generateRouteTemplate('/api/users/:id', 'PUT')

      expect(template).toContain("method: 'PUT'")
      expect(template).toContain("url: '/api/users/:id'")
    })

    it('should generate template with PATCH method', () => {
      const template = generateRouteTemplate('/api/users/:id', 'PATCH')

      expect(template).toContain("method: 'PATCH'")
      expect(template).toContain("url: '/api/users/:id'")
    })

    it('should generate template with DELETE method', () => {
      const template = generateRouteTemplate('/api/users/:id', 'DELETE')

      expect(template).toContain("method: 'DELETE'")
      expect(template).toContain("url: '/api/users/:id'")
    })
  })

  describe('URL handling', () => {
    it('should handle simple paths', () => {
      const template = generateRouteTemplate('/api/products', 'GET')

      expect(template).toContain("url: '/api/products'")
    })

    it('should handle paths with parameters', () => {
      const template = generateRouteTemplate('/api/users/:userId', 'GET')

      expect(template).toContain("url: '/api/users/:userId'")
    })

    it('should handle deeply nested paths', () => {
      const template = generateRouteTemplate(
        '/api/v2/users/:id/posts/:postId',
        'GET',
      )

      expect(template).toContain("url: '/api/v2/users/:id/posts/:postId'")
    })

    it('should handle root path', () => {
      const template = generateRouteTemplate('/api', 'GET')

      expect(template).toContain("url: '/api'")
    })

    it('should handle paths with multiple parameters', () => {
      const template = generateRouteTemplate(
        '/api/orgs/:orgId/projects/:projectId',
        'GET',
      )

      expect(template).toContain("url: '/api/orgs/:orgId/projects/:projectId'")
    })
  })

  describe('template structure', () => {
    it('should include all necessary imports', () => {
      const template = generateRouteTemplate('/api/test', 'GET')

      expect(template).toContain(
        "import type { FastifyInstance } from 'fastify'",
      )
    })

    it('should export default async function', () => {
      const template = generateRouteTemplate('/api/test', 'GET')

      expect(template).toContain(
        'export default async function (fastify: FastifyInstance)',
      )
    })

    it('should include async handler', () => {
      const template = generateRouteTemplate('/api/test', 'GET')

      expect(template).toContain('async handler(req, reply) {')
      expect(template).toContain("reply.code(200).send('Hello, World!')")
    })

    it('should be valid TypeScript', () => {
      const template = generateRouteTemplate('/api/test', 'GET')

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
      const template = generateRouteTemplate('/api/test', 'GET')

      expect(template.endsWith('\n')).toBe(true)
    })
  })

  describe('consistency', () => {
    it('should generate consistent output for same inputs', () => {
      const template1 = generateRouteTemplate('/api/test', 'GET')
      const template2 = generateRouteTemplate('/api/test', 'GET')

      expect(template1).toBe(template2)
    })

    it('should generate different output for different methods', () => {
      const getTemplate = generateRouteTemplate('/api/test', 'GET')
      const postTemplate = generateRouteTemplate('/api/test', 'POST')

      expect(getTemplate).not.toBe(postTemplate)
      expect(getTemplate).toContain("method: 'GET'")
      expect(postTemplate).toContain("method: 'POST'")
    })

    it('should generate different output for different URLs', () => {
      const usersTemplate = generateRouteTemplate('/api/users', 'GET')
      const productsTemplate = generateRouteTemplate('/api/products', 'GET')

      expect(usersTemplate).not.toBe(productsTemplate)
      expect(usersTemplate).toContain("url: '/api/users'")
      expect(productsTemplate).toContain("url: '/api/products'")
    })
  })

  describe('custom template support', () => {
    let tempDir: string

    beforeEach(() => {
      // Create a temporary directory for test templates
      tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastify-sync-test-'))
    })

    afterEach(() => {
      // Clean up temporary directory
      fs.rmSync(tempDir, {recursive: true, force: true})
    })

    it('should use basic template when no template path provided', () => {
      const result = generateRouteTemplate('/api/users', 'GET')
      expect(result).toContain("method: 'GET'")
      expect(result).toContain("url: '/api/users'")
      expect(result).not.toContain('zod')
    })

    it('should read and use custom template file', () => {
      // Create a custom template with real route values that will be replaced
      const templatePath = path.join(tempDir, 'custom-template.ts')
      const templateContent = `import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: 'POST',
    url: '/template/route',
    handler: async () => ({ custom: true })
  })
}`
      fs.writeFileSync(templatePath, templateContent)

      const result = generateRouteTemplate('/api/users', 'GET', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/users.get.ts'),
      })

      expect(result).toContain("method: 'GET'")
      expect(result).toContain("url: '/api/users'")
      expect(result).toContain('{ custom: true }')
    })

    it('should replace method from template', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      fs.writeFileSync(
        templatePath,
        `fastify.route({ method: 'GET', url: '/old/path' })`,
      )

      const result = generateRouteTemplate('/api/test', 'POST', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/test.post.ts'),
      })

      expect(result).toContain("method: 'POST'")
    })

    it('should replace URL from template', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      fs.writeFileSync(
        templatePath,
        `fastify.route({ method: 'GET', url: '/old/path' })`,
      )

      const result = generateRouteTemplate('/api/custom-path', 'GET', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/custom-path.get.ts'),
      })

      expect(result).toContain("url: '/api/custom-path'")
    })

    it('should replace both method and URL from template', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      fs.writeFileSync(
        templatePath,
        `fastify.route({ method: 'DELETE', url: '/template/original' })`,
      )

      const result = generateRouteTemplate('/api/test', 'PUT', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/test.put.ts'),
      })

      expect(result).toContain("method: 'PUT'")
      expect(result).toContain("url: '/api/test'")
      expect(result).not.toContain('DELETE')
      expect(result).not.toContain('/template/original')
    })

    it('should transform relative imports', () => {
      // Create a template with relative imports and a real route
      const templateDir = path.join(tempDir, 'templates')
      fs.mkdirSync(templateDir, {recursive: true})
      const templatePath = path.join(templateDir, 'template.ts')
      const templateContent = `import {helper} from '../utils/helper'
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: 'POST',
    url: '/template/path',
    handler: async () => helper()
  })
}`
      fs.writeFileSync(templatePath, templateContent)

      // Target is deeper in directory structure
      const targetPath = path.join(tempDir, 'src/api/users/profile.get.ts')

      const result = generateRouteTemplate('/api/users/profile', 'GET', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: targetPath,
      })

      // The import should be transformed to work from the new location
      expect(result).toContain('import {helper} from')
      // Should go up more levels from the deeper target location
      expect(result).toContain('../../../')
      // Method and URL should be replaced
      expect(result).toContain("method: 'GET'")
      expect(result).toContain("url: '/api/users/profile'")
    })

    it('should not transform package imports', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      const templateContent = `import type { FastifyInstance } from 'fastify'
import {z} from 'zod'`
      fs.writeFileSync(templatePath, templateContent)

      const result = generateRouteTemplate('/api/test', 'GET', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/test.get.ts'),
      })

      expect(result).toContain("from 'fastify'")
      expect(result).toContain("from 'zod'")
    })

    it('should work with absolute template path', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      fs.writeFileSync(
        templatePath,
        `fastify.route({ method: 'POST', url: '/absolute/test' })`,
      )

      const result = generateRouteTemplate('/api/test', 'GET', {
        templatePath, // Already absolute
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/test.get.ts'),
      })

      expect(result).toContain("method: 'GET'")
      expect(result).toContain("url: '/api/test'")
    })

    it('should work with relative template path', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      fs.writeFileSync(
        templatePath,
        `fastify.route({ method: 'DELETE', url: '/relative/test' })`,
      )

      const result = generateRouteTemplate('/api/test', 'GET', {
        templatePath: 'template.ts', // Relative
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/test.get.ts'),
      })

      expect(result).toContain("method: 'GET'")
      expect(result).toContain("url: '/api/test'")
    })

    it('should preserve template structure and custom logic', () => {
      const templatePath = path.join(tempDir, 'template.ts')
      const templateContent = `import type { FastifyInstance } from 'fastify'
import {validateAuth} from '../auth'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: 'POST',
    url: '/template/endpoint',
    preHandler: validateAuth,
    async handler(req, reply) {
      // Custom business logic
      const data = await processRequest(req.body)
      reply.code(200).send(data)
    },
  })
}`
      fs.writeFileSync(templatePath, templateContent)

      const result = generateRouteTemplate('/api/users/:id', 'PATCH', {
        templatePath,
        projectRoot: tempDir,
        targetFilePath: path.join(tempDir, 'api/users/id.patch.ts'),
      })

      // Method and URL should be replaced
      expect(result).toContain("method: 'PATCH'")
      expect(result).toContain("url: '/api/users/:id'")
      // But everything else should be preserved
      expect(result).toContain('preHandler: validateAuth')
      expect(result).toContain('// Custom business logic')
      expect(result).toContain('processRequest(req.body)')
    })
  })
})
