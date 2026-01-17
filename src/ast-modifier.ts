import * as ts from 'typescript'

export interface ModificationResult {
  modified: boolean
  content: string | null
  error?: string
}

/**
 * Modifies the 'url' field in a Fastify route file while preserving formatting.
 * Only modifies files that have a valid Fastify route() call structure.
 *
 * @param fileContent - The content of the Fastify route file
 * @param newUrl - The new URL to set in the route configuration
 * @returns ModificationResult with modified flag and updated content
 */
export function modifyRouteUrl(
  fileContent: string,
  newUrl: string,
): ModificationResult {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  )

  let urlNodeInfo: {
    node: ts.Node
    quoteChar: string
    start: number
    end: number
  } | null = null
  let found = false

  function visit(node: ts.Node) {
    // Stop traversing if we already found a route
    if (found) return

    // Look for .route() call expressions
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'route'
    ) {
      // The first argument should be the route config object
      if (node.arguments.length > 0) {
        const configArg = node.arguments[0]
        if (ts.isObjectLiteralExpression(configArg)) {
          // Extract url field from the object literal
          for (const prop of configArg.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const propName = prop.name.text
              const value = prop.initializer

              if (propName === 'url') {
                const info = extractNodeInfo(value, fileContent)
                if (info) {
                  urlNodeInfo = info
                }
              }
            }
          }
          // Mark as found after processing the first route
          found = true
          return
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)

  // Safety check: only modify files with valid route structure
  if (!urlNodeInfo) {
    return {
      modified: false,
      content: null,
      error: 'No valid url field found in route configuration',
    }
  }

  // Replace the URL value while preserving quote style
  const {quoteChar, start, end} = urlNodeInfo
  const before = fileContent.substring(0, start)
  const after = fileContent.substring(end)
  const modifiedContent = `${before}${quoteChar}${newUrl}${quoteChar}${after}`

  return {
    modified: true,
    content: modifiedContent,
  }
}

/**
 * Extracts node information including position and quote style
 */
function extractNodeInfo(
  node: ts.Node,
  fileContent: string,
): {node: ts.Node; quoteChar: string; start: number; end: number} | null {
  // Handle string literals (single, double quotes)
  if (ts.isStringLiteral(node)) {
    const start = node.getStart()
    const end = node.getEnd()
    const fullText = fileContent.substring(start, end)

    // Determine quote character from original text
    let quoteChar = "'"
    if (fullText.startsWith('"')) {
      quoteChar = '"'
    }

    return {
      node,
      quoteChar,
      start,
      end,
    }
  }

  // Handle template literals without expressions
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    const start = node.getStart()
    const end = node.getEnd()

    return {
      node,
      quoteChar: '`',
      start,
      end,
    }
  }

  // For other cases (like identifiers or complex expressions), return null
  return null
}
