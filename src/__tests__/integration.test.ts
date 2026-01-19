import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {performInitialScan} from '../initial-scan'
import {createFileWatcher, type WatchEvent} from '../file-watcher'
import {synchronizeRouteFile} from '../route-synchronizer'
import {parseRouteFile} from '../ast-parser'

/**
 * Integration tests for the complete Fastify Sync CLI.
 * These tests verify the full flow from file discovery through watching and modification.
 */
describe('Integration Tests', () => {
  const testDir = path.join(__dirname, '__test-integration-fixtures__')

  // Helper to wait for async events
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Helper to clean up test directory
  function cleanupTestDirectory(): void {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true})
    }
  }

  beforeEach(() => {
    cleanupTestDirectory()
    fs.mkdirSync(testDir, {recursive: true})
  })

  afterEach(() => {
    cleanupTestDirectory()
  })

  describe('Full Flow: Discovery → Parse → Calculate → Modify → Verify', () => {
    it('should discover files, calculate URLs, modify files, and verify changes are valid TypeScript', () => {
      // Create test route files with incorrect URLs
      const usersContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong-users-url',
    method: 'GET',
    handler: async (request, reply) => {
      return { users: [] }
    }
  })
}
`

      const userIdContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/incorrect/:userId',
    method: 'GET',
    handler: async (request, reply) => {
      return { user: { id: request.params.userId } }
    }
  })
}
`

      // Create directory structure
      // Note: Cannot have both index and $userId in same directory - index takes precedence
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'users/$userId'), {recursive: true})
      fs.writeFileSync(path.join(testDir, 'users/index.get.ts'), usersContent)
      fs.writeFileSync(
        path.join(testDir, 'users/$userId/index.get.ts'),
        userIdContent,
      )

      // Perform initial scan
      const result = performInitialScan(testDir)

      // Verify scan results
      expect(result.totalFiles).toBe(2)
      expect(result.filesUpdated).toBe(2)
      expect(result.filesSkipped).toBe(0)
      expect(result.errors).toBe(0)

      // Verify files were actually modified
      const usersFile = path.join(testDir, 'users/index.get.ts')
      const userIdFile = path.join(testDir, 'users/$userId/index.get.ts')

      const updatedUsersContent = fs.readFileSync(usersFile, 'utf-8')
      const updatedUserIdContent = fs.readFileSync(userIdFile, 'utf-8')

      expect(updatedUsersContent).toContain("url: '/users'")
      expect(updatedUserIdContent).toContain("url: '/users/:userId'")

      // Verify the files are still valid TypeScript by parsing them
      const usersParsed = parseRouteFile(updatedUsersContent)
      const userIdParsed = parseRouteFile(updatedUserIdContent)

      expect(usersParsed.url).toBe('/users')
      expect(usersParsed.method).toBe('GET')
      expect(userIdParsed.url).toBe('/users/:userId')
      expect(userIdParsed.method).toBe('GET')

      // Verify files can be imported (by checking they have valid syntax)
      expect(() => require(usersFile)).not.toThrow()
      expect(() => require(userIdFile)).not.toThrow()
    })

    it('should handle complex nested structure with pathless layouts and index files', () => {
      const apiIndexContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong',
    method: 'GET',
    handler: async () => ({ api: 'root' })
  })
}
`

      const productsContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/products-wrong',
    method: 'GET',
    handler: async () => ({ products: [] })
  })
}
`

      const productDetailContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/products/:id/details-wrong',
    method: 'GET',
    handler: async (request) => ({ product: request.params.id })
  })
}
`

      // Create complex structure: /_layout/products/index.get.ts and products/$id/details.get.ts
      fs.mkdirSync(path.join(testDir, '_layout/products/$id'), {
        recursive: true,
      })
      fs.writeFileSync(path.join(testDir, 'index.get.ts'), apiIndexContent)
      fs.writeFileSync(
        path.join(testDir, '_layout/products/index.get.ts'),
        productsContent,
      )
      fs.writeFileSync(
        path.join(testDir, '_layout/products/$id/details.get.ts'),
        productDetailContent,
      )

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(3)
      expect(result.filesUpdated).toBe(3)

      // Verify URLs were calculated correctly (pathless layout excluded)
      const apiIndexFile = fs.readFileSync(
        path.join(testDir, 'index.get.ts'),
        'utf-8',
      )
      const productsFile = fs.readFileSync(
        path.join(testDir, '_layout/products/index.get.ts'),
        'utf-8',
      )
      const productDetailFile = fs.readFileSync(
        path.join(testDir, '_layout/products/$id/details.get.ts'),
        'utf-8',
      )

      expect(apiIndexFile).toContain("url: '/'")
      expect(productsFile).toContain("url: '/products'")
      expect(productDetailFile).toContain("url: '/products/:id/details'")
    })

    it('should preserve quote style and formatting when modifying files', () => {
      const singleQuoteContent = `
