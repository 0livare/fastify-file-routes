import path from 'node:path'

/**
 * Transforms relative import paths in template content to work from a new location.
 *
 * @param content - Template file content
 * @param templateDir - Directory of the template file
 * @param targetDir - Directory where new file will be created
 * @returns Content with transformed import paths
 */
export function transformImportPaths(
  content: string,
  templateDir: string,
  targetDir: string,
): string {
  // Regex to match import statements with relative paths
  // Matches: import ... from './path' or import ... from "../path"
  // Also handles: import type ... from './path'
  const importRegex =
    /import\s+(?:type\s+)?(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*\s+from\s+)?['"]([.][^'"]+)['"]/g

  return content.replace(importRegex, (match, importPath) => {
    // Skip if not a relative import
    if (!importPath.startsWith('./') && !importPath.startsWith('../')) {
      return match
    }

    // Calculate absolute path of the import target from template perspective
    const absoluteImportPath = path.resolve(templateDir, importPath)

    // Calculate new relative path from target file location
    let newRelativePath = path.relative(targetDir, absoluteImportPath)

    // Ensure path starts with ./ or ../
    if (!newRelativePath.startsWith('.')) {
      newRelativePath = './' + newRelativePath
    }

    // Normalize path separators for cross-platform compatibility
    newRelativePath = newRelativePath.split(path.sep).join('/')

    // Replace the import path in the original match
    return match.replace(importPath, newRelativePath)
  })
}
