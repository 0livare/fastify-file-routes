import {test, expect} from 'vitest'
import {filePathToUrlPath} from '../filepath/path-mapper'

// CLAUDE DO NOT MODIFY THESE TESTS THEY ARE CORRECT
// IF THEY FAIL THE CODE NEEDS TO BE FIXED
test.each([
  // Basic route
  {
    filePath: 'src/api/foo.get.ts',
    url: '/api/foo',
  },
  // Pathless layout segment
  {
    filePath: 'src/api/_bar/foo.put.ts',
    url: '/api/foo',
  },
  // Params as sub-directories
  {
    filePath: 'src/api/users/$userId/posts/$postId.delete.ts',
    url: '/api/users/:userId/posts/:postId',
  },
  {
    filePath: 'src/api/foo/bar/baz.post.ts',
    url: '/api/foo/bar/baz',
  },
  // Params using dot syntax
  {
    filePath: 'src/api/users.$userId/posts.$postId.post.ts',
    url: '/api/users/:userId/posts/:postId',
  },
  {
    filePath: 'src/api/users.$userId.posts.$postId.post.ts',
    url: '/api/users/:userId/posts/:postId',
  },
  {
    filePath: 'src/api/foo.bar.baz.post.ts',
    url: '/api/foo/bar/baz',
  },
  // Index file for parent path
  {
    filePath: 'src/api/foo/index.patch.ts',
    url: '/api/foo',
  },
  {
    filePath: 'src/api/foo/$fooId/index.delete.ts',
    url: '/api/foo/:fooId',
  },
  // Method-only files (same as index files) - both should map to parent path
  {
    filePath: 'src/api/users/put.ts',
    url: '/api/users',
  },
  {
    filePath: 'src/api/users/get.ts',
    url: '/api/users',
  },
  {
    filePath: 'src/api/users/post.ts',
    url: '/api/users',
  },
  {
    filePath: 'src/api/users/patch.ts',
    url: '/api/users',
  },
  {
    filePath: 'src/api/users/delete.ts',
    url: '/api/users',
  },
  {
    filePath: 'src/api/foo/$fooId/put.ts',
    url: '/api/foo/:fooId',
  },
])('filePathToUrlPath($filePath)', (data) => {
  expect(filePathToUrlPath(data.filePath)).toBe(data.url)
})
