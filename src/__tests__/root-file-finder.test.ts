import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {findRootServerFile} from '../root-file-finder'
import {existsSync, mkdirSync, writeFileSync, rmSync} from 'fs'
import {resolve} from 'path'

const TEST_DIR = resolve('test-temp-root-finder')

describe('findRootServerFile', () => {
  beforeEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, {recursive: true, force: true})
    }
    mkdirSync(TEST_DIR, {recursive: true})
  })

  afterEach(() => {
    if (existsSync(TEST_DIR)) {
      rmSync(TEST_DIR, {recursive: true, force: true})
    }
  })

  it('should find custom path with .ts extension', () => {
    const customPath = `${TEST_DIR}/custom-server`
    writeFileSync(`${customPath}.ts`, 'export default {}')

    const result = findRootServerFile(customPath)
    expect(result).toBe(`${customPath}.ts`)
  })

  it('should find custom path with .js extension', () => {
    const customPath = `${TEST_DIR}/custom-server`
    writeFileSync(`${customPath}.js`, 'export default {}')

    const result = findRootServerFile(customPath)
    expect(result).toBe(`${customPath}.js`)
  })

  it('should return null when custom path does not exist', () => {
    const result = findRootServerFile(`${TEST_DIR}/nonexistent`)
    expect(result).toBe(null)
  })

  it('should check default fallback order: src/server, src/main, src/index', () => {
    // Create only src/main.ts
    mkdirSync('src', {recursive: true})
    writeFileSync('src/main.ts', 'export default {}')

    const result = findRootServerFile()
    expect(result).toBe(resolve('src/main.ts'))

    // Cleanup
    rmSync('src/main.ts')
  })

  it('should prioritize src/server over src/main and src/index', () => {
    mkdirSync('src', {recursive: true})
    writeFileSync('src/server.ts', 'export default {}')
    writeFileSync('src/main.ts', 'export default {}')
    writeFileSync('src/index.ts', 'export default {}')

    const result = findRootServerFile()
    expect(result).toBe(resolve('src/server.ts'))

    // Cleanup
    rmSync('src/server.ts')
    rmSync('src/main.ts')
    rmSync('src/index.ts')
  })

  it('should return null when no default files exist', () => {
    const result = findRootServerFile()
    expect(result).toBe(null)
  })

  it('should support .mjs extension', () => {
    const customPath = `${TEST_DIR}/server`
    writeFileSync(`${customPath}.mjs`, 'export default {}')

    const result = findRootServerFile(customPath)
    expect(result).toBe(`${customPath}.mjs`)
  })

  it('should support .cjs extension', () => {
    const customPath = `${TEST_DIR}/server`
    writeFileSync(`${customPath}.cjs`, 'module.exports = {}')

    const result = findRootServerFile(customPath)
    expect(result).toBe(`${customPath}.cjs`)
  })

  it('should prioritize .ts over other extensions', () => {
    const customPath = `${TEST_DIR}/server`
    writeFileSync(`${customPath}.ts`, 'export default {}')
    writeFileSync(`${customPath}.js`, 'export default {}')

    const result = findRootServerFile(customPath)
    expect(result).toBe(`${customPath}.ts`)
  })
})
