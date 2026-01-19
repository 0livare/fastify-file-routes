import * as fs from 'fs'
import * as path from 'path'
import chalk from 'chalk'
import {parseRouteFile} from './ast-parser'
import {modifyRouteUrl, modifyRouteFields} from './ast-modifier'
import type {HttpMethod} from './method-extractor'
import {findRootServerFile} from './root-file-finder'
import {extractPrefixFromServerFile} from './prefix-parser'

export interface SyncConfig {
  /** Custom root server file path (without extension) */
  rootFile?: string
  /** Whether to add full URL comments (default: true) */
  addComments?: boolean
}

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
 * Gets the route prefix from the root server file.
 * Falls back to '/api' if prefix cannot be determined.
 * Emits warnings when fallback is used.
 *
 * @param rootFilePath - Optional custom root file path
 * @returns The prefix string (with leading slash) or '/api' as default
 */
function getPrefixWithFallback(rootFilePath?: string): string {
  const DEFAULT_PREFIX = '/api'

  // Try to find the root server file
  const rootFile = findRootServerFile(rootFilePath)

  if (!rootFile) {
    if (rootFilePath) {
      console.warn(
        chalk.yellow(
          `⚠️  Warning: Specified root file not found: ${rootFilePath}`,
        ),
      )
    } else {
      console.warn(
        chalk.yellow(
          `⚠️  Warning: No root server file found (checked: src/server, src/main, src/index)`,
        ),
      )
    }
    console.warn(chalk.yellow(`   Using default prefix: ${DEFAULT_PREFIX}`))
    return DEFAULT_PREFIX
  }

  // Try to extract prefix from the root file
  const prefix = extractPrefixFromServerFile(rootFile)

  if (!prefix) {
    console.warn(
      chalk.yellow(
        `⚠️  Warning: Could not parse prefix from root file: ${path.relative(process.cwd(), rootFile)}`,
      ),
    )
    console.warn(chalk.yellow(`   Using default prefix: ${DEFAULT_PREFIX}`))
    return DEFAULT_PREFIX
  }

  return prefix
}

/**
 * Synchronizes a single route file by comparing its actual URL and method with expected values.
 * If they differ, updates the file using AST modification.
 *
 * @param filePath - Absolute path to the route file
 * @param expectedUrl - The expected URL based on file path conventions
 * @param expectedMethod - The expected HTTP method based on filename (optional)
 * @param config - Optional configuration for synchronization (prefix, comments, etc.)
 * @returns SyncResult with details about the synchronization
 */
export function synchronizeRouteFile(
  filePath: string,
  expectedUrl: string,
  expectedMethod?: HttpMethod,
  config?: SyncConfig,
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
    const fieldsToModify: {url?: string; method?: string; fullUrl?: string} = {}
    if (!urlMatches) {
      fieldsToModify.url = expectedUrl
    }
    if (!methodMatches && expectedMethod) {
      fieldsToModify.method = expectedMethod
    }

    // Add full URL comment if comments are enabled (default: true)
    const addComments = config?.addComments !== false
    if (addComments && !urlMatches) {
      const prefix = getPrefixWithFallback(config?.rootFile)
      fieldsToModify.fullUrl = prefix + expectedUrl
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
 * @param config - Optional configuration for synchronization (prefix, comments, etc.)
 * @returns SyncSummary with details about all synchronization operations
 */
export function synchronizeRoutes(
  fileUrlMap: Map<string, string>,
  fileRouteMap?: Map<string, {url: string; method: string}>,
  config?: SyncConfig,
): SyncSummary {
  const results: SyncResult[] = []
  let filesModified = 0
  let filesSkipped = 0
  let errors = 0

  for (const [filePath, expectedUrl] of fileUrlMap.entries()) {
    const routeInfo = fileRouteMap?.get(filePath)
    const expectedMethod = routeInfo?.method as HttpMethod | undefined

    const result = synchronizeRouteFile(
      filePath,
      expectedUrl,
      expectedMethod,
      config,
    )
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
