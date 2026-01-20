import * as fs from 'fs'
import * as path from 'path'
import {extractHttpMethod, type HttpMethod} from './method-extractor'
import {filePathToUrlPath} from './path-mapper'

/**
 * Metadata about a discovered route file
 */
export interface RouteFileMetadata {
  /** Absolute path to the file */
  filePath: string
  /** HTTP method extracted from filename (GET, POST, etc.) */
  method: HttpMethod
  /** Calculated URL path based on file location */
  url: string
}

/**
 * Information about an invalid route file
 */
export interface InvalidRouteFile {
  /** Absolute path to the invalid file */
  filePath: string
  /** Reason why the file is invalid */
  reason: string
}

/**
 * Result of route file discovery
 */
export interface DiscoveryResult {
  /** Valid route files that were discovered */
  routes: RouteFileMetadata[]
  /** Invalid route files that should be flagged */
  invalidFiles: InvalidRouteFile[]
}

/**
 * Recursively discovers all Fastify route files in the src/api directory.
 *
 * Files must:
 * - Have .ts or .js extension
 * - Have valid HTTP method suffix (.get, .post, .put, .patch, .delete)
 * - Be within the src/api directory
 *
 * Special handling (per Fastify autoload):
 * - When index.ts or index.js (without method suffix) exists, all sibling files are ignored
 * - index.get.ts, index.post.ts, etc. are treated as normal route files
 * - Subdirectories are still processed normally
 * - Sibling files in directories with index.ts/index.js are flagged as invalid
 *
 * @param apiDir - Root directory to scan (default: 'src/api')
 * @returns DiscoveryResult with valid routes and invalid files
 */
export function discoverRouteFiles(
  apiDir: string = 'src/api',
): DiscoveryResult {
  const results: RouteFileMetadata[] = []
  const invalidFiles: InvalidRouteFile[] = []

  // Check if directory exists
  if (!fs.existsSync(apiDir)) {
    return {routes: results, invalidFiles}
  }

  // Get absolute path to apiDir for consistent path handling
  const absoluteApiDir = path.resolve(apiDir)

  // Recursively scan directory
  function scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, {withFileTypes: true})

    // Check if this directory has an index file (index.ts or index.js without method suffix)
    // Per Fastify autoload: only index.ts/index.js (not index.get.ts) cause siblings to be ignored
    const hasIndexFile = entries.some(
      (entry) =>
        entry.isFile() &&
        (entry.name === 'index.ts' || entry.name === 'index.js'),
    )

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        scanDirectory(fullPath)
      } else if (entry.isFile()) {
        // Check if file has valid extension (.ts or .js)
        if (!fullPath.endsWith('.ts') && !fullPath.endsWith('.js')) {
          continue
        }

        // Extract HTTP method from filename
        const method = extractHttpMethod(fullPath)
        if (!method) {
          continue // Skip files without valid method suffix
        }

        // If this directory has an index file (index.ts/index.js), ignore all other sibling files
        // (but still process the index file itself)
        const isIndexFile =
          entry.name === 'index.ts' || entry.name === 'index.js'

        if (hasIndexFile && !isIndexFile) {
          // This file is invalid - it's a sibling of an index file
          invalidFiles.push({
            filePath: fullPath,
            reason: `Sibling routes are not allowed when an index file (index.ts or index.js) exists in the same directory. This file will be ignored by Fastify autoload.`,
          })
          continue
        }

        // Convert absolute path to relative path from apiDir
        const absolutePath = path.resolve(fullPath)
        const relativePath = path.relative(absoluteApiDir, absolutePath)

        // Create a path that filePathToUrlPath expects (src/api/...)
        const pathForUrlCalculation = path.join('src/api', relativePath)

        // Calculate URL path from file path
        const url = filePathToUrlPath(pathForUrlCalculation)
        if (!url) continue // Skip if URL calculation fails

        // Add to results
        results.push({
          filePath: fullPath,
          method,
          url,
        })
      }
    }
  }

  scanDirectory(apiDir)
  return {routes: results, invalidFiles}
}
