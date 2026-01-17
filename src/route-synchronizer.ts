import * as fs from 'fs'
import * as path from 'path'
import {parseRouteFile} from './ast-parser'
import {modifyRouteUrl} from './ast-modifier'

export interface SyncResult {
  filePath: string
  oldUrl: string | null
  newUrl: string
  modified: boolean
  error?: string
}

export interface SyncSummary {
  totalFiles: number
  filesModified: number
  filesSkipped: number
  errors: number
  results: SyncResult[]
}

/**
 * Synchronizes a single route file by comparing its actual URL with the expected URL.
 * If they differ, updates the file using AST modification.
 *
 * @param filePath - Absolute path to the route file
 * @param expectedUrl - The expected URL based on file path conventions
 * @returns SyncResult with details about the synchronization
 */
export function synchronizeRouteFile(
  filePath: string,
  expectedUrl: string,
): SyncResult {
  try {
    // Read the file content
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Parse the file to extract current URL
    const routeConfig = parseRouteFile(fileContent)
    const currentUrl = routeConfig.url

    // Check if URLs match
    if (currentUrl === expectedUrl) {
      return {
        filePath,
        oldUrl: currentUrl,
        newUrl: expectedUrl,
        modified: false,
      }
    }

    // URLs differ, need to update
    const modifyResult = modifyRouteUrl(fileContent, expectedUrl)

    if (!modifyResult.modified || !modifyResult.content) {
      return {
        filePath,
        oldUrl: currentUrl,
        newUrl: expectedUrl,
        modified: false,
        error:
          modifyResult.error || 'Failed to modify file (no content returned)',
      }
    }

    // Write the modified content back to the file
    fs.writeFileSync(filePath, modifyResult.content, 'utf-8')

    // Log the change
    console.log(
      `✓ Updated ${path.relative(process.cwd(), filePath)}: ${currentUrl || '(no url)'} → ${expectedUrl}`,
    )

    return {
      filePath,
      oldUrl: currentUrl,
      newUrl: expectedUrl,
      modified: true,
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `✗ Error synchronizing ${path.relative(process.cwd(), filePath)}: ${errorMessage}`,
    )
    return {
      filePath,
      oldUrl: null,
      newUrl: expectedUrl,
      modified: false,
      error: errorMessage,
    }
  }
}

/**
 * Synchronizes multiple route files based on a file-to-URL mapping.
 * Handles errors gracefully and continues processing other files.
 *
 * @param fileUrlMap - Map of file paths to their expected URLs
 * @returns SyncSummary with details about all synchronization operations
 */
export function synchronizeRoutes(
  fileUrlMap: Map<string, string>,
): SyncSummary {
  const results: SyncResult[] = []
  let filesModified = 0
  let filesSkipped = 0
  let errors = 0

  for (const [filePath, expectedUrl] of fileUrlMap.entries()) {
    const result = synchronizeRouteFile(filePath, expectedUrl)
    results.push(result)

    if (result.error) {
      errors++
    } else if (result.modified) {
      filesModified++
    } else {
      filesSkipped++
    }
  }

  return {
    totalFiles: fileUrlMap.size,
    filesModified,
    filesSkipped,
    errors,
    results,
  }
}
