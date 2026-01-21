import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import {extractPrefixFromServerFile} from '../filepath/prefix-parser'
import {existsSync, mkdirSync, writeFileSync, rmSync} from 'fs'
import {resolve} from 'path'

const TEST_DIR = resolve('test-temp-prefix-parser')

describe('extractPrefixFromServerFile', () => {
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

  it('should extract prefix from fastify.register with nested options.prefix', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'
import autoLoad from '@fastify/autoload'
import path from 'path'

const fastify = Fastify()

fastify.register(autoLoad, {
  dir: path.join(import.meta.dirname, 'api'),
  options: { prefix: '/api' }
})

export default fastify
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/api')
  })

  it('should extract prefix from fastify.register with direct prefix', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'
import autoLoad from '@fastify/autoload'

const fastify = Fastify()

fastify.register(autoLoad, {
  prefix: '/v1/api'
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/v1/api')
  })

  it('should handle single quotes', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: '/api' }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/api')
  })

  it('should handle double quotes', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from "fastify"

const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: "/api/v2" }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/api/v2')
  })

  it('should handle template literals', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: \`/api\` }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/api')
  })

  it('should return null when prefix is not found', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'
import autoLoad from '@fastify/autoload'

const fastify = Fastify()

fastify.register(autoLoad, {
  dir: path.join(import.meta.dirname, 'api')
})

export default fastify
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe(null)
  })

  it('should return null when file does not exist', () => {
    const result = extractPrefixFromServerFile(`${TEST_DIR}/nonexistent.ts`)
    expect(result).toBe(null)
  })

  it('should return null for malformed code', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

// Incomplete register call
fastify.register(
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe(null)
  })

  it('should return null when prefix is a variable (not a literal)', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const apiPrefix = '/api'
const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: apiPrefix }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe(null)
  })

  it('should handle multiple register calls and return first prefix', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: '/api' }
})

fastify.register(otherPlugin, {
  options: { prefix: '/admin' }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/api')
  })

  it('should handle empty prefix string', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: '' }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('')
  })

  it('should handle prefix with no leading slash', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

fastify.register(autoLoad, {
  options: { prefix: 'api' }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('api')
  })

  it('should handle complex nested options', () => {
    const serverFile = `${TEST_DIR}/server.ts`
    const content = `
import Fastify from 'fastify'

const fastify = Fastify()

fastify.register(autoLoad, {
  dir: path.join(import.meta.dirname, 'api'),
  maxDepth: 3,
  options: {
    prefix: '/v1',
    logLevel: 'info'
  }
})
    `
    writeFileSync(serverFile, content)

    const result = extractPrefixFromServerFile(serverFile)
    expect(result).toBe('/v1')
  })
})
