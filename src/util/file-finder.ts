import * as fs from 'fs'
import * as path from 'path'

export interface FileFinderOptions {
  /**
   * Maximum depth to traverse (default: Infinity)
   * 0 = only search in the root directory
   * 1 = root directory and immediate children
   */
  maxDepth?: number

  /**
   * File extensions to match (e.g., ['.ts', '.js'])
   * If not provided, all files are matched
   */
  extensions?: string[]

  /**
   * Whether to perform case-sensitive matching (default: true)
   */
  caseSensitive?: boolean

  /**
   * Directories to exclude from search
   */
  excludeDirs?: string[]
}

/**
 * Finds all files matching the given filename in a directory tree.
 *
 * @param filename - The filename to search for (with or without extension)
 * @param searchDir - The directory to search in (default: current directory)
 * @param options - Optional configuration for the search
 * @returns Array of absolute paths to matching files
 *
 * @example
 * // Find all files named "config.ts"
 * findFile('config.ts', 'src')
 *
 * // Find all TypeScript files named "index"
 * findFile('index', 'src', { extensions: ['.ts'] })
 *
 * // Find files with custom options
 * findFile('server', 'src', {
 *   maxDepth: 3,
 *   extensions: ['.ts', '.js'],
 *   excludeDirs: ['node_modules', 'dist']
 * })
 */
export function findFile(args: {
  filename: string
  searchDir?: string
  options?: FileFinderOptions
}): string[] {
  const {filename, searchDir = '.', options = {}} = args

  const {
    maxDepth = Infinity,
    extensions,
    caseSensitive = true,
    excludeDirs,
  } = options

  const defaultExcludeDirs = [
    'node_modules',
    '.git',
    'dist',
    'build',
    'coverage',
  ]
  const dirsToExclude =
    excludeDirs !== undefined ? excludeDirs : defaultExcludeDirs

  const results: string[] = []

  // Normalize the search directory to absolute path
  const absoluteSearchDir = path.resolve(searchDir)

  // Check if directory exists
  if (!fs.existsSync(absoluteSearchDir)) {
    return results
  }

  function matches(candidateFilename: string): boolean {
    // Normalize both the candidate and target filenames for comparison
    const normalizedCandidate = caseSensitive
      ? candidateFilename
      : candidateFilename.toLowerCase()
    const normalizedTarget = caseSensitive ? filename : filename.toLowerCase()

    // If extensions are specified, check if the candidate has one of them
    if (extensions && extensions.length > 0) {
      const ext = path.extname(candidateFilename).toLowerCase()
      const normalizedExtensions = extensions.map((e) => e.toLowerCase())

      if (!normalizedExtensions.includes(ext)) {
        return false
      }

      // Compare filename without extension
      const candidateBase = path.basename(
        normalizedCandidate,
        path.extname(normalizedCandidate),
      )
      const targetBase = normalizedTarget.includes('.')
        ? path.basename(normalizedTarget, path.extname(normalizedTarget))
        : normalizedTarget

      return candidateBase === targetBase
    }

    // No extension filter - exact match
    return normalizedCandidate === normalizedTarget
  }

  function searchRecursive(dir: string, currentDepth: number): void {
    if (currentDepth > maxDepth) {
      return
    }

    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, {withFileTypes: true})
    } catch {
      // Skip directories we can't read (permission issues, etc.)
      return
    }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Skip excluded directories
        if (dirsToExclude.includes(entry.name)) {
          continue
        }

        // Recursively search subdirectories
        searchRecursive(fullPath, currentDepth + 1)
      } else if (entry.isFile()) {
        if (matches(entry.name)) {
          results.push(fullPath)
        }
      }
    }
  }

  searchRecursive(absoluteSearchDir, 0)
  return results
}

/**
 * Finds the first file matching the given filename in a directory tree.
 * Returns null if no matching file is found.
 *
 * @param filename - The filename to search for
 * @param searchDir - The directory to search in (default: current directory)
 * @param options - Optional configuration for the search
 * @returns Absolute path to the first matching file, or null if not found
 *
 * @example
 * const configPath = findFirstFile('config.ts', 'src')
 * if (configPath) {
 *   console.log('Found config at:', configPath)
 * }
 */
export function findFirstFile(args: {
  filename: string
  searchDir?: string
  options?: FileFinderOptions
}): string | null {
  const results = findFile(args)
  return results.length > 0 ? results[0] : null
}
