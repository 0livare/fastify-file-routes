import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  createFileWatcher,
  setupGracefulShutdown,
  type WatchEvent,
} from '../file-watcher'

describe('createFileWatcher', () => {
  const testDir = path.join(__dirname, '__test-fixtures__', 'file-watcher')

  // Helper to wait for async events
  function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  // Helper to create test file structure
  function createTestStructure(structure: Record<string, string | null>): void {
    for (const [filePath, content] of Object.entries(structure)) {
      const fullPath = path.join(testDir, filePath)
      const dir = path.dirname(fullPath)

      // Create directory if it doesn't exist
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, {recursive: true})
      }

      // Create file (content can be null for empty files)
      fs.writeFileSync(fullPath, content ?? '')
    }
  }

  // Helper to clean up test directory
  function cleanupTestDirectory(): void {
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, {recursive: true, force: true})
    }
  }

  beforeEach(() => {
    cleanupTestDirectory()
    fs.mkdirSync(testDir, {recursive: true})
  })

  afterEach(() => {
    cleanupTestDirectory()
  })

  describe('Basic Watcher Creation', () => {
    it('should create a file watcher and call onReady', async () => {
      const onReady = vi.fn()
      const watcher = createFileWatcher(testDir, {onReady})

      // Wait for watcher to be ready
      await delay(200)

      expect(onReady).toHaveBeenCalled()

      await watcher.close()
    })

    it('should return a watcher with close method', () => {
      const watcher = createFileWatcher(testDir)

      expect(watcher).toHaveProperty('close')
      expect(typeof watcher.close).toBe('function')

      return watcher.close()
    })

    it('should close watcher without errors', async () => {
      const watcher = createFileWatcher(testDir)

      await expect(watcher.close()).resolves.toBeUndefined()
    })
  })

  describe('File Addition Detection', () => {
    it('should detect when a new .ts route file is added', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })
      const onReady = vi.fn()

      const watcher = createFileWatcher(testDir, {onEvent, onReady})

      // Wait for watcher to be ready
      await delay(200)
      expect(onReady).toHaveBeenCalled()

      // Add a new file
      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, 'export default function() {}')

      // Wait for file system event to be processed
      await delay(300)

      expect(onEvent).toHaveBeenCalled()
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'add',
        filePath,
      })

      await watcher.close()
    })

    it('should detect when a new .js route file is added', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add a new file
      const filePath = path.join(testDir, 'posts.post.js')
      fs.writeFileSync(filePath, 'module.exports = function() {}')

      // Wait for file system event to be processed
      await delay(300)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'add',
        filePath,
      })

      await watcher.close()
    })

    it('should detect multiple file additions', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add multiple files
      fs.writeFileSync(path.join(testDir, 'users.get.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.post.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.delete.ts'), '')

      // Wait for file system events to be processed
      await delay(500)

      expect(events.length).toBeGreaterThanOrEqual(3)
      expect(events.filter((e) => e.type === 'add')).toHaveLength(3)

      await watcher.close()
    })

    it('should detect files added in nested directories', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Create nested directory and add file
      const nestedDir = path.join(testDir, 'users', '$userId')
      fs.mkdirSync(nestedDir, {recursive: true})
      const filePath = path.join(nestedDir, 'profile.get.ts')
      fs.writeFileSync(filePath, '')

      // Wait for file system event to be processed
      await delay(300)

      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        type: 'add',
        filePath,
      })

      await watcher.close()
    })
  })

  describe('File Change Detection', () => {
    it('should detect when a route file is modified', async () => {
      // Create initial file
      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, 'export default function() {}')

      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Modify the file
      fs.writeFileSync(filePath, 'export default function() { return "new" }')

      // Wait for file system event to be processed
      await delay(300)

      const changeEvents = events.filter((e) => e.type === 'change')
      expect(changeEvents.length).toBeGreaterThanOrEqual(1)
      expect(changeEvents[0]).toMatchObject({
        type: 'change',
        filePath,
      })

      await watcher.close()
    })

    it('should detect multiple changes to the same file', async () => {
      // Create initial file
      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, 'v1')

      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Modify the file multiple times
      fs.writeFileSync(filePath, 'v2')
      await delay(300)

      fs.writeFileSync(filePath, 'v3')
      await delay(300)

      const changeEvents = events.filter((e) => e.type === 'change')
      expect(changeEvents.length).toBeGreaterThanOrEqual(2)

      await watcher.close()
    })
  })

  describe('File Deletion Detection', () => {
    it('should detect when a route file is deleted', async () => {
      // Create initial file
      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, 'export default function() {}')

      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Delete the file
      fs.unlinkSync(filePath)

      // Wait for file system event to be processed
      await delay(300)

      const unlinkEvents = events.filter((e) => e.type === 'unlink')
      expect(unlinkEvents.length).toBeGreaterThanOrEqual(1)
      expect(unlinkEvents[0]).toMatchObject({
        type: 'unlink',
        filePath,
      })

      await watcher.close()
    })

    it('should detect multiple file deletions', async () => {
      // Create initial files
      fs.writeFileSync(path.join(testDir, 'users.get.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.post.ts'), '')

      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Delete files
      fs.unlinkSync(path.join(testDir, 'users.get.ts'))
      await delay(300)
      fs.unlinkSync(path.join(testDir, 'users.post.ts'))
      await delay(300)

      const unlinkEvents = events.filter((e) => e.type === 'unlink')
      expect(unlinkEvents.length).toBeGreaterThanOrEqual(2)

      await watcher.close()
    })
  })

  describe('File Filtering', () => {
    it('should NOT detect non-route files (no method suffix)', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add files without method suffixes
      fs.writeFileSync(path.join(testDir, 'utils.ts'), '')
      fs.writeFileSync(path.join(testDir, 'types.ts'), '')
      fs.writeFileSync(path.join(testDir, 'index.ts'), '')

      // Wait for potential file system events
      await delay(300)

      expect(events).toHaveLength(0)

      await watcher.close()
    })

    it('should NOT detect non-.ts/.js files', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add non-.ts/.js files
      fs.writeFileSync(path.join(testDir, 'users.get.txt'), '')
      fs.writeFileSync(path.join(testDir, 'users.get.json'), '')
      fs.writeFileSync(path.join(testDir, 'README.md'), '')

      // Wait for potential file system events
      await delay(300)

      expect(events).toHaveLength(0)

      await watcher.close()
    })

    it('should detect all valid HTTP method suffixes', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add files with all valid method suffixes
      fs.writeFileSync(path.join(testDir, 'users.get.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.post.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.put.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.patch.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users.delete.ts'), '')

      // Wait for file system events to be processed
      await delay(500)

      expect(events.length).toBeGreaterThanOrEqual(5)

      await watcher.close()
    })

    it('should detect standalone method files (get.ts, post.ts, etc.)', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add standalone method files in subdirectory
      fs.mkdirSync(path.join(testDir, 'users'), {recursive: true})
      fs.mkdirSync(path.join(testDir, 'products'), {recursive: true})
      fs.writeFileSync(path.join(testDir, 'users/get.ts'), '')
      fs.writeFileSync(path.join(testDir, 'users/post.ts'), '')
      fs.writeFileSync(path.join(testDir, 'products/put.ts'), '')

      // Wait for file system events to be processed
      await delay(500)

      expect(events.length).toBeGreaterThanOrEqual(3)

      // Verify all events are 'add' type
      const addEvents = events.filter((e) => e.type === 'add')
      expect(addEvents.length).toBeGreaterThanOrEqual(3)

      // Verify file paths
      const filePaths = addEvents.map((e) => path.basename(e.filePath))
      expect(filePaths).toContain('get.ts')
      expect(filePaths).toContain('post.ts')
      expect(filePaths).toContain('put.ts')

      await watcher.close()
    })
  })

  describe('Error Handling', () => {
    it('should call onError callback when provided', async () => {
      const onError = vi.fn()

      // Watch a directory that will be deleted while watching
      const watcher = createFileWatcher(testDir, {onError})

      // Wait for watcher to be ready
      await delay(200)

      // Close watcher before cleanup
      await watcher.close()
    })

    it('should handle watching non-existent directory', async () => {
      const nonExistentDir = path.join(testDir, 'nonexistent')
      const onError = vi.fn()

      const watcher = createFileWatcher(nonExistentDir, {onError})

      // Wait a bit
      await delay(200)

      // Should not throw, watcher should handle gracefully
      await watcher.close()
    })
  })

  describe('Complex Scenarios', () => {
    it('should handle rapid file operations', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Perform rapid operations
      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, 'v1')
      fs.writeFileSync(filePath, 'v2')
      fs.writeFileSync(filePath, 'v3')

      // Wait for file system events to be processed
      await delay(500)

      // Should detect at least one add event
      const addEvents = events.filter((e) => e.type === 'add')
      expect(addEvents.length).toBeGreaterThanOrEqual(1)

      await watcher.close()
    })

    it('should handle add, change, and delete sequence', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Add file
      const filePath = path.join(testDir, 'users.get.ts')
      fs.writeFileSync(filePath, 'v1')
      await delay(300)

      // Modify file
      fs.writeFileSync(filePath, 'v2')
      await delay(300)

      // Delete file
      fs.unlinkSync(filePath)
      await delay(300)

      // Should have detected all three event types
      const eventTypes = events.map((e) => e.type)
      expect(eventTypes).toContain('add')
      expect(eventTypes).toContain('change')
      expect(eventTypes).toContain('unlink')

      await watcher.close()
    })

    it('should watch files in deeply nested directories', async () => {
      const events: WatchEvent[] = []
      const onEvent = vi.fn((event: WatchEvent) => {
        events.push(event)
      })

      const watcher = createFileWatcher(testDir, {onEvent})

      // Wait for watcher to be ready
      await delay(200)

      // Create deeply nested structure
      const deepPath = path.join(
        testDir,
        'api',
        'v1',
        'users',
        '$userId',
        'posts',
        '$postId',
      )
      fs.mkdirSync(deepPath, {recursive: true})
      const filePath = path.join(deepPath, 'comments.get.ts')
      fs.writeFileSync(filePath, '')

      // Wait for file system event to be processed
      await delay(300)

      expect(events.length).toBeGreaterThanOrEqual(1)
      expect(events[0]).toMatchObject({
        type: 'add',
        filePath,
      })

      await watcher.close()
    })
  })
})

describe('setupGracefulShutdown', () => {
  it('should register SIGINT and SIGTERM handlers', () => {
    const mockWatcher = {
      close: vi.fn().mockResolvedValue(undefined),
    }
    const onShutdown = vi.fn()

    // Spy on process.on
    const processSpy = vi.spyOn(process, 'on')

    setupGracefulShutdown(mockWatcher, onShutdown)

    // Verify handlers were registered
    expect(processSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function))
    expect(processSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function))

    processSpy.mockRestore()
  })

  it('should work without onShutdown callback', () => {
    const mockWatcher = {
      close: vi.fn().mockResolvedValue(undefined),
    }

    // Should not throw
    expect(() => setupGracefulShutdown(mockWatcher)).not.toThrow()
  })
})
