import {describe, it, expect} from 'vitest'
import {filePathToUrlPath} from '../path-mapper'

describe('filePathToUrlPath', () => {
  describe('basic path conversion', () => {
    it('converts simple file path to URL path', () => {
      expect(filePathToUrlPath('src/api/users.get.ts')).toBe('/users')
    })

    it('converts nested file path to URL path', () => {
      expect(filePathToUrlPath('src/api/users/profile.get.ts')).toBe(
        '/users/profile',
      )
    })

    it('handles deeply nested paths', () => {
      expect(
        filePathToUrlPath('src/api/admin/users/settings/profile.get.ts'),
      ).toBe('/admin/users/settings/profile')
    })

    it('handles root index file', () => {
      expect(filePathToUrlPath('src/api/index.get.ts')).toBe('/')
    })
  })

  describe('route parameters with $ syntax', () => {
    it('converts $userId to :userId', () => {
      expect(filePathToUrlPath('src/api/users/$userId.get.ts')).toBe(
        '/users/:userId',
      )
    })

    it('converts multiple parameters', () => {
      expect(
        filePathToUrlPath('src/api/users/$userId/posts/$postId.get.ts'),
      ).toBe('/users/:userId/posts/:postId')
    })

    it('handles folder names with $ prefix', () => {
      expect(filePathToUrlPath('src/api/$companyId/users.get.ts')).toBe(
        '/:companyId/users',
      )
    })
  })

  describe('route parameters with .$ syntax', () => {
    it('converts .$userId to :userId', () => {
      expect(filePathToUrlPath('src/api/users/.$userId.get.ts')).toBe(
        '/users/:userId',
      )
    })

    it('converts multiple .$ parameters', () => {
      expect(
        filePathToUrlPath('src/api/users/.$userId/posts/.$postId.get.ts'),
      ).toBe('/users/:userId/posts/:postId')
    })

    it('handles mixed $ and .$ syntax', () => {
      expect(
        filePathToUrlPath('src/api/$companyId/users/.$userId.get.ts'),
      ).toBe('/:companyId/users/:userId')
    })

    it('converts name.$paramId to name/:paramId (e.g., zach.$zachId)', () => {
      expect(filePathToUrlPath('src/api/zach.$zachId.put.ts')).toBe(
        '/zach/:zachId',
      )
    })

    it('handles multiple segments with name.$param pattern', () => {
      expect(filePathToUrlPath('src/api/users/profile.$userId.get.ts')).toBe(
        '/profile/:userId',
      )
    })

    it('excludes parent directory for name.$param files in subdirectories (bug fix)', () => {
      expect(filePathToUrlPath('src/api/examples/foobar.$count.get.ts')).toBe(
        '/foobar/:count',
      )
    })

    it('excludes parent directory for name.$param in deeply nested paths', () => {
      expect(filePathToUrlPath('src/api/v1/admin/item.$itemId.get.ts')).toBe(
        '/item/:itemId',
      )
    })

    it('excludes multiple parent directories for name.$param files', () => {
      expect(
        filePathToUrlPath('src/api/org/team/member.$memberId.post.ts'),
      ).toBe('/member/:memberId')
    })

    it('handles name.$param with pathless parent directories', () => {
      expect(
        filePathToUrlPath('src/api/_layout/products/item.$productId.get.ts'),
      ).toBe('/item/:productId')
    })
  })

  describe('index files', () => {
    it('maps index.get.ts to parent path', () => {
      expect(filePathToUrlPath('src/api/users/index.get.ts')).toBe('/users')
    })

    it('handles nested index files', () => {
      expect(filePathToUrlPath('src/api/users/posts/index.get.ts')).toBe(
        '/users/posts',
      )
    })

    it('handles index with parameters', () => {
      expect(filePathToUrlPath('src/api/users/$userId/index.get.ts')).toBe(
        '/users/:userId',
      )
    })
  })

  describe('pathless layouts (underscore prefix)', () => {
    it('excludes folder starting with _', () => {
      expect(filePathToUrlPath('src/api/_layout/users.get.ts')).toBe('/users')
    })

    it('excludes file starting with _', () => {
      expect(filePathToUrlPath('src/api/users/_helper.get.ts')).toBe('/users')
    })

    it('excludes multiple pathless segments', () => {
      expect(filePathToUrlPath('src/api/_auth/_layout/users.get.ts')).toBe(
        '/users',
      )
    })

    it('handles pathless with parameters', () => {
      expect(filePathToUrlPath('src/api/_layout/users/$userId.get.ts')).toBe(
        '/users/:userId',
      )
    })

    it('handles pathless between regular segments', () => {
      expect(
        filePathToUrlPath('src/api/admin/_layout/users/profile.get.ts'),
      ).toBe('/admin/users/profile')
    })
  })

  describe('HTTP method suffixes', () => {
    it('strips .get.ts suffix', () => {
      expect(filePathToUrlPath('src/api/users.get.ts')).toBe('/users')
    })

    it('strips .post.ts suffix', () => {
      expect(filePathToUrlPath('src/api/users.post.ts')).toBe('/users')
    })

    it('strips .put.ts suffix', () => {
      expect(filePathToUrlPath('src/api/users.put.ts')).toBe('/users')
    })

    it('strips .patch.ts suffix', () => {
      expect(filePathToUrlPath('src/api/users.patch.ts')).toBe('/users')
    })

    it('strips .delete.ts suffix', () => {
      expect(filePathToUrlPath('src/api/users.delete.ts')).toBe('/users')
    })

    it('strips .get.js suffix', () => {
      expect(filePathToUrlPath('src/api/users.get.js')).toBe('/users')
    })

    it('strips .post.js suffix', () => {
      expect(filePathToUrlPath('src/api/users.post.js')).toBe('/users')
    })
  })

  describe('complex scenarios', () => {
    it('handles all features together: params, index, pathless', () => {
      expect(
        filePathToUrlPath('src/api/_auth/users/$userId/index.get.ts'),
      ).toBe('/users/:userId')
    })

    it('handles .$ params with pathless and index', () => {
      expect(
        filePathToUrlPath('src/api/_layout/users/.$userId/index.post.ts'),
      ).toBe('/users/:userId')
    })

    it('handles complex nested structure', () => {
      expect(
        filePathToUrlPath(
          'src/api/v1/_auth/companies/$companyId/users/.$userId/posts/$postId.get.ts',
        ),
      ).toBe('/v1/companies/:companyId/users/:userId/posts/:postId')
    })
  })

  describe('edge cases', () => {
    it('handles path without src/api prefix', () => {
      expect(filePathToUrlPath('users.get.ts')).toBe('/users')
    })

    it('handles empty segments gracefully', () => {
      expect(filePathToUrlPath('src/api//users.get.ts')).toBe('/users')
    })

    it('handles all pathless segments resulting in root', () => {
      expect(filePathToUrlPath('src/api/_layout/_auth/index.get.ts')).toBe('/')
    })
  })
})
