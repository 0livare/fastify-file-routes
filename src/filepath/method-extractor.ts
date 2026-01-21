/**
 * HTTP methods supported by the file-based routing system.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

/**
 * Extracts the HTTP method from a filename suffix.
 *
 * Supported patterns:
 * - .get.ts or .get.js → 'GET'
 * - .post.ts or .post.js → 'POST'
 * - .put.ts or .put.js → 'PUT'
 * - .patch.ts or .patch.js → 'PATCH'
 * - .delete.ts or .delete.js → 'DELETE'
 * - get.ts or get.js → 'GET' (equivalent to index.get.ts)
 * - post.ts or post.js → 'POST' (equivalent to index.post.ts)
 * - put.ts or put.js → 'PUT' (equivalent to index.put.ts)
 * - patch.ts or patch.js → 'PATCH' (equivalent to index.patch.ts)
 * - delete.ts or delete.js → 'DELETE' (equivalent to index.delete.ts)
 *
 * @param filePath - The file path or filename (e.g., 'users.get.ts' or 'src/api/users.post.js')
 * @returns The HTTP method in uppercase, or null if no valid method suffix is found
 */
export function extractHttpMethod(filePath: string): HttpMethod | null {
  // Match .method.ts or .method.js at the end of the string
  const suffixMatch = filePath.match(/\.(get|post|put|patch|delete)\.(ts|js)$/i)

  if (suffixMatch) {
    // Convert to uppercase and return as HttpMethod
    return suffixMatch[1].toUpperCase() as HttpMethod
  }

  // Also match method.ts or method.js as standalone filename (like index.method.ts)
  const standaloneMatch = filePath.match(/\/(get|post|put|patch|delete)\.(ts|js)$/i)

  if (standaloneMatch) {
    return standaloneMatch[1].toUpperCase() as HttpMethod
  }

  return null
}
