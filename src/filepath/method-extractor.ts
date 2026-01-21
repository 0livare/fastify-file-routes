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
 *
 * @param filePath - The file path or filename (e.g., 'users.get.ts' or 'src/api/users.post.js')
 * @returns The HTTP method in uppercase, or null if no valid method suffix is found
 */
export function extractHttpMethod(filePath: string): HttpMethod | null {
  // Match .method.ts or .method.js at the end of the string
  const match = filePath.match(/\.(get|post|put|patch|delete)\.(ts|js)$/i)

  if (!match) {
    return null
  }

  // Convert to uppercase and return as HttpMethod
  const method = match[1].toUpperCase() as HttpMethod

  return method
}
