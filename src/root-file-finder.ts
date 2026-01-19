import {existsSync} from 'fs'
import {resolve} from 'path'

const DEFAULT_ROOT_FILES = ['src/server', 'src/main', 'src/index']
const EXTENSIONS = ['.ts', '.js', '.mjs', '.cjs']

/**
 * Finds the root server file for extracting route prefix.
 * @param customPath - Optional custom path to root server file (without extension)
 * @returns The absolute path to the root server file, or null if not found
 */
export function findRootServerFile(customPath?: string): string | null {
  const searchPaths = customPath ? [customPath] : DEFAULT_ROOT_FILES

  for (const basePath of searchPaths) {
    const absoluteBasePath = resolve(basePath)

    for (const ext of EXTENSIONS) {
      const fullPath = absoluteBasePath + ext

      if (existsSync(fullPath)) {
        return fullPath
      }
    }
  }

  return null
}
