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
    url: '/api/users',
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
      expect(updatedContent).toContain("url: '/api/users'")
    })
  })

  describe('multiple files with mixed states', () => {
    it('should handle mix of correct, incorrect, and no conflicts', () => {
      // File 1: Correct URL
      const file1Content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users',
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
    url: '/api/products',
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

      // Verify file2 was updated to /api/orders (not /users)
      const updatedContent = fs.readFileSync(file2Path, 'utf-8')
      expect(updatedContent).toContain("url: '/api/orders'")
    })
  })

  describe('conflict detection and resolution', () => {
    it('should detect and resolve conflicts', () => {
      // Two files with SAME METHOD and different param names map to same URL structure (real conflict!)
      // $userId.get.ts -> /api/users/:userId (normalized to :param)
      // $id.get.ts -> /api/users/:userId initially (normalized to :param) - CONFLICT!
      // After conflict resolution, $id.get.ts gets corrected to :id and gets -2 suffix
      const file1Content = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users/:userId',
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
    url: '/api/users/:userId',
    method: 'GET',
    handler: async (request, reply) => {
      return { users: [], version: 2 }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})

      const file1Path = path.join(testDir, 'users/$userId.get.ts')
      const file2Path = path.join(testDir, 'users/$id.get.ts')

      fs.writeFileSync(file1Path, file1Content)
      fs.writeFileSync(file2Path, file2Content)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(2)
      expect(result.conflictsResolved).toBe(1)

      // Verify both files have unique URLs
      const file1Updated = fs.readFileSync(file1Path, 'utf-8')
      const file2Updated = fs.readFileSync(file2Path, 'utf-8')

      const url1 = file1Updated.match(/url: '([^']+)'/)?.[1]
      const url2 = file2Updated.match(/url: '([^']+)'/)?.[1]

      // Both should have their correct parameter names
      expect(url1).toMatch(/:(userId|id)/)
      expect(url2).toMatch(/:(userId|id)/)

      // URLs should be different
      expect(url1).not.toBe(url2)

      // One should have -2 suffix, one should not
      const hasSuffix = url1?.includes('-2') || url2?.includes('-2')
      expect(hasSuffix).toBe(true)
    })

    it('should handle three-way conflicts', () => {
      // Three files with SAME METHOD that all map to same URL structure (real conflict!)
      // All start with :userId in code, but filenames suggest different param names
      const fileContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users/:userId',
    method: 'GET',
    handler: async (request, reply) => {
      return { users: [] }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})

      const file1Path = path.join(testDir, 'users/$userId.get.ts')
      const file2Path = path.join(testDir, 'users/$id.get.ts')
      const file3Path = path.join(testDir, 'users/$uid.get.ts')

      fs.writeFileSync(file1Path, fileContent)
      fs.writeFileSync(file2Path, fileContent)
      fs.writeFileSync(file3Path, fileContent)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(3)
      expect(result.conflictsResolved).toBe(1)

      // The order files are processed may vary, but we should have unique URLs
      const file1Updated = fs.readFileSync(file1Path, 'utf-8')
      const file2Updated = fs.readFileSync(file2Path, 'utf-8')
      const file3Updated = fs.readFileSync(file3Path, 'utf-8')

      const urls = [
        file1Updated.match(/url: '([^']+)'/)?.[1],
        file2Updated.match(/url: '([^']+)'/)?.[1],
        file3Updated.match(/url: '([^']+)'/)?.[1],
      ]

      // All URLs should be unique
      expect(new Set(urls).size).toBe(3)

      // Each should have the correct param name for its filename
      // and one keeps original, others get -2, -3 suffixes
      const hasUserId = urls.some((u) => u?.includes(':userId') && !u.includes('-'))
      const hasConflictSuffix = urls.some((u) => u?.includes('-2') || u?.includes('-3'))

      expect(hasUserId || urls.some((u) => u?.includes(':id') && !u.includes('-'))).toBe(true)
      expect(hasConflictSuffix).toBe(true)
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
        "url: '/api/api/v1/users/:userId/posts/:postId'",
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
      expect(updatedContent).toContain("url: '/api/users'")
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
      expect(updatedContent).toContain("url: '/api/users'")
    })
  })

  describe('realistic API structure', () => {
    it('should handle a realistic multi-route API', () => {
      const routes = [
        {
          dir: 'users',
          file: 'index.get.ts',
          wrongUrl: '/wrong-users',
          correctUrl: '/api/users',
        },
        {
          dir: 'users',
          file: 'index.post.ts',
          wrongUrl: '/create-user',
          correctUrl: '/api/users',
        },
        {
          dir: 'users/$userId',
          file: 'index.get.ts',
          wrongUrl: '/user/:id',
          correctUrl: '/api/users/:userId',
        },
        {
          dir: 'users/$userId',
          file: 'index.patch.ts',
          wrongUrl: '/wrong-path',
          correctUrl: '/api/users/:userId',
        },
        {
          dir: 'products',
          file: 'index.get.ts',
          wrongUrl: '/api/products',
          correctUrl: '/api/products',
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
      expect(result.filesUpdated).toBe(4) // 4 files updated
      expect(result.filesSkipped).toBe(1) // 1 already correct (products)
      expect(result.conflictsResolved).toBe(0) // No conflicts - different methods are allowed!
      expect(result.errors).toBe(0)

      // Verify all files have correct URLs (no conflict suffixes needed)
      const file1 = fs.readFileSync(
        path.join(testDir, 'users/index.get.ts'),
        'utf-8',
      )
      expect(file1).toContain("url: '/api/users'")

      const file2 = fs.readFileSync(
        path.join(testDir, 'users/index.post.ts'),
        'utf-8',
      )
      expect(file2).toContain("url: '/api/users'") // Same URL, different method - valid!

      const file3 = fs.readFileSync(
        path.join(testDir, 'users/$userId/index.get.ts'),
        'utf-8',
      )
      expect(file3).toContain("url: '/api/users/:userId'")

      const file4 = fs.readFileSync(
        path.join(testDir, 'users/$userId/index.patch.ts'),
        'utf-8',
      )
      expect(file4).toContain("url: '/api/users/:userId'") // Same URL, different method - valid!

      const file5 = fs.readFileSync(
        path.join(testDir, 'products/index.get.ts'),
        'utf-8',
      )
      expect(file5).toContain("url: '/api/products'") // No conflict, already correct
    })
  })

  describe('index file behavior', () => {
    it('should NOT modify files that are siblings of index.ts', () => {
      // Create index.ts (plugin file - no method suffix)
      const indexContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  // Plugin setup code
}
`

      // Create a sibling route file with wrong URL
      const siblingContent = `
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

      fs.mkdirSync(path.join(testDir, 'docs'), {recursive: true})
      const indexPath = path.join(testDir, 'docs/index.ts')
      const siblingPath = path.join(testDir, 'docs/about.get.ts')

      fs.writeFileSync(indexPath, indexContent)
      fs.writeFileSync(siblingPath, siblingContent)

      const result = performInitialScan(testDir)

      // index.ts is not a route file (no method suffix), so totalFiles should be 0
      expect(result.totalFiles).toBe(0)
      expect(result.filesUpdated).toBe(0)
      expect(result.filesSkipped).toBe(0)

      // Verify sibling file was NOT modified
      const unchangedContent = fs.readFileSync(siblingPath, 'utf-8')
      expect(unchangedContent).toBe(siblingContent) // Should be identical
      expect(unchangedContent).toContain("url: '/wrong'") // Still has wrong URL
    })

    it('should NOT modify multiple siblings of index.ts', () => {
      const indexContent = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  // Plugin setup
}
`

      const siblingContent1 = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong1',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      const siblingContent2 = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong2',
    method: 'POST',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'docs'), {recursive: true})
      const indexPath = path.join(testDir, 'docs/index.ts')
      const sibling1Path = path.join(testDir, 'docs/about.get.ts')
      const sibling2Path = path.join(testDir, 'docs/faq.post.ts')

      fs.writeFileSync(indexPath, indexContent)
      fs.writeFileSync(sibling1Path, siblingContent1)
      fs.writeFileSync(sibling2Path, siblingContent2)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(0)
      expect(result.filesUpdated).toBe(0)

      // Verify neither sibling was modified
      const unchanged1 = fs.readFileSync(sibling1Path, 'utf-8')
      expect(unchanged1).toBe(siblingContent1)
      expect(unchanged1).toContain("url: '/wrong1'")

      const unchanged2 = fs.readFileSync(sibling2Path, 'utf-8')
      expect(unchanged2).toBe(siblingContent2)
      expect(unchanged2).toContain("url: '/wrong2'")
    })

    it('should allow index.get.ts to coexist and be updated like other routes', () => {
      const routeContent1 = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong1',
    method: 'GET',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      const routeContent2 = `
import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    url: '/wrong2',
    method: 'POST',
    handler: async (request, reply) => {
      return { data: {} }
    }
  })
}
`

      fs.mkdirSync(path.join(testDir, 'docs'), {recursive: true})
      const route1Path = path.join(testDir, 'docs/index.get.ts')
      const route2Path = path.join(testDir, 'docs/about.post.ts')

      fs.writeFileSync(route1Path, routeContent1)
      fs.writeFileSync(route2Path, routeContent2)

      const result = performInitialScan(testDir)

      expect(result.totalFiles).toBe(2)
      expect(result.filesUpdated).toBe(2)

      // Verify both files were updated correctly
      const updated1 = fs.readFileSync(route1Path, 'utf-8')
      expect(updated1).toContain("url: '/api/docs'")

      const updated2 = fs.readFileSync(route2Path, 'utf-8')
      expect(updated2).toContain("url: '/api/docs/about'")
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
      expect(updatedContent).toContain('url: "/api/users"')
      expect(updatedContent).not.toContain("url: '/api/users'")
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
      expect(updatedContent).toContain('url: `/api/users`')
    })
  })
})
