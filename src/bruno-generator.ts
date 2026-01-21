import * as fs from 'fs'
import * as path from 'path'
import type {HttpMethod} from './filepath/method-extractor'

/**
 * Generates a Bruno request file (.bru) for a given route
 *
 * @param method - HTTP method (GET, POST, etc.)
 * @param url - URL path for the route
 * @param name - Optional name for the request (defaults to derived from URL)
 * @returns Bruno request file content
 */
export function generateBrunoRequest(
  method: HttpMethod,
  url: string,
  name?: string,
): string {
  // Derive a name from the URL if not provided
  const requestName = name || deriveNameFromUrl(url, method)

  // Convert Fastify :param syntax to Bruno {{param}} syntax
  const brunoUrl = url.replace(/:(\w+)/g, '{{$1}}')
  const hasJsonBody = ['POST', 'PUT', 'PATCH'].includes(method)

  const lines: string[] = []

  // Meta section
  lines.push('meta {')
  lines.push(`  name: ${requestName}`)
  lines.push(`  type: http`)
  lines.push('}')
  lines.push('')

  // HTTP method and URL
  lines.push(`${method.toLowerCase()} {`)
  lines.push(`  url: {{appUrl}}${brunoUrl}`)
  lines.push(`  body: ${hasJsonBody ? 'json' : 'none'}`)
  lines.push(`  auth: inherit`)
  lines.push('}')
  lines.push('')

  // Add body section for POST, PUT, PATCH
  if (hasJsonBody) {
    lines.push('body:json {')
    lines.push('  {')
    lines.push('    ')
    lines.push('  }')
    lines.push('}')
    lines.push('')
  }

  return lines.join('\n')
}

/**
 * Generates a folder.bru file for a directory
 *
 * @param folderName - Name of the folder
 * @returns folder.bru file content
 */
export function generateFolderBru(folderName: string): string {
  const lines: string[] = []

  lines.push('meta {')
  lines.push(`  name: ${folderName}`)
  lines.push('}')
  lines.push('')

  lines.push('auth {')
  lines.push('  mode: inherit')
  lines.push('}')
  lines.push('')

  return lines.join('\n')
}

const httpVerbToEnglishVerb: Record<HttpMethod, string> = {
  GET: 'get',
  POST: 'create',
  PUT: 'overwrite',
  PATCH: 'modify',
  DELETE: 'delete',
}

/**
 * Derives a human-readable name from a URL path
 * Example: /api/users/:id -> get users
 */
function deriveNameFromUrl(url: string, method: HttpMethod): string {
  // Remove /api prefix if present
  let cleanUrl = url.replace(/^\/api/, '')

  // Remove leading slash
  cleanUrl = cleanUrl.replace(/^\//, '')

  // Remove path parameters (everything starting with :)
  cleanUrl = cleanUrl.replace(/:\w+/g, '')

  // Split by slashes and capitalize each part
  const parts = cleanUrl
    .split('/')
    .filter(Boolean)
    .map((part) => {
      // Handle kebab-case
      return part
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    })

  const methodVerb = httpVerbToEnglishVerb[method]
  if (parts.length === 0) return methodVerb

  return `${methodVerb} ${parts.join(' ')}`.toLowerCase()
}

/**
 * Converts a route file path to a Bruno collection directory structure
 *
 * @param routeFilePath - Absolute path to the route file (e.g., /project/src/api/users/$id.get.ts)
 * @param brunoCollectionRoot - Root directory of the Bruno collection
 * @returns Object with brunoDir and brunoFilePath
 *
 * Example:
 * routeFilePath: /project/src/api/users/$id.get.ts
 * brunoCollectionRoot: /project/bruno
 * Returns:
 *   brunoDir: /project/bruno/users
 *   brunoFilePath: /project/bruno/users/Get User Id.bru
 */
export function mapRouteToBrunoPath(
  routeFilePath: string,
  brunoCollectionRoot: string,
  method: HttpMethod,
  url: string,
): {brunoDir: string; brunoFilePath: string} {
  // Extract the relative path from src/api
  const apiDirMatch = routeFilePath.match(/src[\/\\]api[\/\\](.*)/)
  if (!apiDirMatch) {
    throw new Error('Route file must be under src/api directory')
  }

  let relativePath = apiDirMatch[1]

  // Remove the file extension and method suffix
  relativePath = relativePath.replace(
    /\.(get|post|put|patch|delete)\.(ts|js)$/,
    '',
  )

  // Get directory path (remove filename)
  const dirPath = path.dirname(relativePath)
  // const fileName = path.basename(relativePath)

  // Build Bruno directory path
  const brunoDir =
    dirPath === '.'
      ? brunoCollectionRoot
      : path.join(brunoCollectionRoot, dirPath)

  // Generate Bruno request filename
  const requestName = deriveNameFromUrl(url, method)
  const brunoFileName = `${requestName}.bru`
  const brunoFilePath = path.join(brunoDir, brunoFileName)

  return {brunoDir, brunoFilePath}
}

/**
 * Creates necessary folder.bru files in the directory structure
 *
 * @param brunoDir - Directory where the Bruno request will be created
 * @param brunoCollectionRoot - Root of the Bruno collection
 */
export function ensureFolderBruFiles(
  brunoDir: string,
  brunoCollectionRoot: string,
): void {
  // Get all parent directories from collection root to target directory
  const relativePath = path.relative(brunoCollectionRoot, brunoDir)
  if (relativePath === '' || relativePath === '.') {
    return // Already at root
  }

  const parts = relativePath.split(path.sep)
  let currentPath = brunoCollectionRoot

  for (const part of parts) {
    currentPath = path.join(currentPath, part)

    // Create directory if it doesn't exist
    if (!fs.existsSync(currentPath)) {
      fs.mkdirSync(currentPath, {recursive: true})
    }

    // Create folder.bru if it doesn't exist
    const folderBruPath = path.join(currentPath, 'folder.bru')
    if (!fs.existsSync(folderBruPath)) {
      // Use only the current directory name, not the full path
      const folderName = part
      const content = generateFolderBru(folderName)
      fs.writeFileSync(folderBruPath, content, 'utf-8')
    }
  }
}

/**
 * Creates a Bruno request file for a route
 *
 * @param routeFilePath - Absolute path to the route file
 * @param brunoCollectionRoot - Root directory of the Bruno collection
 * @param method - HTTP method
 * @param url - URL path
 */
export function createBrunoRequest(
  routeFilePath: string,
  brunoCollectionRoot: string,
  method: HttpMethod,
  url: string,
): void {
  const {brunoDir, brunoFilePath} = mapRouteToBrunoPath(
    routeFilePath,
    brunoCollectionRoot,
    method,
    url,
  )

  // Ensure all parent directories and folder.bru files exist
  ensureFolderBruFiles(brunoDir, brunoCollectionRoot)

  // Generate and write the Bruno request file
  const requestContent = generateBrunoRequest(method, url)
  fs.writeFileSync(brunoFilePath, requestContent, 'utf-8')
}
