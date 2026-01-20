import * as fs from 'fs'
import * as path from 'path'
import {parseRouteFile} from './ast-parser'
import {modifyRouteFields} from './ast-modifier'
import type {HttpMethod} from './method-extractor'

export interface SyncResult {
  filePath: string
  oldUrl: string | null
  newUrl: string
  oldMethod?: string | null
  newMethod?: string
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
 * Synchronizes a single route file by comparing its actual URL and method with expected values.
 * If they differ, updates the file using AST modification.
 *
 * @param filePath - Absolute path to the route file
 * @param expectedUrl - The expected URL based on file path conventions
 * @param expectedMethod - The expected HTTP method based on filename (optional)
 * @returns SyncResult with details about the synchronization
 */
export function synchronizeRouteFile(
  filePath: string,
  expectedUrl: string,
  expectedMethod?: HttpMethod,
): SyncResult {
  try {
    // Read the file content
    const fileContent = fs.readFileSync(filePath, 'utf-8')

    // Parse the file to extract current URL and method
    const routeConfig = parseRouteFile(fileContent)
    const currentUrl = routeConfig.url
    const currentMethod = routeConfig.method

    // Check if URL and method match
    const urlMatches = currentUrl === expectedUrl
    const methodMatches = !expectedMethod || currentMethod === expectedMethod

    if (urlMatches && methodMatches) {
      return {
        filePath,
        oldUrl: currentUrl,
        newUrl: expectedUrl,
        oldMethod: currentMethod,
        newMethod: expectedMethod,
        modified: false,
      }
    }

    // Build fields to modify
    const fieldsToModify: {url?: string; method?: string} = {}
    if (!urlMatches) {
      fieldsToModify.url = expectedUrl
    }
    if (!methodMatches && expectedMethod) {
      fieldsToModify.method = expectedMethod
    }

    // Modify the fields
    const modifyResult = modifyRouteFields(fileContent, fieldsToModify)

    if (!modifyResult.modified || !modifyResult.content) {
      return {
        filePath,
        oldUrl: currentUrl,
        newUrl: expectedUrl,
        oldMethod: currentMethod,
        newMethod: expectedMethod,
        modified: false,
        error:
          modifyResult.error || 'Failed to modify file (no content returned)',
      }
    }

    // Write the modified content back to the file
    fs.writeFileSync(filePath, modifyResult.content, 'utf-8')

    // Log the changes
    const changes: string[] = []
    if (!urlMatches) {
      changes.push(`url: ${currentUrl || '(none)'} → ${expectedUrl}`)
    }
    if (!methodMatches && expectedMethod) {
      changes.push(`method: ${currentMethod || '(none)'} → ${expectedMethod}`)
    }
    console.log(
      `✓ Updated ${path.relative(process.cwd(), filePath)}: ${changes.join(', ')}`,
    )

    return {
      filePath,
      oldUrl: currentUrl,
      newUrl: expectedUrl,
      oldMethod: currentMethod,
      newMethod: expectedMethod,
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
      oldMethod: null,
      newMethod: expectedMethod,
      modified: false,
      error: errorMessage,
    }
  }
}

/**
 * Synchronizes multiple route files based on a file-to-URL mapping.
 * Handles errors gracefully and continues processing other files.
 *
 * @param fileUrlMap - Map of file paths to their expected URLs (for backward compatibility)
 * @param fileRouteMap - Optional map of file paths to route info (url and method)
 * @returns SyncSummary with details about all synchronization operations
 */
export function synchronizeRoutes(
  fileUrlMap: Map<string, string>,
  fileRouteMap?: Map<string, {url: string; method: string}>,
): SyncSummary {
  const results: SyncResult[] = []
  let filesModified = 0
  let filesSkipped = 0
  let errors = 0

  for (const [filePath, expectedUrl] of fileUrlMap.entries()) {
    const routeInfo = fileRouteMap?.get(filePath)
    const expectedMethod = routeInfo?.method as HttpMethod | undefined

    const result = synchronizeRouteFile(filePath, expectedUrl, expectedMethod)
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
