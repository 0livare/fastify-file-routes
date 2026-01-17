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

  const quiet = args.quiet || false
  const apiDir = path.join(process.cwd(), 'src/api')

  if (!quiet) {
    console.log(chalk.bold.blue('🚀 Fastify File-Based Routing CLI'))
    console.log(chalk.gray(`Watching: ${apiDir}\n`))

    // Perform initial scan
    console.log(chalk.bold('📋 Running initial scan...'))
    const scanResult = performInitialScan(apiDir)

    if (scanResult.totalFiles === 0) {
      console.log(chalk.yellow('\n⚠️  No route files found in src/api'))
      console.log(
        chalk.gray('Create route files with .get.ts, .post.ts, etc. suffixes'),
      )
    }

    console.log() // Empty line for spacing

    // Set up file watcher
    console.log(chalk.bold.green('👀 Watching for changes...\n'))
  }

  const watcher = createFileWatcher(apiDir, {
    onEvent: (event) => {
      const relativePath = path.relative(process.cwd(), event.filePath)

      if (event.type === 'add') {
        if (!quiet) console.log(chalk.green(`➕ File added: ${relativePath}`))
        handleFileChange(event.filePath, apiDir, quiet, true)
      } else if (event.type === 'change') {
        if (!quiet) console.log(chalk.blue(`📝 File changed: ${relativePath}`))
        handleFileChange(event.filePath, apiDir, quiet, false)
      } else if (event.type === 'unlink') {
        if (!quiet) console.log(chalk.red(`🗑️  File deleted: ${relativePath}`))
      }
    },
    onReady: () => {
      if (!quiet) console.log(chalk.gray('Press Ctrl+C to stop watching\n'))
    },
    onError: (error) => {
      console.error(chalk.red('❌ Watcher error:'), error)
    },
  })

  // Set up graceful shutdown
  setupGracefulShutdown(watcher, () => {
    if (!quiet) {
      console.log(chalk.yellow('\n\n👋 Stopping watcher...'))
      console.log(chalk.gray('Goodbye!'))
    }
  })

  // Keep process running
  await new Promise(() => {}) // Never resolves - keeps process alive
}

/**
 * Handle file addition or change by synchronizing the route
 */
function handleFileChange(
  filePath: string,
  apiDir: string,
  quiet: boolean = false,
  isNewFile: boolean = false,
): void {
  try {
    // Calculate the expected URL for this file
    const relativePath = path.relative(process.cwd(), filePath)
    const expectedUrl = filePathToUrlPath(relativePath)

    if (!expectedUrl) {
      if (!quiet)
        console.log(chalk.gray(`  ⏭️  Skipping: not a valid route file`))
      return
    }

    // Extract the expected HTTP method from the filename
    const expectedMethod = extractHttpMethod(filePath)
    if (!expectedMethod) {
      if (!quiet)
        console.log(
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
        if (!quiet) {
          console.log(
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
      if (!quiet) console.log(chalk.red(`  ✗ Error: ${result.error}`))
    } else if (result.modified) {
      if (!quiet) {
        const changes: string[] = []
        if (result.oldUrl !== result.newUrl) {
          changes.push(`url: ${result.oldUrl || '(none)'} → ${result.newUrl}`)
        }
        if (result.oldMethod !== result.newMethod) {
          changes.push(
            `method: ${result.oldMethod || '(none)'} → ${result.newMethod}`,
          )
        }
        console.log(chalk.green(`  ✓ Updated: ${changes.join(', ')}`))
      }
    } else {
      if (!quiet)
        console.log(
          chalk.gray(
            `  ✓ Already correct: ${result.newUrl} (${result.newMethod})`,
          ),
        )
    }
  } catch (error) {
    if (!quiet)
      console.error(
        chalk.red(`  ✗ Error processing file:`),
        error instanceof Error ? error.message : error,
      )
  }
}

// Run the CLI
await main()
