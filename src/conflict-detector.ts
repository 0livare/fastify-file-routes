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
 * Detects when multiple files would map to the same URL and resolves conflicts
 * by generating unique URLs with numeric suffixes.
 *
 * When conflicts are detected:
 * - First file keeps the original URL
 * - Second file gets URL with "-2" suffix
 * - Third file gets URL with "-3" suffix
 * - And so on...
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

  // Group files by their calculated URL
  const urlToFiles = new Map<string, string[]>()
  for (const route of routes) {
    const existing = urlToFiles.get(route.url) || []
    existing.push(route.filePath)
    urlToFiles.set(route.url, existing)
  }

  // Process each URL group
  for (const [url, files] of urlToFiles.entries()) {
    if (files.length === 1) {
      // No conflict - single file for this URL
      const filePath = files[0]
      const route = routesByFile.get(filePath)!
      fileUrlMap.set(filePath, url)
      fileRouteMap.set(filePath, {url, method: route.method})
    } else {
      // Conflict detected - multiple files map to same URL
      conflicts.push({
        url,
        files: [...files],
      })

      // Resolve by appending numeric suffixes
      for (let i = 0; i < files.length; i++) {
        const filePath = files[i]
        const route = routesByFile.get(filePath)!
        if (i === 0) {
          // First file keeps original URL
          fileUrlMap.set(filePath, url)
          fileRouteMap.set(filePath, {url, method: route.method})
          console.warn(
            `⚠️  Conflict detected: ${files.length} files map to ${url}`,
          )
          console.warn(`   → ${filePath} (kept as ${url})`)
        } else {
          // Subsequent files get numeric suffix
          const uniqueUrl = `${url}-${i + 1}`
          fileUrlMap.set(filePath, uniqueUrl)
          fileRouteMap.set(filePath, {url: uniqueUrl, method: route.method})
          console.warn(`   → ${filePath} (renamed to ${uniqueUrl})`)
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
