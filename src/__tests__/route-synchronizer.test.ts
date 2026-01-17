import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {synchronizeRouteFile, synchronizeRoutes} from '../route-synchronizer'

const TEST_DIR = path.join(__dirname, '__test-sync-files__')

describe('synchronizeRouteFile', () => {
  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, {recursive: true})
    }
  })

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, {recursive: true, force: true})
    }
  })

  describe('URL matches (no modification needed)', () => {
    it('should skip file when URL already matches', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `
        fastify.route({
          url: '/users',
          method: 'GET',
          handler: async () => ({ users: [] })
        })
      `
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(false)
      expect(result.oldUrl).toBe('/users')
      expect(result.newUrl).toBe('/users')
      expect(result.error).toBeUndefined()

      // File content should be unchanged
      const fileContent = fs.readFileSync(filePath, 'utf-8')
      expect(fileContent).toBe(content)
    })

    it('should skip file with complex URL that already matches', () => {
      const filePath = path.join(TEST_DIR, 'user-details.get.ts')
      const content = `
        fastify.route({
          url: '/api/users/:userId/posts/:postId',
          method: 'GET',
          handler: async () => ({})
        })
      `
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(
        filePath,
        '/api/users/:userId/posts/:postId',
      )

      expect(result.modified).toBe(false)
      expect(result.oldUrl).toBe('/api/users/:userId/posts/:postId')
    })
  })

  describe('URL differs (modification needed)', () => {
    it('should update URL when it differs from expected', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `fastify.route({
  url: '/old-url',
  method: 'GET',
  handler: async () => ({ users: [] })
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      expect(result.oldUrl).toBe('/old-url')
      expect(result.newUrl).toBe('/users')
      expect(result.error).toBeUndefined()

      // File content should be updated
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
      expect(updatedContent).not.toContain('/old-url')
    })

    it('should update URL while preserving quote style', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `fastify.route({
  url: "/old-url",
  method: "GET",
  handler: async () => ({})
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain('url: "/users"')
    })

    it('should update URL while preserving template literal style', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = 'fastify.route({\n  url: `/old-url`,\n  method: "GET"\n})'
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain('url: `/users`')
    })

    it('should update URL while preserving formatting and comments', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `fastify.route({
  // User list endpoint
  url: '/old-url',
  method: 'GET', // GET method
  handler: async () => ({ users: [] })
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain('// User list endpoint')
      expect(updatedContent).toContain('// GET method')
      expect(updatedContent).toContain("url: '/users'")
    })

    it('should handle file with no current URL', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `fastify.route({
  method: 'GET',
  handler: async () => ({ users: [] })
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(false)
      expect(result.oldUrl).toBeNull()
      expect(result.error).toContain('No valid fields found')
    })
  })

  describe('withTypeProvider chaining', () => {
    it('should update URL in withTypeProvider chained route', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `fastify.withTypeProvider<ZodTypeProvider>().route({
  url: '/old-url',
  method: 'GET',
  schema: { response: { 200: z.array(z.string()) } },
  handler: async () => []
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
      expect(updatedContent).toContain('withTypeProvider')
    })
  })

  describe('error handling', () => {
    it('should handle non-existent file gracefully', () => {
      const filePath = path.join(TEST_DIR, 'nonexistent.get.ts')

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(false)
      expect(result.error).toBeDefined()
      expect(result.error).toContain('no such file')
    })

    it('should handle file without route structure', () => {
      const filePath = path.join(TEST_DIR, 'invalid.get.ts')
      const content = `
        const x = 42;
        console.log(x);
      `
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(false)
      expect(result.error).toContain('No valid fields found')
    })

    it('should handle file with malformed syntax', () => {
      const filePath = path.join(TEST_DIR, 'malformed.get.ts')
      const content = `fastify.route({ url: '/test' `
      fs.writeFileSync(filePath, content)

      // Should still parse despite syntax error
      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      expect(result.oldUrl).toBe('/test')
    })
  })

  describe('complex scenarios', () => {
    it('should update URL in file with multiple properties', () => {
      const filePath = path.join(TEST_DIR, 'users.post.ts')
      const content = `fastify.route({
  url: '/old-url',
  method: 'POST',
  schema: {
    body: {
      type: 'object',
      properties: {
        name: { type: 'string' }
      }
    },
    response: {
      200: {
        type: 'object',
        properties: {
          id: { type: 'number' }
        }
      }
    }
  },
  handler: async (request) => {
    return { id: 1 }
  }
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
      expect(updatedContent).toContain('schema:')
      expect(updatedContent).toContain('handler:')
    })

    it('should update parameterized URL', () => {
      const filePath = path.join(TEST_DIR, 'user-detail.get.ts')
      const content = `fastify.route({
  url: '/users/:id',
  method: 'GET',
  handler: async (request) => {
    return { userId: request.params.id }
  }
})`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users/:userId')

      expect(result.modified).toBe(true)
      expect(result.oldUrl).toBe('/users/:id')
      expect(result.newUrl).toBe('/users/:userId')

      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users/:userId'")
    })
  })

  describe('real-world examples', () => {
    it('should handle typical TypeScript route file', () => {
      const filePath = path.join(TEST_DIR, 'users.get.ts')
      const content = `import { FastifyInstance } from 'fastify'

export default function(fastify: FastifyInstance) {
  fastify.route({
    url: '/api/users',
    method: 'GET',
    handler: async (request, reply) => {
      const users = await db.users.findMany()
      return { users }
    }
  })
}`
      fs.writeFileSync(filePath, content)

      const result = synchronizeRouteFile(filePath, '/users')

      expect(result.modified).toBe(true)
      const updatedContent = fs.readFileSync(filePath, 'utf-8')
      expect(updatedContent).toContain("url: '/users'")
      expect(updatedContent).toContain('import')
      expect(updatedContent).toContain('export default')
    })
  })
})

describe('synchronizeRoutes', () => {
  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, {recursive: true})
    }
  })

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, {recursive: true, force: true})
    }
  })

  it('should handle empty file map', () => {
    const fileUrlMap = new Map<string, string>()

    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(0)
    expect(summary.filesModified).toBe(0)
    expect(summary.filesSkipped).toBe(0)
    expect(summary.errors).toBe(0)
    expect(summary.results).toHaveLength(0)
  })

  it('should synchronize single file that needs update', () => {
    const filePath = path.join(TEST_DIR, 'users.get.ts')
    const content = `fastify.route({
  url: '/old-url',
  method: 'GET',
  handler: async () => ({})
})`
    fs.writeFileSync(filePath, content)

    const fileUrlMap = new Map([[filePath, '/users']])
    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(1)
    expect(summary.filesModified).toBe(1)
    expect(summary.filesSkipped).toBe(0)
    expect(summary.errors).toBe(0)
    expect(summary.results).toHaveLength(1)
    expect(summary.results[0].modified).toBe(true)
  })

  it('should synchronize single file that does not need update', () => {
    const filePath = path.join(TEST_DIR, 'users.get.ts')
    const content = `fastify.route({
  url: '/users',
  method: 'GET',
  handler: async () => ({})
})`
    fs.writeFileSync(filePath, content)

    const fileUrlMap = new Map([[filePath, '/users']])
    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(1)
    expect(summary.filesModified).toBe(0)
    expect(summary.filesSkipped).toBe(1)
    expect(summary.errors).toBe(0)
    expect(summary.results).toHaveLength(1)
    expect(summary.results[0].modified).toBe(false)
  })

  it('should synchronize multiple files with mixed results', () => {
    // File 1: needs update
    const file1 = path.join(TEST_DIR, 'users.get.ts')
    fs.writeFileSync(
      file1,
      `fastify.route({ url: '/old-url', method: 'GET', handler: async () => ({}) })`,
    )

    // File 2: already correct
    const file2 = path.join(TEST_DIR, 'posts.get.ts')
    fs.writeFileSync(
      file2,
      `fastify.route({ url: '/posts', method: 'GET', handler: async () => ({}) })`,
    )

    // File 3: needs update
    const file3 = path.join(TEST_DIR, 'comments.get.ts')
    fs.writeFileSync(
      file3,
      `fastify.route({ url: '/wrong', method: 'GET', handler: async () => ({}) })`,
    )

    const fileUrlMap = new Map([
      [file1, '/users'],
      [file2, '/posts'],
      [file3, '/comments'],
    ])

    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(3)
    expect(summary.filesModified).toBe(2)
    expect(summary.filesSkipped).toBe(1)
    expect(summary.errors).toBe(0)
    expect(summary.results).toHaveLength(3)

    // Verify files were updated correctly
    expect(fs.readFileSync(file1, 'utf-8')).toContain('/users')
    expect(fs.readFileSync(file2, 'utf-8')).toContain('/posts')
    expect(fs.readFileSync(file3, 'utf-8')).toContain('/comments')
  })

  it('should handle errors gracefully and continue processing', () => {
    // File 1: valid
    const file1 = path.join(TEST_DIR, 'users.get.ts')
    fs.writeFileSync(
      file1,
      `fastify.route({ url: '/old', method: 'GET', handler: async () => ({}) })`,
    )

    // File 2: non-existent
    const file2 = path.join(TEST_DIR, 'nonexistent.get.ts')

    // File 3: valid
    const file3 = path.join(TEST_DIR, 'posts.get.ts')
    fs.writeFileSync(
      file3,
      `fastify.route({ url: '/wrong', method: 'GET', handler: async () => ({}) })`,
    )

    const fileUrlMap = new Map([
      [file1, '/users'],
      [file2, '/missing'],
      [file3, '/posts'],
    ])

    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(3)
    expect(summary.filesModified).toBe(2)
    expect(summary.filesSkipped).toBe(0)
    expect(summary.errors).toBe(1)
    expect(summary.results).toHaveLength(3)

    // Check that valid files were still updated
    expect(fs.readFileSync(file1, 'utf-8')).toContain('/users')
    expect(fs.readFileSync(file3, 'utf-8')).toContain('/posts')

    // Check that error was recorded
    const errorResult = summary.results.find((r) => r.filePath === file2)
    expect(errorResult?.error).toBeDefined()
  })

  it('should handle files with invalid structure gracefully', () => {
    // File 1: valid
    const file1 = path.join(TEST_DIR, 'users.get.ts')
    fs.writeFileSync(
      file1,
      `fastify.route({ url: '/old', method: 'GET', handler: async () => ({}) })`,
    )

    // File 2: no route structure
    const file2 = path.join(TEST_DIR, 'invalid.get.ts')
    fs.writeFileSync(file2, `const x = 42;`)

    const fileUrlMap = new Map([
      [file1, '/users'],
      [file2, '/invalid'],
    ])

    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(2)
    expect(summary.filesModified).toBe(1)
    expect(summary.filesSkipped).toBe(0)
    expect(summary.errors).toBe(1)

    // Valid file should be updated
    expect(fs.readFileSync(file1, 'utf-8')).toContain('/users')
  })

  it('should provide detailed results for each file', () => {
    const file1 = path.join(TEST_DIR, 'users.get.ts')
    fs.writeFileSync(
      file1,
      `fastify.route({ url: '/old', method: 'GET', handler: async () => ({}) })`,
    )

    const file2 = path.join(TEST_DIR, 'posts.get.ts')
    fs.writeFileSync(
      file2,
      `fastify.route({ url: '/posts', method: 'GET', handler: async () => ({}) })`,
    )

    const fileUrlMap = new Map([
      [file1, '/users'],
      [file2, '/posts'],
    ])

    const summary = synchronizeRoutes(fileUrlMap)

    // Check result for modified file
    const result1 = summary.results.find((r) => r.filePath === file1)
    expect(result1).toBeDefined()
    expect(result1?.modified).toBe(true)
    expect(result1?.oldUrl).toBe('/old')
    expect(result1?.newUrl).toBe('/users')
    expect(result1?.error).toBeUndefined()

    // Check result for skipped file
    const result2 = summary.results.find((r) => r.filePath === file2)
    expect(result2).toBeDefined()
    expect(result2?.modified).toBe(false)
    expect(result2?.oldUrl).toBe('/posts')
    expect(result2?.newUrl).toBe('/posts')
    expect(result2?.error).toBeUndefined()
  })

  it('should handle large number of files efficiently', () => {
    const fileUrlMap = new Map<string, string>()

    // Create 20 test files
    for (let i = 0; i < 20; i++) {
      const filePath = path.join(TEST_DIR, `route${i}.get.ts`)
      fs.writeFileSync(
        filePath,
        `fastify.route({ url: '/old${i}', method: 'GET', handler: async () => ({}) })`,
      )
      fileUrlMap.set(filePath, `/route${i}`)
    }

    const summary = synchronizeRoutes(fileUrlMap)

    expect(summary.totalFiles).toBe(20)
    expect(summary.filesModified).toBe(20)
    expect(summary.filesSkipped).toBe(0)
    expect(summary.errors).toBe(0)
    expect(summary.results).toHaveLength(20)

    // Verify all files were updated
    for (let i = 0; i < 20; i++) {
      const filePath = path.join(TEST_DIR, `route${i}.get.ts`)
      const content = fs.readFileSync(filePath, 'utf-8')
      expect(content).toContain(`/route${i}`)
      expect(content).not.toContain(`/old${i}`)
    }
  })
})
