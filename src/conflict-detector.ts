import * as path from 'path'
import type {RouteFileMetadata} from './file-discovery'

/**
 * Route information for synchronization
 */
export interface RouteInfo {
  url: string
  method: string
}

/**
 * Result of conflict detection with resolved unique URLs
 */
export interface ConflictResolutionResult {
  /** Map of file path to its final unique URL */
  fileUrlMap: Map<string, string>
  /** Map of file path to route info (url and method) */
  fileRouteMap: Map<string, RouteInfo>
  /** Array of conflicts that were detected and resolved */
  conflicts: ConflictInfo[]
}

/**
 * Information about a detected conflict
 */
export interface ConflictInfo {
  /** The URL that had conflicts */
  url: string
  /** File paths that conflicted on this URL */
  files: string[]
}

/**
 * Normalizes a URL by replacing all parameter names with a generic :param
 * This allows /users/:id and /users/:userId to be treated as the same URL for conflict detection
 */
function normalizeUrlForConflictDetection(url: string): string {
  return url.replace(/:[^/]+/g, ':param')
}

/**
 * Adds a numeric suffix to a URL by modifying the last non-parameter segment
 * Examples:
 * - /users/:id → /users-2/:id
 * - /api/products/:productId/reviews → /api/products/:productId/reviews-2
 * - /api/items → /api/items-2
 */
function addSuffixToUrl(url: string, suffix: number): string {
  const segments = url.split('/')

  // Find the last segment that is NOT a parameter (doesn't start with :)
  for (let i = segments.length - 1; i >= 0; i--) {
    if (segments[i] && !segments[i].startsWith(':')) {
      segments[i] = `${segments[i]}-${suffix}`
      return segments.join('/')
    }
  }

  // Fallback: if all segments are parameters (unlikely), append to the end
  return `${url}-${suffix}`
}

/**
 * Detects when multiple files would map to the same URL and resolves conflicts
 * by generating unique URLs with numeric suffixes.
 *
 * When conflicts are detected:
 * - First file keeps the original URL
 * - Second file gets URL with "-2" suffix
 * - Third file gets URL with "-3" suffix
 * - And so on...
 *
 * For conflict detection, parameter names are normalized so that /users/:id
 * and /users/:userId are treated as the same URL. Only URL structure + HTTP method matter.
 *
 * Example:
 * - /users/:id (first file)
 * - /users/:id-2 (second file)
 * - /users/:id-3 (third file)
 *
 * @param routes - Array of route file metadata from file discovery
 * @returns Object with file-to-URL mapping and detected conflicts
 */
export function detectAndResolveConflicts(
  routes: RouteFileMetadata[],
): ConflictResolutionResult {
  const fileUrlMap = new Map<string, string>()
  const fileRouteMap = new Map<string, RouteInfo>()
  const conflicts: ConflictInfo[] = []

  // Create a map to look up routes by file path
  const routesByFile = new Map<string, RouteFileMetadata>()
  for (const route of routes) {
    routesByFile.set(route.filePath, route)
  }

  // Group files by their normalized URL + method combination
  // Different methods on the same URL are NOT conflicts (e.g., GET /users vs PATCH /users)
  // Parameter names are normalized (/:id and /:userId are treated as same)
  const urlMethodToFiles = new Map<string, string[]>()
  for (const route of routes) {
    const normalizedUrl = normalizeUrlForConflictDetection(route.url)
    const key = `${normalizedUrl}::${route.method}`
    const existing = urlMethodToFiles.get(key) || []
    existing.push(route.filePath)
    urlMethodToFiles.set(key, existing)
  }

  // Process each normalized URL+method group
  for (const [key, files] of urlMethodToFiles.entries()) {
    if (files.length === 1) {
      // No conflict - single file for this URL
      const filePath = files[0]
      const route = routesByFile.get(filePath)!
      fileUrlMap.set(filePath, route.url)
      fileRouteMap.set(filePath, {url: route.url, method: route.method})
    } else {
      // Conflict detected - multiple files map to same normalized URL+method
      // Use the first file's URL as the base for conflict messages
      const firstRoute = routesByFile.get(files[0])!
      conflicts.push({
        url: firstRoute.url,
        files: [...files],
      })

      // Resolve by appending numeric suffixes
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i]
        const route = routesByFile.get(filePath)!
        const relativePath = path.relative(process.cwd(), filePath)

        if (i === 0) {
          // First file keeps original URL
          fileUrlMap.set(filePath, route.url)
          fileRouteMap.set(filePath, {url: route.url, method: route.method})
          console.warn(
            `⚠️  Conflict detected: ${files.length} files map to ${route.url}`,
          )
          console.warn(`   → ${relativePath} (kept as ${route.url})`)
        } else {
          // Subsequent files get numeric suffix on the last non-parameter segment
          const uniqueUrl = addSuffixToUrl(route.url, i + 1)
          fileUrlMap.set(filePath, uniqueUrl)
          fileRouteMap.set(filePath, {url: uniqueUrl, method: route.method})
          console.warn(`   → ${relativePath} (renamed to ${uniqueUrl})`)
        }
      }
    }
  }

  return {
    fileUrlMap,
    fileRouteMap,
    conflicts,
  }
}