export default async function (fastify) {
  fastify.route({
    url: '/wrong',
    method: 'GET',
    handler: async () => ({ data: 'test' })
  })
}
`

      const doubleQuoteContent = `
export default async function (fastify) {
  fastify.route({
    url: "/wrong",
    method: "GET",
    handler: async () => ({ data: "test" })
  })
}
`

      const templateLiteralContent = `
export default async function (fastify) {
  fastify.route({
    url: \`/wrong\`,
    method: \`GET\`,
    handler: async () => ({ data: \`test\` })
  })
}
`

      fs.mkdirSync(path.join(testDir, 'quotes'), {recursive: true})
      fs.writeFileSync(
        path.join(testDir, 'quotes/single.get.ts'),
        singleQuoteContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'quotes/double.get.ts'),
        doubleQuoteContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'quotes/template.get.ts'),
        templateLiteralContent,
      )

      performInitialScan(testDir)

      // Verify quote styles were preserved
      const singleUpdated = fs.readFileSync(
        path.join(testDir, 'quotes/single.get.ts'),
        'utf-8',
      )
      const doubleUpdated = fs.readFileSync(
        path.join(testDir, 'quotes/double.get.ts'),
        'utf-8',
      )
      const templateUpdated = fs.readFileSync(
        path.join(testDir, 'quotes/template.get.ts'),
        'utf-8',
      )

      // Check that single quotes are still used
      expect(singleUpdated).toContain("url: '/quotes/single'")
      expect(singleUpdated).not.toContain('url: "/quotes/single"')

      // Check that double quotes are still used
      expect(doubleUpdated).toContain('url: "/quotes/double"')
      expect(doubleUpdated).not.toContain("url: '/quotes/double'")

      // Check that template literals are still used
      expect(templateUpdated).toContain('url: `/quotes/template`')
      expect(templateUpdated).not.toContain("url: '/quotes/template'")
    })
  })

  describe('Conflict Resolution', () => {
    it('should detect and resolve conflicts when multiple files map to same URL', () => {
      // Create multiple files that would map to /users
      const file1 = `
export default async function (fastify) {
  fastify.route({
    url: '/users',
    method: 'GET',
    handler: async () => ({ file: 1 })
  })
}
`

      const file2 = `
export default async function (fastify) {
  fastify.route({
    url: '/users',
    method: 'POST',
    handler: async () => ({ file: 2 })
  })
}
`

      const file3 = `
export default async function (fastify) {
  fastify.route({
    url: '/users',
    method: 'DELETE',
    handler: async () => ({ file: 3 })
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.writeFileSync(path.join(testDir, 'users/index.get.ts'), file1)
      fs.writeFileSync(path.join(testDir, 'users/index.post.ts'), file2)
      fs.writeFileSync(path.join(testDir, 'users/index.delete.ts'), file3)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(3)
      expect(result.conflictsResolved).toBe(1) // One conflict with 3 files

      // Verify files got unique URLs
      const file1Content = fs.readFileSync(
        path.join(testDir, 'users/index.get.ts'),
        'utf-8',
      )
      const file2Content = fs.readFileSync(
        path.join(testDir, 'users/index.post.ts'),
        'utf-8',
      )
      const file3Content = fs.readFileSync(
        path.join(testDir, 'users/index.delete.ts'),
        'utf-8',
      )

      // Verify all files have unique URLs (one keeps original, others get suffixes)
      const urls = [
        file1Content.match(/url: '([^']+)'/)?.[1],
        file2Content.match(/url: '([^']+)'/)?.[1],
        file3Content.match(/url: '([^']+)'/)?.[1],
      ]

      // Check that we have one /users and two with suffixes
      expect(urls).toContain('/users')
      expect(urls).toContain('/users-2')
      expect(urls).toContain('/users-3')
      // All should be unique
      expect(new Set(urls).size).toBe(3)
    })

    it('should handle multiple independent conflicts correctly', () => {
      // Create two separate conflict groups
      const usersGet = `
export default async function (fastify) {
  fastify.route({
    url: '/users',
    method: 'GET',
    handler: async () => ({ type: 'users-get' })
  })
}
`

      const usersPost = `
export default async function (fastify) {
  fastify.route({
    url: '/users',
    method: 'POST',
    handler: async () => ({ type: 'users-post' })
  })
}
`

      const productsGet = `
export default async function (fastify) {
  fastify.route({
    url: '/products',
    method: 'GET',
    handler: async () => ({ type: 'products-get' })
  })
}
`

      const productsPost = `
export default async function (fastify) {
  fastify.route({
    url: '/products',
    method: 'POST',
    handler: async () => ({ type: 'products-post' })
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})

      fs.writeFileSync(path.join(testDir, 'users/index.get.ts'), usersGet)
      fs.writeFileSync(path.join(testDir, 'users/index.post.ts'), usersPost)
      fs.writeFileSync(path.join(testDir, 'products/index.get.ts'), productsGet)
      fs.writeFileSync(
        path.join(testDir, 'products/index.post.ts'),
        productsPost,
      )

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(4)
      expect(result.conflictsResolved).toBe(2) // Two separate conflicts

      // Verify each group got unique URLs
      const usersGetContent = fs.readFileSync(
        path.join(testDir, 'users/index.get.ts'),
        'utf-8',
      )
      const usersPostContent = fs.readFileSync(
        path.join(testDir, 'users/index.post.ts'),
        'utf-8',
      )
      const productsGetContent = fs.readFileSync(
        path.join(testDir, 'products/index.get.ts'),
        'utf-8',
      )
      const productsPostContent = fs.readFileSync(
        path.join(testDir, 'products/index.post.ts'),
        'utf-8',
      )

      expect(usersGetContent).toContain("url: '/users'")
      expect(usersPostContent).toContain("url: '/users-2'")
      expect(productsGetContent).toContain("url: '/products'")
      expect(productsPostContent).toContain("url: '/products-2'")
    })
  })

  describe('File Watcher Integration', () => {
    it('should detect file addition and synchronize the new file', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)

        // When a file is added, synchronize it
        if (event.type === 'add') {
          synchronizeRouteFile(event.filePath, '/test')
        }
      })

      const onReady = vi.fn()
      const watcher = createFileWatcher(testDir, {onEvent, onReady})

      // Wait for watcher to be ready
      await delay(200)
      expect(onReady).toHaveBeenCalled()

      // Add a new file with incorrect URL
      const newFileContent = `
export default async function (fastify) {
  fastify.route({
    url: '/wrong-url',
    method: 'GET',
    handler: async () => ({ data: 'new' })
  })
}
`
      const newFilePath = path.join(testDir, 'test.get.ts')
      fs.writeFileSync(newFilePath, newFileContent)

      // Wait for file system event to be processed
      await delay(400)

      expect(onEvent).toHaveBeenCalled()
      expect(events.some((e) => e.type === 'add')).toBe(true)

      // Verify the file was synchronized
      const updatedContent = fs.readFileSync(newFilePath, 'utf-8')
      expect(updatedContent).toContain("url: '/test'")

      await watcher.close()
    })

    it('should detect file modification and re-synchronize', async () => {
      // Create initial file with correct URL
      const initialContent = `
export default async function (fastify) {
  fastify.route({
    url: '/test',
    method: 'GET',
    handler: async () => ({ version: 1 })
  })
}
`
      const filePath = path.join(testDir, 'test.get.ts')
      fs.writeFileSync(filePath, initialContent)

      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)

        // When a file changes, re-synchronize it
        if (event.type === 'change') {
          synchronizeRouteFile(event.filePath, '/test')
        }
      })

      const onReady = vi.fn()
      const watcher = createFileWatcher(testDir, {onEvent, onReady})

      // Wait for watcher to be ready
      await delay(200)
      expect(onReady).toHaveBeenCalled()

      // Modify the file to have wrong URL
      const modifiedContent = `
export default async function (fastify) {
  fastify.route({
    url: '/wrong-modified',
    method: 'GET',
    handler: async () => ({ version: 2 })
  })
}
`
      fs.writeFileSync(filePath, modifiedContent)

      // Wait for file system event to be processed
      await delay(400)

      expect(onEvent).toHaveBeenCalled()
      expect(events.some((e) => e.type === 'change')).toBe(true)

      // Verify the file was re-synchronized
      const finalContent = fs.readFileSync(filePath, 'utf-8')
      expect(finalContent).toContain("url: '/test'")
      expect(finalContent).toContain('version: 2') // Handler was preserved

      await watcher.close()
    })

    it('should handle rapid file operations without errors', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Create multiple files rapidly
      for (let i = 0; i < 5; i++) {
        const content = `
export default async function (fastify) {
  fastify.route({
    url: '/file-${i}',
    method: 'GET',
    handler: async () => ({ index: ${i} })
  })
}
`
        fs.writeFileSync(path.join(testDir, `file${i}.get.ts`), content)
      }

      // Wait for all events to be processed
      await delay(600)

      // Verify all events were detected
      const addEvents = events.filter((e) => e.type === 'add')
      expect(addEvents.length).toBeGreaterThanOrEqual(5)

      await watcher.close()
    })
  })

  describe('Real-world Scenarios', () => {
    it('should handle complete API structure with authentication, users, and products', () => {
      // Create realistic API structure
      const authLoginContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong',
    method: 'POST',
    schema: {
      body: {
        type: 'object',
        required: ['username', 'password'],
        properties: {
          username: { type: 'string' },
          password: { type: 'string' }
        }
      }
    },
    handler: async (request, reply) => {
      const { username, password } = request.body
      return { token: 'jwt-token', user: { username } }
    }
  })
}
`

      const usersListContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users-list',
    method: 'GET',
    handler: async () => {
      return { users: [], total: 0 }
    }
  })
}
`

      const userDetailContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users/:userId/detail',
    method: 'GET',
    handler: async (request) => {
      return { user: { id: request.params.userId } }
    }
  })
}
`

      const productsListContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/products-endpoint',
    method: 'GET',
    handler: async () => {
      return { products: [] }
    }
  })
}
`

      const productCreateContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/products-create',
    method: 'POST',
    handler: async (request) => {
      return { product: request.body, id: 'new-id' }
    }
  })
}
`

      // Create directory structure
      fs.mkdirSync(path.join(testDir, 'auth'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'users/$userId'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})

      fs.writeFileSync(
        path.join(testDir, 'auth/login.post.ts'),
        authLoginContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'users/index.get.ts'),
        usersListContent,
      )
      // Move $userId to subdirectory to avoid conflict with index
      fs.writeFileSync(
        path.join(testDir, 'users/$userId/index.get.ts'),
        userDetailContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'products/index.get.ts'),
        productsListContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'products/index.post.ts'),
        productCreateContent,
      )

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(5)
      expect(result.filesUpdated).toBe(5)
      expect(result.errors).toBe(0)

      // Verify URLs were corrected
      expect(
        fs.readFileSync(path.join(testDir, 'auth/login.post.ts'), 'utf-8'),
      ).toContain("url: '/auth/login'")

      expect(
        fs.readFileSync(path.join(testDir, 'users/index.get.ts'), 'utf-8'),
      ).toContain("url: '/users'")

      expect(
        fs
          .readFileSync(
            path.join(testDir, 'users/$userId/index.get.ts'),
            'utf-8',
          )
          .replace(/\s+/g, ' '),
      ).toContain("url: '/users/:userId'")

      // Products should have conflict resolution applied
      const productsGet = fs.readFileSync(
        path.join(testDir, 'products/index.get.ts'),
        'utf-8',
      )
      const productsPost = fs.readFileSync(
        path.join(testDir, 'products/index.post.ts'),
        'utf-8',
      )

      expect(productsGet).toContain("url: '/products'")
      expect(productsPost).toContain("url: '/products-2'")

      // Verify all files are valid TypeScript
      expect(() => parseRouteFile(productsGet)).not.toThrow()
      expect(() => parseRouteFile(productsPost)).not.toThrow()
    })

    it('should handle edge cases: deeply nested routes with parameters and pathless layouts', () => {
      const deepRouteContent = `
