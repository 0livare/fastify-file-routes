import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {performInitialScan} from '../initial-scan'

describe('performInitialScan', () => {
  const testDir = path.join(__dirname, '__test-scan-fixtures__')

  beforeEach(() => {
    // Clean up test directory before each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true})
    }
    fs.mkdirSync(testDir, {recursive: true})
  })

  afterEach(() => {
    // Clean up test directory after each test
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true})
    }
  })

  describe('empty directory', () => {
    it('should handle empty directory gracefully', () => {
      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(0)
      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(0)
      expect(result.conflictsResolved).toBe(0)
      expect(result.errors).toBe(0)
    })
  })

  describe('single file with correct URL', () => {
    it('should skip file that already has correct URL', () => {
      const fileContent = `
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
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.writeFileSync(path.join(testDir, 'users/index.get.ts'), fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(1)
      expect(result.conflictsResolved).toBe(0)
      expect(result.errors).toBe(0)
    })
  })

  describe('single file with incorrect URL', () => {
    it('should update file with incorrect URL', () => {
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong-url',
    method: 'GET',
    handler: async (request, reply) => {
      return { users: [] }
    }
  })
}
`
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const filePath = path.join(testDir, 'users/index.get.ts')
      fs.writeFileSync(filePath, fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)
      expect(result.filesSkipped).toBe(0)
      expect(result.conflictsResolved).toBe(0)
      expect(result.errors).toBe(0)

      // Verify the file was actually updated
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
    })
  })

  describe('multiple files with mixed states', () => {
    it('should handle mix of correct, incorrect, and no conflicts', () => {
      // File 1: Correct URL
      const file1Content = `
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
      // File 2: Incorrect URL (different path)
      const file2Content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong',
    method: 'POST',
    handler: async (request, reply) => {
      return { created: true }
    }
  })
}
`
      // File 3: Correct URL
      const file3Content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/products',
    method: 'GET',
    handler: async (request, reply) => {
      return { products: [] }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'orders'), {recursive: true})

      const file1Path = path.join(testDir, 'users/index.get.ts')
      const file2Path = path.join(testDir, 'orders/index.post.ts')
      const file3Path = path.join(testDir, 'products/index.get.ts')

      fs.writeFileSync(file1Path, file1Content)
      fs.writeFileSync(file2Path, file2Content)
      fs.writeFileSync(file3Path, file3Content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(3)
      expect(result.filesUpdated).toBe(1)
      expect(result.filesSkipped).toBe(2)
      expect(result.conflictsResolved).toBe(0)
      expect(result.errors).toBe(0)

      // Verify file2 was updated to /orders (not /users)
      const updatedContent = fs.readFileSync(file2Path, 'utf-8')
      expect(updatedContent).toContain("url: '/orders'")
    })
  })

  describe('conflict detection and resolution', () => {
    it('should detect and resolve conflicts', () => {
      // Two files in same directory with same name pattern (both map to /users)
      // index.get.ts -> /users
      // index.post.ts -> /users (conflict!)
      const file1Content = `
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
      const file2Content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/users',
    method: 'POST',
    handler: async (request, reply) => {
      return { users: [], version: 2 }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})

      const file1Path = path.join(testDir, 'users/index.get.ts')
      const file2Path = path.join(testDir, 'users/index.post.ts')

      fs.writeFileSync(file1Path, file1Content)
      fs.writeFileSync(file2Path, file2Content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(2)
      expect(result.conflictsResolved).toBe(1)

      // Verify first file keeps original URL
      const file1Updated = fs.readFileSync(file1Path, 'utf-8')
      expect(file1Updated).toContain("url: '/users'")

      // Verify second file gets suffix
      const file2Updated = fs.readFileSync(file2Path, 'utf-8')
      expect(file2Updated).toContain("url: '/users-2'")
    })

    it('should handle three-way conflicts', () => {
      // Three files that all map to /users
      // index.get.ts -> /users
      // index.post.ts -> /users
      // index.put.ts -> /users
      const fileContent = `
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

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})

      const file1Path = path.join(testDir, 'users/index.get.ts')
      const file2Path = path.join(testDir, 'users/index.post.ts')
      const file3Path = path.join(testDir, 'users/index.put.ts')

      fs.writeFileSync(file1Path, fileContent)
      fs.writeFileSync(file2Path, fileContent)
      fs.writeFileSync(file3Path, fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(3)
      expect(result.conflictsResolved).toBe(1)

      // Verify URLs
      const file1Updated = fs.readFileSync(file1Path, 'utf-8')
      expect(file1Updated).toContain("url: '/users'")

      const file2Updated = fs.readFileSync(file2Path, 'utf-8')
      expect(file2Updated).toContain("url: '/users-2'")

      const file3Updated = fs.readFileSync(file3Path, 'utf-8')
      expect(file3Updated).toContain("url: '/users-3'")
    })
  })

  describe('nested directory structure', () => {
    it('should handle deeply nested routes', () => {
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'api/v1/users/$userId/posts/$postId'), {
        recursive: true,
      })
      const filePath = path.join(
        testDir,
        'api/v1/users/$userId/posts/$postId/index.get.ts',
      )
      fs.writeFileSync(filePath, fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      // Verify the file was updated with the correct nested URL
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain(
        "url: '/api/v1/users/:userId/posts/:postId'",
      )
    })
  })

  describe('pathless layouts', () => {
    it('should handle pathless layouts correctly', () => {
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, '_auth/users'), {recursive: true})
      const filePath = path.join(testDir, '_auth/users/index.get.ts')
      fs.writeFileSync(filePath, fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(1)

      // Verify pathless layout is excluded from URL
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
    })
  })

  describe('error handling', () => {
    it('should handle files without route() call gracefully', () => {
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  // No route call here
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const filePath = path.join(testDir, 'users/index.get.ts')
      fs.writeFileSync(filePath, fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(1)
      expect(result.filesUpdated).toBe(0)
      expect(result.errors).toBe(1)
    })

    it('should continue processing other files when one fails', () => {
      const goodContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`
      const badContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  // No route call
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})

      const goodPath = path.join(testDir, 'users/index.get.ts')
      const badPath = path.join(testDir, 'products/index.get.ts')

      fs.writeFileSync(goodPath, goodContent)
      fs.writeFileSync(badPath, badContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(2)
      expect(result.filesUpdated).toBe(1)
      expect(result.errors).toBe(1)

      // Verify the good file was still updated
      const updatedContent = fs.readFileSync(goodPath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
    })
  })

  describe('realistic API structure', () => {
    it('should handle a realistic multi-route API', () => {
      const routes = [
        {
          dir: 'users',
          file: 'index.get.ts',
          wrongUrl: '/api/users',
          correctUrl: '/users',
        },
        {
          dir: 'users',
          file: 'index.post.ts',
          wrongUrl: '/create-user',
          correctUrl: '/users',
        },
        {
          dir: 'users/$userId',
          file: 'index.get.ts',
          wrongUrl: '/user/:id',
          correctUrl: '/users/:userId',
        },
        {
          dir: 'users/$userId',
          file: 'index.patch.ts',
          wrongUrl: '/users/:userId',
          correctUrl: '/users/:userId',
        },
        {
          dir: 'products',
          file: 'index.get.ts',
          wrongUrl: '/products',
          correctUrl: '/products',
        },
      ]

      for (const route of routes) {
        fs.mkdirSync(path.join(testDir, route.dir), {recursive: true})
        const content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '${route.wrongUrl}',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`
        fs.writeFileSync(path.join(testDir, route.dir, route.file), content)
      }

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(5)
      expect(result.filesUpdated).toBe(4) // 4 files updated (includes conflict resolutions)
      expect(result.filesSkipped).toBe(1) // 1 already correct (products)
      expect(result.conflictsResolved).toBe(2) // 2 conflicts: users/ and users/$userId/
      expect(result.errors).toBe(0)

      // Verify specific files (accounting for conflicts)
      const file1 = fs.readFileSync(
        path.join(testDir, 'users/index.get.ts'),
        'utf-8',
      )
      expect(file1).toContain("url: '/users'") // First keeps original

      const file2 = fs.readFileSync(
        path.join(testDir, 'users/index.post.ts'),
        'utf-8',
      )
      expect(file2).toContain("url: '/users-2'") // Second gets suffix

      const file3 = fs.readFileSync(
        path.join(testDir, 'users/$userId/index.get.ts'),
        'utf-8',
      )
      expect(file3).toContain("url: '/users/:userId'") // First keeps original

      const file4 = fs.readFileSync(
        path.join(testDir, 'users/$userId/index.patch.ts'),
        'utf-8',
      )
      expect(file4).toContain("url: '/users/:userId-2'") // Second gets suffix

      const file5 = fs.readFileSync(
        path.join(testDir, 'products/index.get.ts'),
        'utf-8',
      )
      expect(file5).toContain("url: '/products'") // No conflict, already correct
    })
  })

  describe('quote style preservation', () => {
    it('should preserve double quotes', () => {
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: "/wrong",
    method: "GET",
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const filePath = path.join(testDir, 'users/index.get.ts')
      fs.writeFileSync(filePath, fileContent)

      performInitialScan(testDir)

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain('url: "/users"')
      expect(updatedContent).not.toContain("url: '/users'")
    })

    it('should preserve template literals', () => {
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: \`/wrong\`,
    method: "GET",
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      const filePath = path.join(testDir, 'users/index.get.ts')
      fs.writeFileSync(filePath, fileContent)

      performInitialScan(testDir)

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain('url: `/users`')
    })
  })
})
