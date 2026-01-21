import {describe, it, expect} from 'vitest'
import {extractHttpMethod} from '../filepath/method-extractor'

describe('extractHttpMethod', () => {
  describe('valid HTTP methods with .ts extension', () => {
    it('should extract GET from .get.ts', () => {
      expect(extractHttpMethod('users.get.ts')).toBe('GET')
      expect(extractHttpMethod('src/api/users.get.ts')).toBe('GET')
      expect(extractHttpMethod('/absolute/path/users.get.ts')).toBe('GET')
    })

    it('should extract POST from .post.ts', () => {
      expect(extractHttpMethod('users.post.ts')).toBe('POST')
      expect(extractHttpMethod('src/api/users.post.ts')).toBe('POST')
    })

    it('should extract PUT from .put.ts', () => {
      expect(extractHttpMethod('users.put.ts')).toBe('PUT')
      expect(extractHttpMethod('src/api/users.put.ts')).toBe('PUT')
    })

    it('should extract PATCH from .patch.ts', () => {
      expect(extractHttpMethod('users.patch.ts')).toBe('PATCH')
      expect(extractHttpMethod('src/api/users.patch.ts')).toBe('PATCH')
    })

    it('should extract DELETE from .delete.ts', () => {
      expect(extractHttpMethod('users.delete.ts')).toBe('DELETE')
      expect(extractHttpMethod('src/api/users.delete.ts')).toBe('DELETE')
    })
  })

  describe('valid HTTP methods with .js extension', () => {
    it('should extract GET from .get.js', () => {
      expect(extractHttpMethod('users.get.js')).toBe('GET')
      expect(extractHttpMethod('src/api/users.get.js')).toBe('GET')
    })

    it('should extract POST from .post.js', () => {
      expect(extractHttpMethod('users.post.js')).toBe('POST')
      expect(extractHttpMethod('src/api/users.post.js')).toBe('POST')
    })

    it('should extract PUT from .put.js', () => {
      expect(extractHttpMethod('users.put.js')).toBe('PUT')
      expect(extractHttpMethod('src/api/users.put.js')).toBe('PUT')
    })

    it('should extract PATCH from .patch.js', () => {
      expect(extractHttpMethod('users.patch.js')).toBe('PATCH')
      expect(extractHttpMethod('src/api/users.patch.js')).toBe('PATCH')
    })

    it('should extract DELETE from .delete.js', () => {
      expect(extractHttpMethod('users.delete.js')).toBe('DELETE')
      expect(extractHttpMethod('src/api/users.delete.js')).toBe('DELETE')
    })
  })

  describe('case insensitivity', () => {
    it('should handle uppercase method names', () => {
      expect(extractHttpMethod('users.GET.ts')).toBe('GET')
      expect(extractHttpMethod('users.POST.ts')).toBe('POST')
      expect(extractHttpMethod('users.DELETE.js')).toBe('DELETE')
    })

    it('should handle mixed case method names', () => {
      expect(extractHttpMethod('users.GeT.ts')).toBe('GET')
      expect(extractHttpMethod('users.PoSt.ts')).toBe('POST')
      expect(extractHttpMethod('users.DeLeTe.js')).toBe('DELETE')
    })
  })

  describe('complex file paths', () => {
    it('should extract method from deeply nested paths', () => {
      expect(extractHttpMethod('src/api/v1/users/$userId/profile.get.ts')).toBe(
        'GET',
      )
      expect(extractHttpMethod('src/api/admin/_auth/users/$id.delete.ts')).toBe(
        'DELETE',
      )
    })

    it('should extract method from paths with route parameters', () => {
      expect(extractHttpMethod('src/api/users/$userId.get.ts')).toBe('GET')
      expect(extractHttpMethod('src/api/posts/.$postId.patch.js')).toBe('PATCH')
    })

    it('should extract method from index files', () => {
      expect(extractHttpMethod('src/api/users/index.get.ts')).toBe('GET')
      expect(extractHttpMethod('src/api/posts/index.post.js')).toBe('POST')
    })

    it('should extract method from pathless layout files', () => {
      expect(extractHttpMethod('src/api/_auth/login.post.ts')).toBe('POST')
      expect(extractHttpMethod('src/api/_internal/health.get.js')).toBe('GET')
    })
  })

  describe('invalid inputs', () => {
    it('should return null for files without method suffix', () => {
      expect(extractHttpMethod('users.ts')).toBe(null)
      expect(extractHttpMethod('users.js')).toBe(null)
      expect(extractHttpMethod('src/api/users.ts')).toBe(null)
    })

    it('should return null for unsupported HTTP methods', () => {
      expect(extractHttpMethod('users.head.ts')).toBe(null)
      expect(extractHttpMethod('users.options.ts')).toBe(null)
      expect(extractHttpMethod('users.trace.js')).toBe(null)
    })

    it('should return null for files without .ts or .js extension', () => {
      expect(extractHttpMethod('users.get.tsx')).toBe(null)
      expect(extractHttpMethod('users.get.jsx')).toBe(null)
      expect(extractHttpMethod('users.get.txt')).toBe(null)
      expect(extractHttpMethod('users.get')).toBe(null)
    })

    it('should return null for method suffix not at the end', () => {
      expect(extractHttpMethod('users.get.ts.backup')).toBe(null)
      expect(extractHttpMethod('users.post.js.tmp')).toBe(null)
    })

    it('should return null for empty string', () => {
      expect(extractHttpMethod('')).toBe(null)
    })

    it('should return null for files with only extension', () => {
      expect(extractHttpMethod('.ts')).toBe(null)
      expect(extractHttpMethod('.get')).toBe(null)
    })
  })

  describe('edge cases', () => {
    it('should handle filenames with multiple dots', () => {
      expect(extractHttpMethod('user.profile.get.ts')).toBe('GET')
      expect(extractHttpMethod('api.v1.users.post.js')).toBe('POST')
    })

    it('should handle filenames with method name in other parts', () => {
      // Should only match the suffix, not "get" in "target"
      expect(extractHttpMethod('target.post.ts')).toBe('POST')
      expect(extractHttpMethod('delete-user.get.js')).toBe('GET')
    })

    it('should handle Windows-style paths', () => {
      expect(extractHttpMethod('C:\\src\\api\\users.get.ts')).toBe('GET')
      expect(extractHttpMethod('C:\\Users\\admin\\project\\api.post.js')).toBe(
        'POST',
      )
    })

    it('should handle paths with spaces', () => {
      expect(extractHttpMethod('src/api path/users.get.ts')).toBe('GET')
      expect(extractHttpMethod('my project/api/users.post.js')).toBe('POST')
    })
  })
})