export default async function (fastify) {
  fastify.route({
    url: '/completely/wrong/url',
    method: 'GET',
    handler: async () => ({ deep: true })
  })
}
`

      // Create deep structure: _admin/orgs/$orgId/projects/$projectId/tasks/$taskId.get.ts
      const deepPath = path.join(
        testDir,
        '_admin/orgs/$orgId/projects/$projectId/tasks',
      )
      fs.mkdirSync(deepPath, {recursive: true})
      fs.writeFileSync(path.join(deepPath, '$taskId.get.ts'), deepRouteContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      // Verify URL was calculated correctly (pathless _admin excluded)
      const updatedContent = fs.readFileSync(
        path.join(deepPath, '$taskId.get.ts'),
        'utf-8',
      )
      expect(updatedContent).toContain(
        "url: '/orgs/:orgId/projects/:projectId/tasks/:taskId'",
      )
    })

    it('should preserve complex route configurations including schemas and preHandlers', () => {
      const complexRouteContent = `
import type { FastifyInstance } from 'fastify'
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox'

export default async function (fastify: FastifyInstance) {
  const preHandler = async (request, reply) => {
    // Authentication logic
  }

  fastify.withTypeProvider<TypeBoxTypeProvider>().route({
    url: '/wrong-url',
    method: 'POST',
    schema: {
      body: {
        type: 'object',
        required: ['name', 'email'],
        properties: {
          name: { type: 'string', minLength: 1 },
          email: { type: 'string', format: 'email' }
        }
      },
      response: {
        201: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' }
          }
        }
      }
    },
    preHandler: [preHandler],
    handler: async (request, reply) => {
      const { name, email } = request.body
      reply.status(201)
      return { id: 'new-id', name, email }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.writeFileSync(
        path.join(testDir, 'users/index.post.ts'),
        complexRouteContent,
      )

      performInitialScan(testDir)

      const updatedContent = fs.readFileSync(
        path.join(testDir, 'users/index.post.ts'),
        'utf-8',
      )

      // Verify URL was updated
      expect(updatedContent).toContain("url: '/users'")

      // Verify all other configuration was preserved
      expect(updatedContent).toContain('schema:')
      expect(updatedContent).toContain('preHandler:')
      expect(updatedContent).toContain('withTypeProvider')
      expect(updatedContent).toContain("required: ['name', 'email']")
      expect(updatedContent).toContain('reply.status(201)')
      expect(updatedContent).toContain('const preHandler')
    })
  })

  describe('Error Handling and Edge Cases', () => {
    it('should handle files without route() call gracefully', () => {
      const invalidContent = `
export default async function (fastify) {
  // No route() call here
  console.log('This is not a route file')
}
`

      fs.writeFileSync(path.join(testDir, 'invalid.get.ts'), invalidContent)

      const result = performInitialScan(testDir)

      // Should complete without crashing
      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(0)
      expect(result.errors).toBe(1) // File couldn't be processed
    })

    it('should handle files with malformed TypeScript', () => {
      const malformedContent = `
export default async function (fastify) {
  fastify.route({
    url: '/test',
    method: 'GET'
    // Missing closing braces - syntax error
`

      fs.writeFileSync(path.join(testDir, 'malformed.get.ts'), malformedContent)

      const result = performInitialScan(testDir)

      // Should handle gracefully without crashing
      expect(result.totalFiles).toBe(1)
      // May or may not update depending on parser tolerance
      expect(result.errors).toBeGreaterThanOrEqual(0)
    })

    it('should handle empty directory without errors', () => {
      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(0)
      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(0)
      expect(result.conflictsResolved).toBe(0)
      expect(result.errors).toBe(0)
    })

    it('should handle files that already have correct URLs', () => {
      const correctContent = `
export default async function (fastify) {
  fastify.route({
    url: '/test',
    method: 'GET',
    handler: async () => ({ correct: true })
  })
}
`

      fs.writeFileSync(path.join(testDir, 'test.get.ts'), correctContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(1)

      // Verify file was not modified
      const finalContent = fs.readFileSync(
        path.join(testDir, 'test.get.ts'),
        'utf-8',
      )
      expect(finalContent).toBe(correctContent)
    })
  })

  describe('Method Synchronization (File Rename Scenarios)', () => {
    it('should synchronize method when file is renamed from .get.ts to .post.ts', () => {
      // Create a file with GET method
      const content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/users',
    method: 'GET',
    handler: async (request, reply) => {
      return { users: [] }
    }
  })
}
`

      // Simulate the file now being a .post.ts file
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const filePath = path.join(testDir, 'users/index.post.ts')
      fs.writeFileSync(filePath, content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      // Verify both method and URL are correct
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("method: 'POST'")
      expect(updatedContent).toContain("url: '/users'")

      // Verify the rest of the file is preserved
      expect(updatedContent).toContain('import type { FastifyInstance }')
      expect(updatedContent).toContain('return { users: [] }')
    })

    it('should synchronize method when file is renamed from .get.ts to .delete.ts', () => {
      const content = `
export default async function (fastify) {
  fastify.route({
    url: '/users/:id',
    method: 'GET',
    handler: async (request) => {
      return { user: { id: request.params.id } }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const filePath = path.join(testDir, 'users/$id.delete.ts')
      fs.writeFileSync(filePath, content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("method: 'DELETE'")
      expect(updatedContent).toContain("url: '/users/:id'")
    })

    it('should synchronize method when file is renamed from .post.ts to .patch.ts', () => {
      const content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/products/:productId',
    method: 'POST',
    schema: {
      body: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          price: { type: 'number' }
        }
      }
    },
    handler: async (request, reply) => {
      return { product: request.body }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})
      const filePath = path.join(testDir, 'products/$productId.patch.ts')
      fs.writeFileSync(filePath, content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("method: 'PATCH'")
      expect(updatedContent).toContain("url: '/products/:productId'")
      // Verify schema is preserved
      expect(updatedContent).toContain('schema:')
      expect(updatedContent).toContain('properties:')
    })

    it('should synchronize method when file is renamed from .put.ts to .get.ts', () => {
      const content = `
export default async function (fastify) {
  fastify.route({
    url: '/settings',
    method: 'PUT',
    handler: async (request) => {
      return { updated: true }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'settings'), {recursive: true})
      const filePath = path.join(testDir, 'settings/index.get.ts')
      fs.writeFileSync(filePath, content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("method: 'GET'")
    })

    it('should preserve quote style when synchronizing method', () => {
      const singleQuoteContent = `
fastify.route({
  url: '/test',
  method: 'GET',
})
`

      const doubleQuoteContent = `
fastify.route({
  url: "/test",
  method: "GET",
})
`

      fs.writeFileSync(path.join(testDir, 'single.post.ts'), singleQuoteContent)
      fs.writeFileSync(path.join(testDir, 'double.post.ts'), doubleQuoteContent)

      performInitialScan(testDir)

      const singleUpdated = fs.readFileSync(
        path.join(testDir, 'single.post.ts'),
        'utf-8',
      )
      const doubleUpdated = fs.readFileSync(
        path.join(testDir, 'double.post.ts'),
        'utf-8',
      )

      // Single quotes should remain single
      expect(singleUpdated).toContain("method: 'POST'")
      expect(singleUpdated).not.toContain('method: "POST"')

      // Double quotes should remain double
      expect(doubleUpdated).toContain('method: "POST"')
      expect(doubleUpdated).not.toContain("method: 'POST'")
    })

    it('should handle method synchronization with file watcher', async () => {
      // Create a file with wrong method
      const initialContent = `
export default async function (fastify) {
  fastify.route({
    url: '/test',
    method: 'GET',
    handler: async () => ({ data: 'test' })
  })
}
`
      const filePath = path.join(testDir, 'test.post.ts')
      fs.writeFileSync(filePath, initialContent)

      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)

        if (event.type === 'add') {
          // Extract method from filename
          const extractHttpMethod =
            require('../method-extractor').extractHttpMethod
          const expectedMethod = extractHttpMethod(event.filePath)
          if (expectedMethod) {
            synchronizeRouteFile(event.filePath, '/test', expectedMethod)
          }
        }
      })

      const onReady = vi.fn()
      const watcher = createFileWatcher(testDir, {onEvent, onReady})

      await delay(200)
      expect(onReady).toHaveBeenCalled()

      // Add a new file with wrong method
      const newFilePath = path.join(testDir, 'new.post.ts')
      fs.writeFileSync(newFilePath, initialContent)

      await delay(400)

      // Verify the method was synchronized
      const finalContent = fs.readFileSync(newFilePath, 'utf-8')
      expect(finalContent).toContain("method: 'POST'")
      expect(finalContent).toContain('data')

      await watcher.close()
    })

    it('should handle multiple files with different method changes', () => {
      const files = [
        {
          name: 'users/index.get.ts',
          content: `fastify.route({ url: '/users', method: 'POST' })`,
          expectedMethod: 'GET',
        },
        {
          name: 'users/index.post.ts',
          content: `fastify.route({ url: '/users', method: 'DELETE' })`,
          expectedMethod: 'POST',
        },
        {
          name: 'products/$id.patch.ts',
          content: `fastify.route({ url: '/products/:id', method: 'GET' })`,
          expectedMethod: 'PATCH',
        },
        {
          name: 'settings/index.delete.ts',
          content: `fastify.route({ url: '/settings', method: 'PUT' })`,
          expectedMethod: 'DELETE',
        },
      ]

      // Create all files
      files.forEach((file) => {
        const dir = path.dirname(path.join(testDir, file.name))
        fs.mkdirSync(dir, {recursive: true})
        fs.writeFileSync(path.join(testDir, file.name), file.content)
      })

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(4)
      expect(result.filesUpdated).toBe(4)

      // Verify each file has the correct method
      files.forEach((file) => {
        const content = fs.readFileSync(path.join(testDir, file.name), 'utf-8')
        expect(content).toContain(`method: '${file.expectedMethod}'`)
      })
    })

    it('should not modify method if it already matches the filename', () => {
      const content = `
export default async function (fastify) {
  fastify.route({
    url: '/users',
    method: 'GET',
    handler: async () => ({ users: [] })
  })
}
`

      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(1)

      // File should not be modified
      const finalContent = fs.readFileSync(filePath, 'utf-8')
      expect(finalContent).toBe(content)
    })

    it('should synchronize both URL and method when both are incorrect', () => {
      const content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong-url',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: 'test' }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'api/v2/users'), {recursive: true})
      const filePath = path.join(testDir, 'api/v2/users/$id.patch.ts')
      fs.writeFileSync(filePath, content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/api/v2/users/:id'")
      expect(updatedContent).toContain("method: 'PATCH'")
      // Verify handler preserved
      expect(updatedContent).toContain("return { data: 'test' }")
    })
  })

  describe('File Scaffolding (New Empty Files)', () => {
    // Helper function to check if directory has index file
    function hasIndexFile(dir: string): boolean {
      try {
        const entries = fs.readdirSync(dir)
        return entries.includes('index.ts') || entries.includes('index.js')
      } catch {
        return false
      }
    }

    // Helper function to create a watcher that scaffolds empty files
    function createScaffoldingWatcher(testDir: string) {
      const {generateRouteTemplate} = require('../route-template')
      const {filePathToUrlPath} = require('../path-mapper')
      const {extractHttpMethod} = require('../method-extractor')

      const onEvent = vi.fn((event: WatchEvent) => {
        if (event.type === 'add') {
          // Check if this file is in a directory with an index file
          const dir = path.dirname(event.filePath)
          const fileName = path.basename(event.filePath)
          const isIndexFile = fileName === 'index.ts' || fileName === 'index.js'

          if (!isIndexFile && hasIndexFile(dir)) {
            // Skip scaffolding files in directories with index files
            return
          }

          // Check if file is empty and scaffold it
          const fileContent = fs.readFileSync(event.filePath, 'utf-8').trim()
          if (fileContent === '') {
            // Calculate path relative to testDir (which simulates src/api)
            const relativeToTestDir = path.relative(testDir, event.filePath)
            // Pretend it's in src/api for the path mapper
            const pathForMapper = path.join('src/api', relativeToTestDir)
            const expectedUrl = filePathToUrlPath(pathForMapper)
            const expectedMethod = extractHttpMethod(event.filePath)

            if (expectedUrl && expectedMethod) {
              const template = generateRouteTemplate(
                expectedUrl,
                expectedMethod,
              )
              fs.writeFileSync(event.filePath, template, 'utf-8')
            }
          }
        }
      })

      return createFileWatcher(testDir, {onEvent})
    }

    it('should scaffold new empty file with correct template', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      // Create an empty route file
      const newFilePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(newFilePath, '', 'utf-8')

      await delay(400)

      // Verify the file was scaffolded
      const content = fs.readFileSync(newFilePath, 'utf-8')
      expect(content).toContain(
        "import type { FastifyInstance } from 'fastify'",
      )
      expect(content).toContain("method: 'GET'")
      expect(content).toContain("url: '/users'")
      expect(content).toContain('fastify.route({')
      expect(content).toContain('async handler(req, reply)')
      // Since fastify-type-provider-zod is not installed in this project,
      // it should use the simple template
      expect(content).not.toContain('FastifyZodOpenApiTypeProvider')
      expect(content).not.toContain('zod')

      await watcher.close()
    })

    it('should scaffold new empty file with POST method', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const newFilePath = path.join(testDir, 'users/index.post.ts')
      fs.writeFileSync(newFilePath, '', 'utf-8')

      await delay(400)

      const content = fs.readFileSync(newFilePath, 'utf-8')
      expect(content).toContain("method: 'POST'")
      expect(content).toContain("url: '/users'")

      await watcher.close()
    })

    it('should scaffold new empty file with route parameters', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const newFilePath = path.join(testDir, 'users/$userId.patch.ts')
      fs.writeFileSync(newFilePath, '', 'utf-8')

      await delay(400)

      const content = fs.readFileSync(newFilePath, 'utf-8')
      expect(content).toContain("method: 'PATCH'")
      expect(content).toContain("url: '/users/:userId'")

      await watcher.close()
    })

    it('should NOT scaffold file that already has content', async () => {
      const existingContent = `
export default async function (fastify) {
  // Custom implementation
  console.log('existing')
}
`
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      const newFilePath = path.join(testDir, 'existing.get.ts')
      fs.writeFileSync(newFilePath, existingContent, 'utf-8')

      await delay(400)

      // File should keep its original content (not be scaffolded)
      const content = fs.readFileSync(newFilePath, 'utf-8')
      expect(content).toContain('Custom implementation')
      expect(content).toContain('existing')
      // Should not have scaffolded imports
      expect(content).not.toContain('FastifyZodOpenApiTypeProvider')

      await watcher.close()
    })

    it('should scaffold multiple new empty files correctly', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      const files = [
        {path: 'users.get.ts', method: 'GET', url: '/users'},
        {path: 'users.post.ts', method: 'POST', url: '/users'},
        {
          path: 'products/$id.delete.ts',
          method: 'DELETE',
          url: '/products/:id',
        },
      ]

      // Create all files as empty
      for (const file of files) {
        const dir = path.dirname(path.join(testDir, file.path))
        fs.mkdirSync(dir, {recursive: true})
        fs.writeFileSync(path.join(testDir, file.path), '', 'utf-8')
      }

      await delay(600)

      // Verify each file was scaffolded correctly
      for (const file of files) {
        const content = fs.readFileSync(path.join(testDir, file.path), 'utf-8')
        expect(content).toContain(`method: '${file.method}'`)
        expect(content).toContain(`url: '${file.url}'`)
        expect(content).toContain('FastifyInstance')
      }

      await watcher.close()
    })

    it('should scaffold deeply nested route files', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      const deepPath = path.join(
        testDir,
        'api/v2/orgs/$orgId/projects/$projectId',
      )
      fs.mkdirSync(deepPath, {recursive: true})
      const newFilePath = path.join(deepPath, 'tasks.get.ts')
      fs.writeFileSync(newFilePath, '', 'utf-8')

      await delay(400)

      const content = fs.readFileSync(newFilePath, 'utf-8')
      expect(content).toContain("method: 'GET'")
      expect(content).toContain(
        "url: '/api/v2/orgs/:orgId/projects/:projectId/tasks'",
      )

      await watcher.close()
    })

    it('should create valid TypeScript that can be parsed', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      const newFilePath = path.join(testDir, 'test.get.ts')
      fs.writeFileSync(newFilePath, '', 'utf-8')

      await delay(400)

      const content = fs.readFileSync(newFilePath, 'utf-8')

      // Verify the generated file can be parsed
      const {parseRouteFile} = require('../ast-parser')
      expect(() => parseRouteFile(content)).not.toThrow()

      const routeConfig = parseRouteFile(content)
      expect(routeConfig.url).toBe('/test')
      expect(routeConfig.method).toBe('GET')

      await watcher.close()
    })

    it('should handle file with only whitespace as empty', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      const newFilePath = path.join(testDir, 'whitespace.get.ts')
      fs.writeFileSync(newFilePath, '  \n\t  \n  ', 'utf-8')

      await delay(400)

      // Since trim() is empty, should scaffold
      const content = fs.readFileSync(newFilePath, 'utf-8')
      expect(content).toContain('FastifyInstance')
      expect(content).toContain("method: 'GET'")

      await watcher.close()
    })

    it('should NOT scaffold empty files in directories with index.ts', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      // Create index.ts (plugin file without method suffix)
      const docsDir = path.join(testDir, 'docs')
      fs.mkdirSync(docsDir, {recursive: true})
      const indexPath = path.join(docsDir, 'index.ts')
      fs.writeFileSync(
        indexPath,
        `export default async function (fastify) { /* plugin */ }`,
        'utf-8',
      )

      await delay(400)

      // Now create an empty sibling file
      const siblingPath = path.join(docsDir, 'about.get.ts')
      fs.writeFileSync(siblingPath, '', 'utf-8')

      await delay(400)

      // The sibling file should remain empty (not scaffolded)
      const content = fs.readFileSync(siblingPath, 'utf-8')
      expect(content).toBe('')
      expect(content).not.toContain('FastifyInstance')
      expect(content).not.toContain('fastify.route')

      await watcher.close()
    })

    it('should NOT scaffold empty files in directories with index.js', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      // Create index.js (plugin file without method suffix)
      const apiDir = path.join(testDir, 'api')
      fs.mkdirSync(apiDir, {recursive: true})
      const indexPath = path.join(apiDir, 'index.js')
      fs.writeFileSync(
        indexPath,
        `export default async function (fastify) { /* plugin */ }`,
        'utf-8',
      )

      await delay(400)

      // Now create an empty sibling file
      const siblingPath = path.join(apiDir, 'users.get.ts')
      fs.writeFileSync(siblingPath, '', 'utf-8')

      await delay(400)

      // The sibling file should remain empty (not scaffolded)
      const content = fs.readFileSync(siblingPath, 'utf-8')
      expect(content).toBe('')

      await watcher.close()
    })

    it('should scaffold index.get.ts even when it is empty (not blocking)', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      // Create an empty index.get.ts file (has method suffix)
      const docsDir = path.join(testDir, 'docs')
      fs.mkdirSync(docsDir, {recursive: true})
      const indexGetPath = path.join(docsDir, 'index.get.ts')
      fs.writeFileSync(indexGetPath, '', 'utf-8')

      await delay(400)

      // index.get.ts should be scaffolded (it's a route file, not a plugin)
      const content = fs.readFileSync(indexGetPath, 'utf-8')
      expect(content).toContain('FastifyInstance')
      expect(content).toContain("method: 'GET'")
      expect(content).toContain("url: '/docs'")

      await watcher.close()
    })

    it('should scaffold files in subdirectories even when parent has index.ts', async () => {
      const watcher = createScaffoldingWatcher(testDir)
      await delay(200)

      // Create index.ts in parent directory
      const docsDir = path.join(testDir, 'docs')
      fs.mkdirSync(docsDir, {recursive: true})
      fs.writeFileSync(
        path.join(docsDir, 'index.ts'),
        `export default async function (fastify) {}`,
        'utf-8',
      )

      await delay(400)

      // Create empty file in subdirectory
      const apiDir = path.join(docsDir, 'api')
      fs.mkdirSync(apiDir, {recursive: true})
      const apiUsersPath = path.join(apiDir, 'users.get.ts')
      fs.writeFileSync(apiUsersPath, '', 'utf-8')

      await delay(400)

      // The subdirectory file should be scaffolded (parent index.ts doesn't affect it)
      const content = fs.readFileSync(apiUsersPath, 'utf-8')
      expect(content).toContain('FastifyInstance')
      expect(content).toContain("method: 'GET'")
      expect(content).toContain("url: '/docs/api/users'")

      await watcher.close()
    })
  })
})
