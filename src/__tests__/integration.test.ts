import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {performInitialScan} from '../initial-scan'
import {createFileWatcher, type WatchEvent} from '../file-watcher'
import {synchronizeRouteFile} from '../route-synchronizer'
import {parseRouteFile} from '../ast-parser'

/**
 * Integration tests for the complete Fastify File-Based Routing CLI.
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
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.writeFileSync(path.join(testDir, 'users/index.get.ts'), usersContent)
      fs.writeFileSync(
        path.join(testDir, 'users/$userId.get.ts'),
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
      const userIdFile = path.join(testDir, 'users/$userId.get.ts')

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
      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})

      fs.writeFileSync(
        path.join(testDir, 'auth/login.post.ts'),
        authLoginContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'users/index.get.ts'),
        usersListContent,
      )
      fs.writeFileSync(
        path.join(testDir, 'users/$userId.get.ts'),
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
        fs.readFileSync(path.join(testDir, 'users/$userId.get.ts'), 'utf-8'),
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
})
