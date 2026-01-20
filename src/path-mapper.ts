/**
 * Converts a file path to a URL path following file-based routing conventions.
 *
 * Rules:
 * - Strip src/api prefix
 * - Convert $param or .$param to :param (route parameters)
 * - Files/folders starting with _ are pathless (excluded from URL)
 * - index files map to their parent path
 * - Strip HTTP method suffix (.get.ts, .post.js, etc.)
 *
 * @param filePath - The file path relative to project root (e.g., 'src/api/users/$userId.get.ts')
 * @returns The URL path (e.g., '/users/:userId') or null if invalid
 */
export function filePathToUrlPath(filePath: string): string | null {
  // Strip .ts or .js extension
  let path = filePath.replace(/\.(ts|js)$/, '')

  // Strip HTTP method suffix (.get, .post, etc.)
  path = path.replace(/\.(get|post|put|patch|delete)$/, '')

  // Strip src/api prefix if present
  if (path.startsWith('src/api/')) {
    path = path.substring('src/api'.length)
  } else if (path.startsWith('src/api')) {
    path = path.substring('src/api'.length)
  }

  // Split into segments
  const segments = path.split('/').filter((s) => s.length > 0)

  // Process segments: filter out pathless (_prefix), convert params, handle index
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

    // Check if segment contains .$ pattern (e.g., zach.$zachId)
    const dotParamIndex = segment.indexOf('.$')
    if (dotParamIndex > 0) {
      // When a file has name.$param pattern in a subdirectory,
      // skip all parent directories since autoload handles the directory-based routing
      if (isLastSegment && i > 0) {
        // Clear any previously collected segments for files with .$ pattern in subdirectories
        urlSegments.length = 0
      }
      // Split into prefix and param parts
      const prefix = segment.substring(0, dotParamIndex)
      const param = segment.substring(dotParamIndex + 2)
      urlSegments.push(prefix)
      urlSegments.push(':' + param)
    }
    // Convert route parameters: $userId or .$userId → :userId
    else if (segment.startsWith('$')) {
      urlSegments.push(':' + segment.substring(1))
    } else if (segment.startsWith('.$')) {
      urlSegments.push(':' + segment.substring(2))
    } else {
      urlSegments.push(segment)
    }
  }

  // Build final URL path
  const urlPath = '/' + urlSegments.join('/')

  // Return root as '/' not ''
  return urlPath
}

/**
 * Converts a file path to the full URL path that will be registered with Fastify.
 * This includes the parent directories that autoload will add automatically.
 *
 * For example:
 * - File: 'src/api/examples/foobar.$count.put.ts'
 * - filePathToUrlPath returns: '/foobar/:count' (what goes in the route definition)
 * - filePathToFullUrlPath returns: '/examples/foobar/:count' (the actual full path Fastify will register)
 *
 * @param filePath - The file path relative to project root
 * @returns The full URL path including parent directories
 */
export function filePathToFullUrlPath(filePath: string): string | null {
  // Strip .ts or .js extension
  let path = filePath.replace(/\.(ts|js)$/, '')

  // Strip HTTP method suffix (.get, .post, etc.)
  path = path.replace(/\.(get|post|put|patch|delete)$/, '')

  // Strip src/api prefix if present - handle both absolute and relative paths
  // For paths like: src/api/users.get.ts or /path/to/project/src/api/users.get.ts
  const apiIndex = path.lastIndexOf('/api/')
  if (apiIndex !== -1) {
    // Found '/api/', take everything after it
    path = path.substring(apiIndex + '/api'.length)
  } else if (path.endsWith('/api')) {
    // Path ends with '/api' (edge case)
    path = ''
  } else if (path.startsWith('src/api/')) {
    // Standard relative path
    path = path.substring('src/api'.length)
  } else if (path.startsWith('src/api')) {
    path = path.substring('src/api'.length)
  } else if (!path.includes('/api/')) {
    // No '/api/' in path - assume we should strip leading directory segments
    // This handles test paths like 'src/__tests__/__test-fixtures__/users.get.ts'
    // We want to keep only the filename part for the URL
    const parts = path.split('/')
    // Find where the actual route files start (after src/ or other base dirs)
    let startIndex = 0
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'src' || parts[i].startsWith('__test')) {
        startIndex = i + 1
      }
    }
    if (startIndex > 0 && startIndex < parts.length) {
      path = '/' + parts.slice(startIndex).join('/')
    }
  }

  // Split into segments
  const segments = path.split('/').filter((s) => s.length > 0)

  // Process segments: filter out pathless (_prefix), convert params, handle index
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

    // Check if segment contains .$ pattern (e.g., zach.$zachId)
    const dotParamIndex = segment.indexOf('.$')
    if (dotParamIndex > 0) {
      // For full URL, we DON'T clear parent segments - we keep them all
      // Split into prefix and param parts
      const prefix = segment.substring(0, dotParamIndex)
      const param = segment.substring(dotParamIndex + 2)
      urlSegments.push(prefix)
      urlSegments.push(':' + param)
    }
    // Convert route parameters: $userId or .$userId → :userId
    else if (segment.startsWith('$')) {
      urlSegments.push(':' + segment.substring(1))
    } else if (segment.startsWith('.$')) {
      urlSegments.push(':' + segment.substring(2))
    } else {
      urlSegments.push(segment)
    }
  }

  // Build final URL path
  const urlPath = '/' + urlSegments.join('/')

  // Return root as '/' not ''
  return urlPath
}
