import * as ts from 'typescript'

export interface RouteConfig {
  url: string | null
  method: string | null
}

/**
 * Parses a Fastify route file and extracts the 'url' and 'method' fields
 * from the route configuration object passed to the route() call.
 *
 * @param fileContent - The content of the Fastify route file
 * @returns RouteConfig object with url and method, or null values if not found
 */
export function parseRouteFile(fileContent: string): RouteConfig {
  const sourceFile = ts.createSourceFile(
    'temp.ts',
    fileContent,
    ts.ScriptTarget.Latest,
    true,
  )

  let url: string | null = null
  let method: string | null = null
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
          // Extract url and method from the object literal
          for (const prop of configArg.properties) {
            if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
              const propName = prop.name.text
              const value = prop.initializer

              if (propName === 'url') {
                url = extractStringValue(value)
              } else if (propName === 'method') {
                method = extractStringValue(value)
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

  return {url, method}
}

/**
 * Extracts a string value from various TypeScript node types
 * Handles string literals, template literals (without expressions), and identifiers
 */
function extractStringValue(node: ts.Node): string | null {
  // Handle string literals (single, double quotes)
  if (ts.isStringLiteral(node)) {
    return node.text
  }

  // Handle template literals without expressions
  if (ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text
  }

  // For other cases (like identifiers or complex expressions), return null
  return null
}
