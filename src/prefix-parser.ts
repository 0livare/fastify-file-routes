import * as ts from 'typescript'
import {readFileSync} from 'fs'

/**
 * Extracts the route prefix from a Fastify server file.
 *
 * Looks for patterns like:
 * fastify.register(autoLoad, {
 *   dir: path.join(import.meta.dirname, 'api'),
 *   options: { prefix: '/api' }
 * })
 *
 * @param filePath - Absolute path to the server file
 * @returns The prefix string if found, null otherwise
 */
export function extractPrefixFromServerFile(filePath: string): string | null {
  try {
    const fileContent = readFileSync(filePath, 'utf-8')
    const sourceFile = ts.createSourceFile(
      filePath,
      fileContent,
      ts.ScriptTarget.Latest,
      true,
    )

    let prefix: string | null = null

    function visit(node: ts.Node) {
      // Stop if we already found a prefix
      if (prefix !== null) return

      // Look for .register() call expressions
      if (
        ts.isCallExpression(node) &&
        ts.isPropertyAccessExpression(node.expression) &&
        node.expression.name.text === 'register'
      ) {
        // Check if this is a fastify.register call (has at least 2 arguments)
        if (node.arguments.length >= 2) {
          const optionsArg = node.arguments[1]

          // The second argument should be the options object
          if (ts.isObjectLiteralExpression(optionsArg)) {
            prefix = extractPrefixFromOptions(optionsArg)
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return prefix
  } catch (error) {
    // If file doesn't exist or can't be read, return null
    return null
  }
}

/**
 * Extracts the prefix value from the options object literal.
 * Handles both direct prefix and nested options.prefix patterns.
 */
function extractPrefixFromOptions(
  optionsObj: ts.ObjectLiteralExpression,
): string | null {
  for (const prop of optionsObj.properties) {
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const propName = prop.name.text
      const value = prop.initializer

      // Direct prefix property: { prefix: '/api' }
      if (propName === 'prefix') {
        return extractStringValue(value)
      }

      // Nested options object: { options: { prefix: '/api' } }
      if (propName === 'options' && ts.isObjectLiteralExpression(value)) {
        for (const nestedProp of value.properties) {
          if (
            ts.isPropertyAssignment(nestedProp) &&
            ts.isIdentifier(nestedProp.name)
          ) {
            if (nestedProp.name.text === 'prefix') {
              return extractStringValue(nestedProp.initializer)
            }
          }
        }
      }
    }
  }

  return null
}

/**
 * Extracts a string value from various TypeScript node types.
 * Handles string literals, template literals (without expressions), and identifiers.
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
