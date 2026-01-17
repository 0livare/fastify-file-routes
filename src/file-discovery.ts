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
 * Recursively discovers all Fastify route files in the src/api directory.
 *
 * Files must:
 * - Have .ts or .js extension
 * - Have valid HTTP method suffix (.get, .post, .put, .patch, .delete)
 * - Be within the src/api directory
 *
 * @param apiDir - Root directory to scan (default: 'src/api')
 * @returns Array of route file metadata
 */
export function discoverRouteFiles(
  apiDir: string = 'src/api',
): RouteFileMetadata[] {
  const results: RouteFileMetadata[] = []

  // Check if directory exists
  if (!fs.existsSync(apiDir)) {
    return results
  }

  // Get absolute path to apiDir for consistent path handling
  const absoluteApiDir = path.resolve(apiDir)

  // Recursively scan directory
  function scanDirectory(dir: string): void {
    const entries = fs.readdirSync(dir, {withFileTypes: true})

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

        // Convert absolute path to relative path from apiDir
        const absolutePath = path.resolve(fullPath)
        const relativePath = path.relative(absoluteApiDir, absolutePath)

        // Create a path that filePathToUrlPath expects (src/api/...)
        const pathForUrlCalculation = path.join('src/api', relativePath)

        // Calculate URL path from file path
        const url = filePathToUrlPath(pathForUrlCalculation)
        if (!url) {
          continue // Skip if URL calculation fails
        }

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
  return results
}
