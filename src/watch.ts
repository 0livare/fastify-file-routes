#!/usr/bin/env bun
import path from 'node:path'
import fs from 'node:fs'
import chalk from 'chalk'
import {performInitialScan} from './initial-scan'
import {createFileWatcher, setupGracefulShutdown} from './file-watcher'
import {synchronizeRouteFile} from './route-synchronizer'
import {filePathToUrlPath} from './path-mapper'
import {extractHttpMethod} from './method-extractor'
import {generateRouteTemplate} from './route-template'
import {help, version} from './commands'
import {parseCliArgs} from './cli'

async function main() {
  const args = parseCliArgs()

  if (args.help) {
    help()
    process.exit(0)
  }

  if (args.version) {
    version()
    process.exit(0)
  }

  const verbose = args.verbose || false
  const apiDir = path.join(process.cwd(), 'src/api')

  if (verbose) {
    console.info(chalk.bold.blue('🚀 Fastify Sync'))
    console.info(chalk.gray(`Watching: ${apiDir}\n`))
    console.info(chalk.bold('📋 Running initial scan...'))
  }

  const scanResult = performInitialScan(apiDir, verbose)
  if (verbose) {
    if (scanResult.totalFiles === 0) {
      console.info(chalk.yellow('\n⚠️  No route files found in src/api'))
      console.info(
        chalk.gray('Create route files with .get.ts, .post.ts, etc. suffixes'),
      )
    }
    console.info(chalk.bold.green('\n👀 Watching for changes...\n'))
  }

  const watcher = createFileWatcher(apiDir, {
    onEvent: (event) => {
      const relativePath = path.relative(process.cwd(), event.filePath)

      if (event.type === 'add') {
        if (verbose) console.info(chalk.green(`➕ File added: ${relativePath}`))
        handleFileChange(event.filePath, apiDir, verbose, true)
      } else if (event.type === 'change') {
        if (verbose)
          console.info(chalk.blue(`📝 File changed: ${relativePath}`))
        handleFileChange(event.filePath, apiDir, verbose, false)
      } else if (event.type === 'unlink') {
        if (verbose)
          console.info(chalk.red(`🗑️  File deleted: ${relativePath}`))
      }
    },
    onReady: () => {
      if (verbose) console.info(chalk.gray('Press Ctrl+C to stop watching\n'))
    },
    onError: (error) => {
      console.error(chalk.red('❌ Watcher error:'), error)
    },
  })

  // Set up graceful shutdown
  setupGracefulShutdown(watcher, () => {
    if (verbose) {
      console.info(chalk.yellow('\n\n👋 Stopping watcher...'))
      console.info(chalk.gray('Goodbye!'))
    }
  })

  // Keep process running
  await new Promise(() => {}) // Never resolves - keeps process alive
}

/**
 * Check if a directory contains an index file (index.ts or index.js without method suffix)
 */
function hasIndexFile(dir: string): boolean {
  try {
    const entries = fs.readdirSync(dir)
    return entries.includes('index.ts') || entries.includes('index.js')
  } catch {
    return false
  }
}

/**
 * Handle file addition or change by synchronizing the route
 */
function handleFileChange(
  filePath: string,
  apiDir: string,
  verbose: boolean = false,
  isNewFile: boolean = false,
): void {
  try {
    // Check if this file is in a directory with an index file
    const dir = path.dirname(filePath)
    const fileName = path.basename(filePath)
    const isIndexFile = fileName === 'index.ts' || fileName === 'index.js'

    if (!isIndexFile && hasIndexFile(dir)) {
      if (verbose) {
        console.info(
          chalk.yellow(
            `  ⚠️  Skipping: directory contains an index file (this file will be ignored by Fastify)`,
          ),
        )
      }
      return
    }

    // Calculate the expected URL for this file
    const relativePath = path.relative(process.cwd(), filePath)
    const expectedUrl = filePathToUrlPath(relativePath)

    if (!expectedUrl) {
      if (verbose)
        console.info(chalk.gray(`  ⏭️  Skipping: not a valid route file`))
      return
    }

    // Extract the expected HTTP method from the filename
    const expectedMethod = extractHttpMethod(filePath)
    if (!expectedMethod) {
      if (verbose)
        console.info(
          chalk.gray(`  ⏭️  Skipping: no valid HTTP method in filename`),
        )
      return
    }

    // Check if this is a new empty file that should be scaffolded
    if (isNewFile) {
      const fileContent = fs.readFileSync(filePath, 'utf-8').trim()
      if (fileContent === '') {
        // Scaffold the file with the template
        const template = generateRouteTemplate(expectedUrl, expectedMethod)
        fs.writeFileSync(filePath, template, 'utf-8')
        if (verbose) {
          console.info(
            chalk.green(
              `  ✨ Scaffolded new route: ${expectedUrl} (${expectedMethod})`,
            ),
          )
        }
        return
      }
    }

    // Synchronize the file (both URL and method)
    const result = synchronizeRouteFile(filePath, expectedUrl, expectedMethod)

    if (result.error) {
      if (verbose) console.info(chalk.red(`  ✗ Error: ${result.error}`))
    } else if (result.modified) {
      if (verbose) {
        const changes: string[] = []
        if (result.oldUrl !== result.newUrl) {
          changes.push(`url: ${result.oldUrl || '(none)'} → ${result.newUrl}`)
        }
        if (result.oldMethod !== result.newMethod) {
          changes.push(
            `method: ${result.oldMethod || '(none)'} → ${result.newMethod}`,
          )
        }
        console.info(chalk.green(`  ✓ Updated: ${changes.join(', ')}`))
      }
    } else {
      if (verbose)
        console.info(
          chalk.gray(
            `  ✓ Already correct: ${result.newUrl} (${result.newMethod})`,
          ),
        )
    }
  } catch (error) {
    if (verbose)
      console.error(
        chalk.red(`  ✗ Error processing file:`),
        error instanceof Error ? error.message : error,
      )
  }
}

// Run the CLI
await main()
