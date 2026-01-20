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
    it('should return empty result when directory does not exist', () => {
      const {routes, invalidFiles} = discoverRouteFiles(
        path.join(testDir, 'nonexistent'),
      )
      expect(routes).toEqual([])
      expect(invalidFiles).toEqual([])
    })

    it('should return empty result when directory is empty', () => {
      fs.mkdirSync(testDir, {recursive: true})
      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toEqual([])
      expect(invalidFiles).toEqual([])
    })

    it('should discover a single route file', () => {
      createTestStructure({
        'users.get.ts': 'export default function() {}',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(invalidFiles).toHaveLength(0)
      expect(routes[0]).toMatchObject({
        filePath: path.join(testDir, 'users.get.ts'),
        method: 'GET',
        url: '/api/users',
      })
    })

    it('should discover multiple route files in same directory', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.post.ts': '',
        'users.delete.ts': '',
      })

      const {routes} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(3)

      const methods = routes.map((r) => r.method).sort()
      expect(methods).toEqual(['DELETE', 'GET', 'POST'])
    })
  })

  describe('File Extension Filtering', () => {
    it('should discover .ts files', () => {
      createTestStructure({
        'users.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].filePath).toContain('.ts')
    })

    it('should discover .js files', () => {
      createTestStructure({
        'users.get.js': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].filePath).toContain('.js')
    })

    it('should ignore files without .ts or .js extension', () => {
      createTestStructure({
        'users.get.ts': '',
        'readme.md': '',
        'config.json': '',
        'styles.css': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].filePath).toContain('users.get.ts')
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

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(5)

      const methods = routes.map((r) => r.method).sort()
      expect(methods).toEqual(['DELETE', 'GET', 'PATCH', 'POST', 'PUT'])
    })

    it('should ignore files without valid HTTP method suffix', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.ts': '', // No method
        'helper.ts': '', // No method
        'utils.ts': '', // No method
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].filePath).toContain('users.get.ts')
    })

    it('should ignore files with invalid HTTP methods', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.head.ts': '', // HEAD not supported
        'users.options.ts': '', // OPTIONS not supported
        'users.trace.ts': '', // TRACE not supported
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].filePath).toContain('users.get.ts')
    })
  })

  describe('Recursive Directory Scanning', () => {
    it('should discover files in nested directories', () => {
      createTestStructure({
        'users.get.ts': '',
        'posts/index.get.ts': '',
        'posts/comments.get.ts': '', // Valid - index.get.ts doesn't block siblings
        'admin/users.get.ts': '',
        'admin/settings/general.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(5) // All files are valid
    })

    it('should handle deeply nested directory structures', () => {
      createTestStructure({
        'a/b/c/d/e/f.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].url).toBe('/api/a/b/c/d/e/f')
    })

    it('should handle empty subdirectories', () => {
      createTestStructure({
        'users.get.ts': '',
        'empty/.gitkeep': '', // Empty directory with gitkeep
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
      expect(routes[0].filePath).toContain('users.get.ts')
    })
  })

  describe('URL Path Calculation', () => {
    it('should calculate correct URLs for basic paths', () => {
      createTestStructure({
        'users.get.ts': '',
        'posts.get.ts': '',
        'comments.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api/comments', '/api/posts', '/api/users'])
    })

    it('should calculate correct URLs for nested paths', () => {
      createTestStructure({
        'users/$id.get.ts': '',
        'users/$id/posts.get.ts': '',
        'users/$id/posts/$postId.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual([
        '/api/users/:id',
        '/api/users/:id/posts',
        '/api/users/:id/posts/:postId',
      ])
    })

    it('should handle index files correctly', () => {
      createTestStructure({
        'index.get.ts': '',
        'users/index.get.ts': '',
        'users/$id/index.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api', '/api/users', '/api/users/:id'])
    })

    it('should handle pathless layouts (underscore prefix)', () => {
      createTestStructure({
        '_layout/users.get.ts': '',
        'users/_protected/$id.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api/users', '/api/users/:id'])
    })
  })

  describe('Route File Metadata', () => {
    it('should return correct metadata structure', () => {
      createTestStructure({
        'users/$id.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)

      const metadata = routes[0]
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

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes[0].filePath).toBe(path.join(testDir, 'users.get.ts'))
    })

    it('should preserve method case (uppercase)', () => {
      createTestStructure({
        'users.get.ts': '',
        'users.post.ts': '',
        'users.PUT.ts': '', // Mixed case in filename
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      const methods = routes.map((r) => r.method)

      // All methods should be uppercase
      expect(methods.every((m) => m === m.toUpperCase())).toBe(true)
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle realistic API structure', () => {
      createTestStructure({
        'index.get.ts': '',
        'health.get.ts': '', // Valid - index.get.ts doesn't block siblings
        'users/index.get.ts': '',
        'users/index.post.ts': '',
        'users/$id.get.ts': '', // Valid - index.get.ts doesn't block siblings
        'users/$id.put.ts': '',
        'users/$id.delete.ts': '',
        'users/$id/posts.get.ts': '',
        'users/$id/posts.post.ts': '',
        'posts/index.get.ts': '',
        'posts/$postId.get.ts': '', // Valid - index.get.ts doesn't block siblings
        'posts/$postId/comments.get.ts': '',
        '_auth/login.post.ts': '',
        '_auth/logout.post.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes.length).toBeGreaterThan(0)

      // Verify some key routes
      const urls = routes.map((r) => r.url)
      expect(urls).toContain('/api')
      expect(urls).toContain('/api/health')
      expect(urls).toContain('/api/users')
      expect(urls).toContain('/api/users/:id') // Valid now
      expect(urls).toContain('/api/users/:id/posts')
      expect(urls).toContain('/api/login') // _auth is pathless
      expect(urls).toContain('/api/logout')
    })

    it('should handle mixed .ts and .js files', () => {
      createTestStructure({
        'users.get.ts': '',
        'posts.get.js': '',
        'comments.post.ts': '',
        'likes.delete.js': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(4)

      const extensions = routes.map((r) => path.extname(r.filePath)).sort()
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

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(4)

      // All should map to same URL but different methods
      const urls = new Set(routes.map((r) => r.url))
      expect(urls.size).toBe(1)
      expect(urls.has('/api/users/:id')).toBe(true)

      const methods = routes.map((r) => r.method).sort()
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

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toEqual([])
    })

    it('should handle files with multiple dots', () => {
      createTestStructure({
        'users.admin.get.ts': '', // Only last .get.ts matters
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)
    })
  })

  describe('index file behavior (Fastify autoload)', () => {
    it('should ignore sibling route files when index.ts exists', () => {
      createTestStructure({
        'docs/index.ts': '// plugin file',
        'docs/about.get.ts': '',
        'docs/faq.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(0) // index.ts is not a route file
      expect(invalidFiles).toHaveLength(2) // about and faq are invalid
    })

    it('should allow index.get.ts to coexist with other route files', () => {
      createTestStructure({
        'docs/index.get.ts': '',
        'docs/about.get.ts': '',
        'docs/faq.post.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(3) // All are valid
      expect(invalidFiles).toHaveLength(0)
    })

    it('should allow subdirectories to have routes when parent has index.ts', () => {
      createTestStructure({
        'docs/index.ts': '// plugin',
        'docs/about.get.ts': '', // Should be ignored
        'docs/api/users.get.ts': '', // Should be discovered
        'docs/api/posts.get.ts': '', // Should be discovered
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(2) // Only subdirectory files

      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api/docs/api/posts', '/api/docs/api/users'])
      expect(invalidFiles).toHaveLength(1) // about.get.ts is invalid
    })

    it('should handle nested index.ts files independently', () => {
      createTestStructure({
        'docs/index.ts': '// plugin',
        'docs/guide/index.ts': '// plugin',
        'docs/about.get.ts': '', // Ignored (sibling of docs/index.ts)
        'docs/guide/intro.get.ts': '', // Ignored (sibling of docs/guide/index.ts)
        'docs/api/users.get.ts': '', // Discovered (subdirectory of docs)
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1) // Only api/users

      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api/docs/api/users'])
      expect(invalidFiles).toHaveLength(2) // about and intro
    })

    it('should not affect directories without index.ts', () => {
      createTestStructure({
        'docs/index.ts': '// plugin',
        'docs/about.get.ts': '', // Ignored
        'api/users.get.ts': '', // Discovered (no index.ts in api/)
        'api/posts.get.ts': '', // Discovered
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(2) // Only api files

      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api/api/posts', '/api/api/users'])
      expect(invalidFiles).toHaveLength(1) // about
    })

    it('should work with index.js files', () => {
      createTestStructure({
        'docs/index.js': '// plugin',
        'docs/about.get.js': '', // Should be ignored
        'docs/api/users.get.js': '', // Should be discovered
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1)

      const urls = routes.map((r) => r.url).sort()
      expect(urls).toEqual(['/api/docs/api/users'])
      expect(invalidFiles).toHaveLength(1)
    })

    it('should report invalid sibling files when index.ts exists', () => {
      createTestStructure({
        'docs/index.ts': '// plugin',
        'docs/about.get.ts': '', // Invalid
        'docs/faq.get.ts': '', // Invalid
        'docs/api/users.get.ts': '', // Valid (subdirectory)
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1) // Only api/users
      expect(invalidFiles).toHaveLength(2) // about and faq

      const invalidPaths = invalidFiles.map((f) => path.basename(f.filePath))
      expect(invalidPaths).toContain('about.get.ts')
      expect(invalidPaths).toContain('faq.get.ts')

      // Check that all invalid files have a reason
      invalidFiles.forEach((invalid) => {
        expect(invalid.reason).toContain('Sibling routes are not allowed')
        expect(invalid.reason).toContain('index file')
        expect(invalid.reason).toContain('Fastify autoload')
      })
    })

    it('should not treat index.get.ts/index.post.ts as special', () => {
      createTestStructure({
        'docs/index.get.ts': '',
        'docs/index.post.ts': '',
        'docs/about.get.ts': '',
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(3) // All three are valid route files
      expect(invalidFiles).toHaveLength(0)
    })

    it('should report invalid files in multiple directories independently', () => {
      createTestStructure({
        'docs/index.ts': '// plugin',
        'docs/about.get.ts': '', // Invalid
        'api/users.get.ts': '', // Valid (no index.ts in api/)
        'blog/index.ts': '// plugin',
        'blog/post1.get.ts': '', // Invalid
        'blog/post2.get.ts': '', // Invalid
      })

      const {routes, invalidFiles} = discoverRouteFiles(testDir)
      expect(routes).toHaveLength(1) // Only api/users
      expect(invalidFiles).toHaveLength(3) // docs/about, blog/post1, blog/post2
    })
  })
})
