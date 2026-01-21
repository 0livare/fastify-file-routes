/**
 * Converts a file path to a URL path following file-based routing conventions.
 *
 * Rules:
 * - Strip src/ prefix but keep api/
 * - Convert $param or .$param to :param (route parameters)
 * - Files/folders starting with _ are pathless (excluded from URL)
 * - index files map to their parent path
 * - Strip HTTP method suffix (.get.ts, .post.js, etc.)
 *
 * @param filePath - The file path relative to project root (e.g., 'src/api/users/$userId.get.ts')
 * @returns The full URL path (e.g., '/api/users/:userId') or null if invalid
 *
 * Example:
 * - File: 'src/api/users/$userId.get.ts'
 * - Returns: '/api/users/:userId'
 */
export function filePathToUrlPath(filePath: string): string | null {
  let path = stripFileExtensions(filePath)
  path = stripSrcPrefix({path, handleTestPaths: true})

  const segments = path.split('/').filter((s) => s.length > 0)
  const urlSegments = processSegments({
    segments,
    clearParentDirsForDotParam: false,
  })

  const urlPath = '/' + urlSegments.join('/')
  return urlPath
}

/**
 * Internal function to strip file extensions and method suffixes from a file path.
 */
function stripFileExtensions(filePath: string): string {
  // Strip .ts or .js extension
  let path = filePath.replace(/\.(ts|js)$/, '')
  // Strip HTTP method suffix (.get, .post, etc.)
  return path.replace(/\.(get|post|put|patch|delete)$/, '')
}

/**
 * Internal function to strip the src/ prefix from a path while keeping api/.
 * Handles both standard relative paths and test fixture paths.
 */
function stripSrcPrefix(args: {
  path: string
  handleTestPaths: boolean
}): string {
  let {path, handleTestPaths = false} = args

  // Handle standard src/api paths - strip 'src/' but keep 'api/'
  if (path.startsWith('src/api/')) {
    return path.substring('src/'.length)
  }
  if (path.startsWith('src/api')) {
    return path.substring('src/'.length)
  }

  // Handle absolute paths - find /api/ and include it
  const apiIndex = path.lastIndexOf('/api/')
  if (apiIndex !== -1) {
    return path.substring(apiIndex + 1) // +1 to skip the leading slash before 'api'
  }

  // Handle test fixture paths - start from api/ directory
  if (handleTestPaths && path.includes('api')) {
    const parts = path.split('/')
    const apiIdx = parts.indexOf('api')
    if (apiIdx !== -1) {
      return parts.slice(apiIdx).join('/')
    }
  }

  return path
}

/**
 * Internal function to convert path segments to URL segments.
 * @param segments - The path segments to process
 * @param clearParentDirsForDotParam - Whether to clear parent directories for name.$param pattern
 */
function processSegments(args: {
  segments: string[]
  clearParentDirsForDotParam: boolean
}): string[] {
  const {segments, clearParentDirsForDotParam} = args

  const urlSegments: string[] = []

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLastSegment = i === segments.length - 1

    // Skip pathless segments (starting with _)
    if (segment.startsWith('_')) {
      continue
    }

    // Handle index files - they map to parent path
    if (isLastSegment && segment === 'index') {
      continue
    }

    // Check if segment contains dots (e.g., users.$userId, foo.bar.baz, zach.foobar.$count)
    if (segment.includes('.')) {
      // When a file has name.$param pattern in a subdirectory,
      // optionally skip all parent directories since autoload handles the directory-based routing
      if (clearParentDirsForDotParam && isLastSegment && segment.includes('.$') && i > 0) {
        urlSegments.length = 0
      }

      // Split by dots and process each part
      const parts = segment.split('.')
      for (const part of parts) {
        if (part.startsWith('$')) {
          // This is a parameter
          urlSegments.push(':' + part.substring(1))
        } else if (part.length > 0) {
          // This is a regular segment
          urlSegments.push(part)
        }
      }
    }
    // Convert route parameters: $userId
    else if (segment.startsWith('$')) {
      urlSegments.push(':' + segment.substring(1))
    } else {
      urlSegments.push(segment)
    }
  }

  return urlSegments
}
