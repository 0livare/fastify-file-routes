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
 * @returns The URL path (e.g., '/api/users/:userId') or null if invalid
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

    // Convert route parameters: $userId or .$userId → :userId
    if (segment.startsWith('$')) {
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
