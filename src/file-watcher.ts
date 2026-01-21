import * as chokidar from 'chokidar'
import * as path from 'path'

export type WatchEventType = 'add' | 'change' | 'unlink'

export interface WatchEvent {
  type: WatchEventType
  filePath: string
}

export interface WatcherCallbacks {
  onEvent?: (event: WatchEvent) => void
  onReady?: () => void
  onError?: (error: Error) => void
}

export interface FileWatcher {
  close: () => Promise<void>
}

/**
 * Creates a file watcher for the API directory that monitors .ts and .js route files.
 * Triggers callbacks on file additions, modifications, and deletions.
 *
 * @param apiDir - Directory to watch (default: 'src/api')
 * @param callbacks - Callback functions for various events
 * @returns FileWatcher object with close method for cleanup
 */
export function createFileWatcher(
  apiDir: string = 'src/api',
  callbacks: WatcherCallbacks = {},
): FileWatcher {
  const {onEvent, onReady, onError} = callbacks

  // Normalize the path to watch
  const watchPath = path.resolve(apiDir)

  // Create chokidar watcher with options
  const watcher = chokidar.watch(watchPath, {
    persistent: true,
    ignoreInitial: true, // Don't trigger events for existing files on startup
    followSymlinks: true,
    depth: undefined, // Watch all subdirectories
    awaitWriteFinish: {
      stabilityThreshold: 100, // Wait for file to stabilize before triggering
      pollInterval: 50,
    },
    // Only watch .ts and .js files with HTTP method suffixes
    ignored: (filepath: string, stats?: any) => {
      // Don't ignore directories (stats will be undefined for dirs during initial scan)
      if (!stats || stats.isDirectory()) {
        return false
      }

      // Ignore if not a .ts or .js file
      if (!filepath.endsWith('.ts') && !filepath.endsWith('.js')) {
        return true
      }

      // Check if it has a valid HTTP method suffix or is a standalone method file
      // Matches: .get.ts, .post.js, etc. OR get.ts, post.js, etc.
      const hasMethodSuffix =
        /\.(get|post|put|patch|delete)\.(ts|js)$/i.test(filepath) ||
        /\/(get|post|put|patch|delete)\.(ts|js)$/i.test(filepath)
      return !hasMethodSuffix
    },
  })

  // Handle file additions
  watcher.on('add', (filepath: string) => {
    if (onEvent) {
      onEvent({
        type: 'add',
        filePath: path.resolve(watchPath, filepath),
      })
    }
  })

  // Handle file changes
  watcher.on('change', (filepath: string) => {
    if (onEvent) {
      onEvent({
        type: 'change',
        filePath: path.resolve(watchPath, filepath),
      })
    }
  })

  // Handle file deletions
  watcher.on('unlink', (filepath: string) => {
    if (onEvent) {
      onEvent({
        type: 'unlink',
        filePath: path.resolve(watchPath, filepath),
      })
    }
  })

  // Handle ready event (initial scan complete)
  watcher.on('ready', () => {
    if (onReady) {
      onReady()
    }
  })

  // Handle errors
  watcher.on('error', (err: unknown) => {
    const error = err instanceof Error ? err : new Error(String(err))
    if (onError) {
      onError(error)
    } else {
      // Default error handling - log to console
      console.error('File watcher error:', error)
    }
  })

  // Return watcher interface with close method
  return {
    close: async () => {
      await watcher.close()
    },
  }
}

/**
 * Sets up graceful shutdown handlers for the file watcher.
 * Ensures the watcher is properly closed on SIGINT and SIGTERM signals.
 *
 * @param watcher - The FileWatcher instance to manage
 * @param onShutdown - Optional callback to execute before shutdown
 */
export function setupGracefulShutdown(
  watcher: FileWatcher,
  onShutdown?: () => void,
): void {
  const shutdown = async (signal: string) => {
    console.info(`\n${signal} received. Shutting down gracefully...`)
    if (onShutdown) {
      onShutdown()
    }
    await watcher.close()
    process.exit(0)
  }

  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))
}
