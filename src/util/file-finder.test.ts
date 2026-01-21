import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {findFile, findFirstFile} from './file-finder'

const testDir = path.join(__dirname, '__test-fixtures__', 'file-finder')

beforeEach(() => {
  // Create test directory structure
  fs.mkdirSync(testDir, {recursive: true})
  fs.mkdirSync(path.join(testDir, 'subdir1'), {recursive: true})
  fs.mkdirSync(path.join(testDir, 'subdir2'), {recursive: true})
  fs.mkdirSync(path.join(testDir, 'subdir1', 'nested'), {recursive: true})
  fs.mkdirSync(path.join(testDir, 'node_modules'), {recursive: true})

  // Create test files
  fs.writeFileSync(path.join(testDir, 'config.ts'), '')
  fs.writeFileSync(path.join(testDir, 'config.js'), '')
  fs.writeFileSync(path.join(testDir, 'README.md'), '')
  fs.writeFileSync(path.join(testDir, 'index.ts'), '')
  fs.writeFileSync(path.join(testDir, 'subdir1', 'config.ts'), '')
  fs.writeFileSync(path.join(testDir, 'subdir1', 'index.js'), '')
  fs.writeFileSync(path.join(testDir, 'subdir1', 'nested', 'config.ts'), '')
  fs.writeFileSync(path.join(testDir, 'subdir2', 'server.ts'), '')
  fs.writeFileSync(path.join(testDir, 'node_modules', 'config.ts'), '')
})

afterEach(() => {
  // Clean up test directory
  fs.rmSync(testDir, {recursive: true, force: true})
})

describe('findFile', () => {
  it('should find all files with exact filename match', () => {
    const results = findFile({filename: 'config.ts', searchDir: testDir})

    expect(results).toHaveLength(3)
    expect(results.some((p) => p.endsWith('config.ts'))).toBe(true)
    expect(results.some((p) => p.includes('subdir1'))).toBe(true)
    expect(results.some((p) => p.includes('nested'))).toBe(true)
  })

  it('should exclude node_modules by default', () => {
    const results = findFile({filename: 'config.ts', searchDir: testDir})

    expect(results.every((p) => !p.includes('node_modules'))).toBe(true)
  })

  it('should respect maxDepth option', () => {
    const results = findFile({
      filename: 'config.ts',
      searchDir: testDir,
      options: {maxDepth: 0},
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toBe(path.join(testDir, 'config.ts'))
  })

  it('should respect maxDepth option for nested files', () => {
    const results = findFile({
      filename: 'config.ts',
      searchDir: testDir,
      options: {maxDepth: 1},
    })

    expect(results).toHaveLength(2)
    expect(results.some((p) => p.includes('nested'))).toBe(false)
  })

  it('should filter by extensions', () => {
    const results = findFile({
      filename: 'config',
      searchDir: testDir,
      options: {extensions: ['.ts']},
    })

    expect(results).toHaveLength(3)
    expect(results.every((p) => p.endsWith('.ts'))).toBe(true)
  })

  it('should handle multiple extensions', () => {
    const results = findFile({
      filename: 'config',
      searchDir: testDir,
      options: {extensions: ['.ts', '.js']},
    })

    expect(results).toHaveLength(4)
  })

  it('should be case-sensitive by default', () => {
    const results = findFile({filename: 'README.md', searchDir: testDir})

    expect(results).toHaveLength(1)
    expect(results[0]).toBe(path.join(testDir, 'README.md'))
  })

  it('should support case-insensitive matching', () => {
    const results = findFile({
      filename: 'readme.md',
      searchDir: testDir,
      options: {caseSensitive: false},
    })

    expect(results).toHaveLength(1) // README.md in root
    expect(results[0]).toBe(path.join(testDir, 'README.md'))
  })

  it('should respect excludeDirs option', () => {
    const results = findFile({
      filename: 'config.ts',
      searchDir: testDir,
      options: {excludeDirs: ['subdir1', 'node_modules']},
    })

    expect(results).toHaveLength(1)
    expect(results[0]).toBe(path.join(testDir, 'config.ts'))
  })

  it('should return empty array for non-existent directory', () => {
    const results = findFile({
      filename: 'config.ts',
      searchDir: '/non/existent/path',
    })

    expect(results).toEqual([])
  })

  it('should return empty array when no matches found', () => {
    const results = findFile({filename: 'nonexistent.ts', searchDir: testDir})

    expect(results).toEqual([])
  })

  it('should find files with extension in filename', () => {
    const results = findFile({
      filename: 'index',
      searchDir: testDir,
      options: {extensions: ['.ts', '.js']},
    })

    expect(results).toHaveLength(2)
  })
})

describe('findFirstFile', () => {
  it('should return first matching file', () => {
    const result = findFirstFile({filename: 'config.ts', searchDir: testDir})

    expect(result).not.toBeNull()
    expect(result).toContain('config.ts')
  })

  it('should return null when no matches found', () => {
    const result = findFirstFile({
      filename: 'nonexistent.ts',
      searchDir: testDir,
    })

    expect(result).toBeNull()
  })

  it('should work with options', () => {
    const result = findFirstFile({
      filename: 'config',
      searchDir: testDir,
      options: {extensions: ['.js']},
    })

    expect(result).not.toBeNull()
    expect(result).toContain('config.js')
  })

  it('should return null for non-existent directory', () => {
    const result = findFirstFile({
      filename: 'config.ts',
      searchDir: '/non/existent/path',
    })

    expect(result).toBeNull()
  })
})
