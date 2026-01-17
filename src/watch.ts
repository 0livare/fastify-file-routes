#!/usr/bin/env bun
import path from 'node:path'
import chalk from 'chalk'
import {performInitialScan} from './initial-scan'
import {createFileWatcher, setupGracefulShutdown} from './file-watcher'
import {synchronizeRouteFile} from './route-synchronizer'
import {filePathToUrlPath} from './path-mapper'
import {detectAndResolveConflicts} from './conflict-detector'
import type {RouteFileMetadata} from './file-discovery'

async function main() {
  const apiDir = path.join(process.cwd(), 'src/api')

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
    process.exit(0)
  }

  console.log() // Empty line for spacing

  // Set up file watcher
  console.log(chalk.bold.green('👀 Watching for changes...\n'))

  const watcher = createFileWatcher(apiDir, {
    onEvent: (event) => {
      const relativePath = path.relative(process.cwd(), event.filePath)

      if (event.type === 'add') {
        console.log(chalk.green(`➕ File added: ${relativePath}`))
        handleFileChange(event.filePath, apiDir)
      } else if (event.type === 'change') {
        console.log(chalk.blue(`📝 File changed: ${relativePath}`))
        handleFileChange(event.filePath, apiDir)
      } else if (event.type === 'unlink') {
        console.log(chalk.red(`🗑️  File deleted: ${relativePath}`))
      }
    },
    onReady: () => {
      console.log(chalk.gray('Press Ctrl+C to stop watching\n'))
    },
    onError: (error) => {
      console.error(chalk.red('❌ Watcher error:'), error)
    },
  })

  // Set up graceful shutdown
  setupGracefulShutdown(watcher, () => {
    console.log(chalk.yellow('\n\n👋 Stopping watcher...'))
    console.log(chalk.gray('Goodbye!'))
  })

  // Keep process running
  await new Promise(() => {}) // Never resolves - keeps process alive
}

/**
 * Handle file addition or change by synchronizing the route
 */
function handleFileChange(filePath: string, apiDir: string): void {
  try {
    // Calculate the expected URL for this file
    const relativePath = path.relative(process.cwd(), filePath)
    const expectedUrl = filePathToUrlPath(relativePath)

    if (!expectedUrl) {
      console.log(chalk.gray(`  ⏭️  Skipping: not a valid route file`))
      return
    }

    // Create a temporary route metadata object for conflict detection
    // In a real scenario with multiple files, we'd need to check all files
    // For now, we'll use the calculated URL directly
    const urlMap = new Map<string, string>()
    urlMap.set(filePath, expectedUrl)

    // Synchronize the file
    const result = synchronizeRouteFile(filePath, expectedUrl)

    if (result.error) {
      console.log(chalk.red(`  ✗ Error: ${result.error}`))
    } else if (result.modified) {
      console.log(
        chalk.green(
          `  ✓ Updated: ${result.oldUrl || '(none)'} → ${result.newUrl}`,
        ),
      )
    } else {
      console.log(chalk.gray(`  ✓ Already correct: ${result.newUrl}`))
    }
  } catch (error) {
    console.error(
      chalk.red(`  ✗ Error processing file:`),
      error instanceof Error ? error.message : error,
    )
  }
}

// Run the CLI
await main()
