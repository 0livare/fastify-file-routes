import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {discoverRouteFiles} from '../file-discovery'

describe('discoverRouteFiles', () => {
  const testDir = path.join(__dirname, '__test-fixtures__', 'file-discovery')

  // Helper to create test file structure
  function createTestStructure(structure: Record<string, string | null>): void {
    for (const [filePath, content] of Object.entries(structure)) {
      const fullPath = path.join(testDir, filePath)
      const dir = path.dirname(fullPath)

      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
      }

      // Create file (content can be null for empty files)
      fs.writeFileSync(fullPath, content ?? '')
    }
  }

  // Helper to clean up test directory
  function cleanupTestDirectory(): void {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true})
    }
  }

  beforeEach(() => {
    cleanupTestDirectory()
  })

  afterEach(() => {
    cleanupTestDirectory()
  })

  describe('Basic Discovery', () => {
    it('should return empty array when directory does not exist', () => {
      const results = discoverRouteFiles(path.join(testDir, 'nonexistent'))
      expect(results).toEqual([])
    })

    it('should return empty array when directory is empty', () => {
      fs.mkdirSync(testDir, {recursive: true})
      const results = discoverRouteFiles(testDir)
      expect(results).toEqual([])
    })

    it('should discover a single route file', () => {
      createTestStructure({
        'users.get.ts': 'export default function() {}',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0]).toMatchObject({
        filePath: path.join(testDir, 'users.get.ts'),
        method: 'GET',
        url: '/users',
      })
    })

    it('should discover multiple route files in same directory', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.post.ts': '',
        'users.delete.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(3)

      const methods = results.map((r) => r.method).sort()
      expect(methods).toEqual(['DELETE', 'GET', 'POST'])
    })
  })

  describe('File Extension Filtering', () => {
    it('should discover .ts files', () => {
      createTestStructure({
        'users.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toContain('.ts')
    })

    it('should discover .js files', () => {
      createTestStructure({
        'users.get.js': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toContain('.js')
    })

    it('should ignore files without .ts or .js extension', () => {
      createTestStructure({
        'users.get.ts': '',
        'readme.md': '',
        'config.json': '',
        'styles.css': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toContain('users.get.ts')
    })
  })

  describe('HTTP Method Filtering', () => {
    it('should discover all supported HTTP methods', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.post.ts': '',
        'users.put.ts': '',
        'users.patch.ts': '',
        'users.delete.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(5)

      const methods = results.map((r) => r.method).sort()
      expect(methods).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
    })

    it('should ignore files without valid HTTP method suffix', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.ts': '', // No method
        'helper.ts': '', // No method
        'utils.ts': '', // No method
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toContain('users.get.ts')
    })

    it('should ignore files with invalid HTTP methods', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.head.ts': '', // HEAD not supported
        'users.options.ts': '', // OPTIONS not supported
        'users.trace.ts': '', // TRACE not supported
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toContain('users.get.ts')
    })
  })

  describe('Recursive Directory Scanning', () => {
    it('should discover files in nested directories', () => {
      createTestStructure({
        'users.get.ts': '',
        'posts/index.get.ts': '',
        'posts/comments.get.ts': '',
        'admin/users.get.ts': '',
        'admin/settings/general.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(5)
    })

    it('should handle deeply nested directory structures', () => {
      createTestStructure({
        'a/b/c/d/e/f.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('/a/b/c/d/e/f')
    })

    it('should handle empty subdirectories', () => {
      createTestStructure({
        'users.get.ts': '',
        'empty/.gitkeep': '', // Empty directory with gitkeep
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
      expect(results[0].filePath).toContain('users.get.ts')
    })
  })

  describe('URL Path Calculation', () => {
    it('should calculate correct URLs for basic paths', () => {
      createTestStructure({
        'users.get.ts': '',
        'posts.get.ts': '',
        'comments.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      const urls = results.map((r) => r.url).sort()
      expect(urls).toEqual(['/comments', '/posts', '/users'])
    })

    it('should calculate correct URLs for nested paths', () => {
      createTestStructure({
        'users/$id.get.ts': '',
        'users/$id/posts.get.ts': '',
        'users/$id/posts/$postId.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      const urls = results.map((r) => r.url).sort()
      expect(urls).toEqual([
        '/users/:id',
        '/users/:id/posts',
        '/users/:id/posts/:postId',
      ])
    })

    it('should handle index files correctly', () => {
      createTestStructure({
        'index.get.ts': '',
        'users/index.get.ts': '',
        'users/$id/index.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      const urls = results.map((r) => r.url).sort()
      expect(urls).toEqual(['/', '/users', '/users/:id'])
    })

    it('should handle pathless layouts (underscore prefix)', () => {
      createTestStructure({
        '_layout/users.get.ts': '',
        'users/_protected/$id.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      const urls = results.map((r) => r.url).sort()
      expect(urls).toEqual(['/users', '/users/:id'])
    })
  })

  describe('Route File Metadata', () => {
    it('should return correct metadata structure', () => {
      createTestStructure({
        'users/$id.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)

      const metadata = results[0]
      expect(metadata).toHaveProperty('filePath')
      expect(metadata).toHaveProperty('method')
      expect(metadata).toHaveProperty('url')
      expect(typeof metadata.filePath).toBe('string')
      expect(typeof metadata.method).toBe('string')
      expect(typeof metadata.url).toBe('string')
    })

    it('should return absolute file paths', () => {
      createTestStructure({
        'users.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results[0].filePath).toBe(path.join(testDir, 'users.get.ts'))
    })

    it('should preserve method case (uppercase)', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.post.ts': '',
        'users.PUT.ts': '', // Mixed case in filename
      })

      const results = discoverRouteFiles(testDir)
      const methods = results.map((r) => r.method)

      // All methods should be uppercase
      expect(methods.every((m) => m === m.toUpperCase())).toBe(true)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle realistic API structure', () => {
      createTestStructure({
        'index.get.ts': '',
        'health.get.ts': '',
        'users/index.get.ts': '',
        'users/index.post.ts': '',
        'users/$id.get.ts': '',
        'users/$id.put.ts': '',
        'users/$id.delete.ts': '',
        'users/$id/posts.get.ts': '',
        'users/$id/posts.post.ts': '',
        'posts/index.get.ts': '',
        'posts/$postId.get.ts': '',
        'posts/$postId/comments.get.ts': '',
        '_auth/login.post.ts': '',
        '_auth/logout.post.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results.length).toBeGreaterThan(0)

      // Verify some key routes
      const urls = results.map((r) => r.url)
      expect(urls).toContain('/')
      expect(urls).toContain('/health')
      expect(urls).toContain('/users')
      expect(urls).toContain('/users/:id')
      expect(urls).toContain('/login') // _auth is pathless
      expect(urls).toContain('/logout')
    })

    it('should handle mixed .ts and .js files', () => {
      createTestStructure({
        'users.get.ts': '',
        'posts.get.js': '',
        'comments.post.ts': '',
        'likes.delete.js': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(4)

      const extensions = results.map((r) => path.extname(r.filePath)).sort()
      expect(extensions.filter((e) => e === '.ts')).toHaveLength(2)
      expect(extensions.filter((e) => e === '.js')).toHaveLength(2)
    })

    it('should handle files with similar names but different methods', () => {
      createTestStructure({
        'users/$id.get.ts': '',
        'users/$id.put.ts': '',
        'users/$id.patch.ts': '',
        'users/$id.delete.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(4)

      // All should map to same URL but different methods
      const urls = new Set(results.map((r) => r.url))
      expect(urls.size).toBe(1)
      expect(urls.has('/users/:id')).toBe(true)

      const methods = results.map((r) => r.method).sort()
      expect(methods).toEqual(['DELETE', 'GET', 'PATCH', 'PUT'])
    })
  })

  describe('Edge Cases', () => {
    it('should handle directory with only non-route files', () => {
      createTestStructure({
        'README.md': '',
        'utils.ts': '',
        'types.ts': '',
        'config.json': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toEqual([])
    })

    it('should handle files with dots in directory names', () => {
      createTestStructure({
        'v1.0/users.get.ts': '',
        'v2.0/users.get.ts': '',
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(2)
      expect(results.map((r) => r.url).sort()).toEqual([
        '/v1.0/users',
        '/v2.0/users',
      ])
    })

    it('should handle files with multiple dots', () => {
      createTestStructure({
        'users.admin.get.ts': '', // Only last .get.ts matters
      })

      const results = discoverRouteFiles(testDir)
      expect(results).toHaveLength(1)
    })
  })
})
