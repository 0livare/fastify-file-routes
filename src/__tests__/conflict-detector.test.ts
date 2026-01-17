import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest'
import {
  detectAndResolveConflicts,
  type ConflictResolutionResult,
} from '../conflict-detector'
import type {RouteFileMetadata} from '../file-discovery'

describe('detectAndResolveConflicts', () => {
  // Spy on console.warn to verify logging
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    consoleWarnSpy.mockRestore()
  })

  describe('No conflicts', () => {
    it('should return empty conflicts array when no routes', () => {
      const routes: RouteFileMetadata[] = []
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toEqual([])
      expect(result.fileUrlMap.size).toBe(0)
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should return empty conflicts array for single route', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users.get.ts',
          method: 'GET',
          url: '/users',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toEqual([])
      expect(result.fileUrlMap.get('/api/users.get.ts')).toBe('/users')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('should return empty conflicts array for multiple routes with different URLs', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users.get.ts',
          method: 'GET',
          url: '/users',
        },
        {
          filePath: '/api/posts.get.ts',
          method: 'GET',
          url: '/posts',
        },
        {
          filePath: '/api/comments.get.ts',
          method: 'GET',
          url: '/comments',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toEqual([])
      expect(result.fileUrlMap.get('/api/users.get.ts')).toBe('/users')
      expect(result.fileUrlMap.get('/api/posts.get.ts')).toBe('/posts')
      expect(result.fileUrlMap.get('/api/comments.get.ts')).toBe('/comments')
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('Two-way conflicts', () => {
    it('should detect and resolve conflict between two files', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users/$userId.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
        {
          filePath: '/api/users/$id.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toEqual({
        url: '/users/:userId',
        files: ['/api/users/$userId.get.ts', '/api/users/$id.get.ts'],
      })

      // First file keeps original URL
      expect(result.fileUrlMap.get('/api/users/$userId.get.ts')).toBe(
        '/users/:userId',
      )
      // Second file gets -2 suffix
      expect(result.fileUrlMap.get('/api/users/$id.get.ts')).toBe(
        '/users/:userId-2',
      )

      expect(consoleWarnSpy).toHaveBeenCalledTimes(3)
    })

    it('should handle conflicts with root path', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/index.get.ts',
          method: 'GET',
          url: '/',
        },
        {
          filePath: '/api/home.get.ts',
          method: 'GET',
          url: '/',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/index.get.ts')).toBe('/')
      expect(result.fileUrlMap.get('/api/home.get.ts')).toBe('/-2')
    })
  })

  describe('Multi-way conflicts', () => {
    it('should resolve three-way conflict with numeric suffixes', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users/$userId.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
        {
          filePath: '/api/users/$id.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
        {
          filePath: '/api/users/$uid.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0].files).toHaveLength(3)

      // First file keeps original URL
      expect(result.fileUrlMap.get('/api/users/$userId.get.ts')).toBe(
        '/users/:userId',
      )
      // Second file gets -2 suffix
      expect(result.fileUrlMap.get('/api/users/$id.get.ts')).toBe(
        '/users/:userId-2',
      )
      // Third file gets -3 suffix
      expect(result.fileUrlMap.get('/api/users/$uid.get.ts')).toBe(
        '/users/:userId-3',
      )
    })

    it('should resolve four-way conflict', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/a.get.ts', method: 'GET', url: '/test'},
        {filePath: '/api/b.get.ts', method: 'GET', url: '/test'},
        {filePath: '/api/c.get.ts', method: 'GET', url: '/test'},
        {filePath: '/api/d.get.ts', method: 'GET', url: '/test'},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/a.get.ts')).toBe('/test')
      expect(result.fileUrlMap.get('/api/b.get.ts')).toBe('/test-2')
      expect(result.fileUrlMap.get('/api/c.get.ts')).toBe('/test-3')
      expect(result.fileUrlMap.get('/api/d.get.ts')).toBe('/test-4')
    })
  })

  describe('Multiple independent conflicts', () => {
    it('should detect and resolve multiple independent conflicts', () => {
      const routes: RouteFileMetadata[] = [
        // Conflict group 1: /users/:userId
        {
          filePath: '/api/users/$userId.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
        {
          filePath: '/api/users/$id.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
        // Conflict group 2: /posts/:postId
        {
          filePath: '/api/posts/$postId.get.ts',
          method: 'GET',
          url: '/posts/:postId',
        },
        {
          filePath: '/api/posts/$id.get.ts',
          method: 'GET',
          url: '/posts/:postId',
        },
        // No conflict
        {
          filePath: '/api/comments.get.ts',
          method: 'GET',
          url: '/comments',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(2)

      // Verify first conflict group
      const usersConflict = result.conflicts.find(
        (c) => c.url === '/users/:userId',
      )
      expect(usersConflict).toBeDefined()
      expect(usersConflict?.files).toHaveLength(2)

      // Verify second conflict group
      const postsConflict = result.conflicts.find(
        (c) => c.url === '/posts/:postId',
      )
      expect(postsConflict).toBeDefined()
      expect(postsConflict?.files).toHaveLength(2)

      // Verify mappings
      expect(result.fileUrlMap.get('/api/users/$userId.get.ts')).toBe(
        '/users/:userId',
      )
      expect(result.fileUrlMap.get('/api/users/$id.get.ts')).toBe(
        '/users/:userId-2',
      )
      expect(result.fileUrlMap.get('/api/posts/$postId.get.ts')).toBe(
        '/posts/:postId',
      )
      expect(result.fileUrlMap.get('/api/posts/$id.get.ts')).toBe(
        '/posts/:postId-2',
      )
      expect(result.fileUrlMap.get('/api/comments.get.ts')).toBe('/comments')
    })

    it('should handle mix of conflicts and non-conflicts', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/a.get.ts', method: 'GET', url: '/a'},
        {filePath: '/api/b1.get.ts', method: 'GET', url: '/b'},
        {filePath: '/api/b2.get.ts', method: 'GET', url: '/b'},
        {filePath: '/api/c.get.ts', method: 'GET', url: '/c'},
        {filePath: '/api/d1.get.ts', method: 'GET', url: '/d'},
        {filePath: '/api/d2.get.ts', method: 'GET', url: '/d'},
        {filePath: '/api/d3.get.ts', method: 'GET', url: '/d'},
        {filePath: '/api/e.get.ts', method: 'GET', url: '/e'},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(2)
      expect(result.fileUrlMap.size).toBe(8)

      // No conflicts
      expect(result.fileUrlMap.get('/api/a.get.ts')).toBe('/a')
      expect(result.fileUrlMap.get('/api/c.get.ts')).toBe('/c')
      expect(result.fileUrlMap.get('/api/e.get.ts')).toBe('/e')

      // Two-way conflict on /b
      expect(result.fileUrlMap.get('/api/b1.get.ts')).toBe('/b')
      expect(result.fileUrlMap.get('/api/b2.get.ts')).toBe('/b-2')

      // Three-way conflict on /d
      expect(result.fileUrlMap.get('/api/d1.get.ts')).toBe('/d')
      expect(result.fileUrlMap.get('/api/d2.get.ts')).toBe('/d-2')
      expect(result.fileUrlMap.get('/api/d3.get.ts')).toBe('/d-3')
    })
  })

  describe('Complex URL patterns', () => {
    it('should handle conflicts with nested paths', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users/$userId/posts.get.ts',
          method: 'GET',
          url: '/users/:userId/posts',
        },
        {
          filePath: '/api/users/$id/posts.get.ts',
          method: 'GET',
          url: '/users/:userId/posts',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/users/$userId/posts.get.ts')).toBe(
        '/users/:userId/posts',
      )
      expect(result.fileUrlMap.get('/api/users/$id/posts.get.ts')).toBe(
        '/users/:userId/posts-2',
      )
    })

    it('should handle conflicts with multiple parameters', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users/$userId/posts/$postId.get.ts',
          method: 'GET',
          url: '/users/:userId/posts/:postId',
        },
        {
          filePath: '/api/users/$uid/posts/$pid.get.ts',
          method: 'GET',
          url: '/users/:userId/posts/:postId',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(
        result.fileUrlMap.get('/api/users/$userId/posts/$postId.get.ts'),
      ).toBe('/users/:userId/posts/:postId')
      expect(result.fileUrlMap.get('/api/users/$uid/posts/$pid.get.ts')).toBe(
        '/users/:userId/posts/:postId-2',
      )
    })

    it('should handle conflicts with query-like suffixes in URLs', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/search.get.ts',
          method: 'GET',
          url: '/search',
        },
        {
          filePath: '/api/search-results.get.ts',
          method: 'GET',
          url: '/search',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/search.get.ts')).toBe('/search')
      expect(result.fileUrlMap.get('/api/search-results.get.ts')).toBe(
        '/search-2',
      )
    })
  })

  describe('Console logging', () => {
    it('should log warning for each conflict detected', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users/$userId.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
        {
          filePath: '/api/users/$id.get.ts',
          method: 'GET',
          url: '/users/:userId',
        },
      ]
      detectAndResolveConflicts(routes)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '⚠️  Conflict detected: 2 files map to /users/:userId',
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '   → /api/users/$userId.get.ts (kept as /users/:userId)',
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        '   → /api/users/$id.get.ts (renamed to /users/:userId-2)',
      )
    })

    it('should log warnings for multiple conflicts', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/a1.get.ts', method: 'GET', url: '/a'},
        {filePath: '/api/a2.get.ts', method: 'GET', url: '/a'},
        {filePath: '/api/b1.get.ts', method: 'GET', url: '/b'},
        {filePath: '/api/b2.get.ts', method: 'GET', url: '/b'},
      ]
      detectAndResolveConflicts(routes)

      // Should have warnings for both conflicts
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Conflict detected: 2 files map to'),
      )
      expect(consoleWarnSpy.mock.calls.length).toBeGreaterThanOrEqual(6) // 3 per conflict
    })

    it('should not log warnings when no conflicts', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/a.get.ts', method: 'GET', url: '/a'},
        {filePath: '/api/b.get.ts', method: 'GET', url: '/b'},
      ]
      detectAndResolveConflicts(routes)

      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })
  })

  describe('Return value structure', () => {
    it('should return correct structure with fileUrlMap and conflicts', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/test.get.ts', method: 'GET', url: '/test'},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result).toHaveProperty('fileUrlMap')
      expect(result).toHaveProperty('conflicts')
      expect(result.fileUrlMap).toBeInstanceOf(Map)
      expect(Array.isArray(result.conflicts)).toBe(true)
    })

    it('should include all files in fileUrlMap', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/a.get.ts', method: 'GET', url: '/a'},
        {filePath: '/api/b.get.ts', method: 'GET', url: '/b'},
        {filePath: '/api/c1.get.ts', method: 'GET', url: '/c'},
        {filePath: '/api/c2.get.ts', method: 'GET', url: '/c'},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.fileUrlMap.size).toBe(4)
      expect(result.fileUrlMap.has('/api/a.get.ts')).toBe(true)
      expect(result.fileUrlMap.has('/api/b.get.ts')).toBe(true)
      expect(result.fileUrlMap.has('/api/c1.get.ts')).toBe(true)
      expect(result.fileUrlMap.has('/api/c2.get.ts')).toBe(true)
    })

    it('should include correct conflict info', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/x1.get.ts', method: 'GET', url: '/x'},
        {filePath: '/api/x2.get.ts', method: 'GET', url: '/x'},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.conflicts[0]).toHaveProperty('url')
      expect(result.conflicts[0]).toHaveProperty('files')
      expect(result.conflicts[0].url).toBe('/x')
      expect(result.conflicts[0].files).toEqual([
        '/api/x1.get.ts',
        '/api/x2.get.ts',
      ])
    })
  })

  describe('Edge cases', () => {
    it('should handle URLs with hyphens that look like conflict suffixes', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/test-2.get.ts',
          method: 'GET',
          url: '/test-2',
        },
        {
          filePath: '/api/test-2-alt.get.ts',
          method: 'GET',
          url: '/test-2',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/test-2.get.ts')).toBe('/test-2')
      expect(result.fileUrlMap.get('/api/test-2-alt.get.ts')).toBe('/test-2-2')
    })

    it('should preserve order of files in conflict info', () => {
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/first.get.ts', method: 'GET', url: '/test'},
        {filePath: '/api/second.get.ts', method: 'GET', url: '/test'},
        {filePath: '/api/third.get.ts', method: 'GET', url: '/test'},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts[0].files).toEqual([
        '/api/first.get.ts',
        '/api/second.get.ts',
        '/api/third.get.ts',
      ])
    })

    it('should handle very long URLs', () => {
      const longUrl =
        '/very/long/nested/path/with/many/segments/:param1/:param2/:param3'
      const routes: RouteFileMetadata[] = [
        {filePath: '/api/long1.get.ts', method: 'GET', url: longUrl},
        {filePath: '/api/long2.get.ts', method: 'GET', url: longUrl},
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/long1.get.ts')).toBe(longUrl)
      expect(result.fileUrlMap.get('/api/long2.get.ts')).toBe(`${longUrl}-2`)
    })

    it('should handle special characters in file paths', () => {
      const routes: RouteFileMetadata[] = [
        {
          filePath: '/api/users-list.get.ts',
          method: 'GET',
          url: '/users-list',
        },
        {
          filePath: '/api/users_list.get.ts',
          method: 'GET',
          url: '/users-list',
        },
      ]
      const result = detectAndResolveConflicts(routes)

      expect(result.conflicts).toHaveLength(1)
      expect(result.fileUrlMap.get('/api/users-list.get.ts')).toBe(
        '/users-list',
      )
      expect(result.fileUrlMap.get('/api/users_list.get.ts')).toBe(
        '/users-list-2',
      )
    })
  })
})
