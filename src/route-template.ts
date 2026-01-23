import fs from 'node:fs'
import path from 'node:path'
import type {HttpMethod} from './filepath/method-extractor'
import {transformImportPaths} from './util/import-transformer'
import {modifyRouteFields} from './ast/ast-modifier'

interface TemplateOptions {
  templatePath?: string | null
  projectRoot?: string
  targetFilePath?: string
}

interface RequiredTemplateOptions {
  templatePath: string
  projectRoot: string
  targetFilePath: string
}

/**
 * Generates a Fastify route file template.
 *
 * @param url - The URL path for the route (e.g., '/api/users/:id')
 * @param method - The HTTP method (GET, POST, PUT, PATCH, DELETE)
 * @param options - Optional template configuration
 * @returns The complete file content as a string
 */
export function generateRouteTemplate(
  url: string,
  method: HttpMethod,
  options?: TemplateOptions,
): string {
  const {templatePath, projectRoot, targetFilePath} = options || {}

  if (templatePath) {
    return generateFromCustomTemplate(url, method, {
      templatePath,
      projectRoot: projectRoot || process.cwd(),
      targetFilePath: targetFilePath || '',
    })
  }

  return generateBasicTemplate(url, method)
}

/**
 * Generates the basic Fastify template (no type providers).
 */
function generateBasicTemplate(url: string, method: HttpMethod): string {
  return `import type { FastifyInstance } from 'fastify'

export default async function (fastify: FastifyInstance) {
  fastify.route({
    method: '${method}',
    url: '${url}',
    async handler(req, reply) {
      reply.code(200).send('Hello, World!')
    },
  })
}
`
}

/**
 * Generates template from a custom template file.
 */
function generateFromCustomTemplate(
  url: string,
  method: HttpMethod,
  options: RequiredTemplateOptions,
): string {
  const {templatePath, projectRoot, targetFilePath} = options

  // Resolve template path (relative to cwd or absolute)
  const resolvedTemplatePath = path.isAbsolute(templatePath)
    ? templatePath
    : path.join(projectRoot, templatePath)

  // Read template content
  let content = fs.readFileSync(resolvedTemplatePath, 'utf-8')

  // Transform relative import paths
  const templateDir = path.dirname(resolvedTemplatePath)
  const targetDir = path.dirname(targetFilePath)
  content = transformImportPaths(content, templateDir, targetDir)

  // Replace METHOD and URL placeholders
  content = replacePlaceholders(content, url, method)

  return content
}

/**
 * Replaces the method and URL in the template content using AST modification.
 * This works with real route files - it finds the existing route definition
 * and replaces the method and URL values.
 */
function replacePlaceholders(
  content: string,
  url: string,
  method: HttpMethod,
): string {
  // Use the AST modifier to replace method and URL in the route definition
  const result = modifyRouteFields(content, {url, method})

  // If modification succeeded, return the modified content
  if (result.modified && result.content) {
    return result.content
  }

  // If modification failed, return the original content unchanged
  // This might happen if the template doesn't have a valid route definition
  return content
}
