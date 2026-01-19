import {discoverRouteFiles} from './file-discovery'
import {detectAndResolveConflicts} from './conflict-detector'
import {synchronizeRoutes, type SyncSummary} from './route-synchronizer'

/**
 * Result of the initial scan operation
 */
export interface InitialScanResult {
  /** Total number of route files discovered */
  totalFiles: number
  /** Number of files that were updated */
  filesUpdated: number
  /** Number of files that were skipped (already correct) */
  filesSkipped: number
  /** Number of conflicts detected and resolved */
  conflictsResolved: number
  /** Number of errors encountered */
  errors: number
  /** Detailed synchronization summary */
  syncSummary: SyncSummary
}

/**
 * Performs an initial scan of all route files in src/api directory.
 *
 * This function:
 * 1. Discovers all route files in the src/api directory
 * 2. Calculates expected URLs based on file paths
 * 3. Detects and resolves any URL conflicts
 * 4. Automatically updates files where the URL doesn't match the expected value
 * 5. Prints a summary of the operations performed
 *
 * @param apiDir - Root directory to scan (default: 'src/api')
 * @returns InitialScanResult with detailed statistics
 */
export function performInitialScan(
  apiDir: string = 'src/api',
): InitialScanResult {
  console.log('🔍 Scanning route files...')

  // Step 1: Discover all route files
  const {routes, invalidFiles} = discoverRouteFiles(apiDir)
  console.log(`   Found ${routes.length} route file(s)`)

  // Report invalid files
  if (invalidFiles.length > 0) {
    console.log(
      `⚠️  Warning: Found ${invalidFiles.length} invalid route file(s):`,
    )
    for (const invalid of invalidFiles) {
      console.log(`   ✗ ${invalid.filePath}`)
      console.log(`     ${invalid.reason}`)
    }
  }

  // Handle empty directory
  if (routes.length === 0) {
    console.log('✓ No route files found. Nothing to do.')
    return {
      totalFiles: 0,
      filesUpdated: 0,
      filesSkipped: 0,
      conflictsResolved: 0,
      errors: 0,
      syncSummary: {
        totalFiles: 0,
        filesModified: 0,
        filesSkipped: 0,
        errors: 0,
        results: [],
      },
    }
  }

  // Step 2: Filter out invalid files from synchronization
  // Invalid files (e.g., siblings of index.ts) should not be updated
  const invalidFilePaths = new Set(invalidFiles.map((f) => f.filePath))
  const validRoutes = routes.filter((r) => !invalidFilePaths.has(r.filePath))

  // Step 3: Detect and resolve conflicts
  console.log('🔍 Detecting conflicts...')
  const {fileUrlMap, fileRouteMap, conflicts} =
    detectAndResolveConflicts(validRoutes)

  if (conflicts.length === 0) {
    console.log('   No conflicts detected')
  } else {
    console.log(`   Resolved ${conflicts.length} conflict(s)`)
  }

  // Step 4: Synchronize all valid files (excluding invalid files)
  console.log('🔄 Synchronizing route files...')
  const syncSummary = synchronizeRoutes(fileUrlMap, fileRouteMap)

  // Step 5: Print summary
  console.log('\n📊 Summary:')
  console.log(`   Total files scanned: ${routes.length}`)
  console.log(`   Valid files synchronized: ${syncSummary.totalFiles}`)
  console.log(`   Files updated: ${syncSummary.filesModified}`)
  console.log(`   Files skipped (already correct): ${syncSummary.filesSkipped}`)
  if (invalidFiles.length > 0) {
    console.log(`   Invalid files (not synchronized): ${invalidFiles.length}`)
  }
  console.log(`   Conflicts resolved: ${conflicts.length}`)
  if (syncSummary.errors > 0) {
    console.log(`   Errors: ${syncSummary.errors}`)
  }
  console.log('')

  return {
    totalFiles: routes.length,
    filesUpdated: syncSummary.filesModified,
    filesSkipped: syncSummary.filesSkipped,
    conflictsResolved: conflicts.length,
    errors: syncSummary.errors,
    syncSummary,
  }
}
