import {describe, it, expect, beforeEach, afterEach} from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import {
  generateBrunoRequest,
  generateFolderBru,
  mapRouteToBrunoPath,
  ensureFolderBruFiles,
  createBrunoRequest,
} from '../bruno-generator'

const testDir = path.join(__dirname, '__test-fixtures__', 'bruno-generator')
const brunoDir = path.join(testDir, 'bruno')

beforeEach(() => {
  // Create test directory structure
  fs.mkdirSync(testDir, {recursive: true})
  fs.mkdirSync(brunoDir, {recursive: true})
})

afterEach(() => {
  // Clean up test directory
  fs.rmSync(testDir, {recursive: true, force: true})
})

describe('generateBrunoRequest', () => {
  it('should generate a GET request', () => {
    const result = generateBrunoRequest('GET', '/api/users')

    expect(result).toContain('meta {')
    expect(result).toContain('name: get users')
    expect(result).toContain('type: http')
    expect(result).toContain('get {')
    expect(result).toContain('url: {{appUrl}}/api/users')
    expect(result).toContain('body: none')
    expect(result).toContain('auth: inherit')
  })

  it('should generate a POST request with body section', () => {
    const result = generateBrunoRequest('POST', '/api/users')

    expect(result).toContain('post {')
    expect(result).toContain('body:json {')
  })

  it('should generate a PUT request with body section', () => {
    const result = generateBrunoRequest('PUT', '/api/users/:id')

    expect(result).toContain('put {')
    expect(result).toContain('body:json {')
    expect(result).toContain('url: {{appUrl}}/api/users/{{id}}')
  })

  it('should generate a PATCH request with body section', () => {
    const result = generateBrunoRequest('PATCH', '/api/users/:id')

    expect(result).toContain('patch {')
    expect(result).toContain('body:json {')
    expect(result).toContain('url: {{appUrl}}/api/users/{{id}}')
  })

  it('should generate a DELETE request without body section', () => {
    const result = generateBrunoRequest('DELETE', '/api/users/:id')

    expect(result).toContain('delete {')
    expect(result).not.toContain('body:json {')
    expect(result).toContain('url: {{appUrl}}/api/users/{{id}}')
  })

  it('should derive name from URL with parameters', () => {
    const result = generateBrunoRequest('GET', '/api/users/:id')

    expect(result).toContain('name: get users')
    expect(result).toContain('url: {{appUrl}}/api/users/{{id}}')
  })

  it('should handle custom name', () => {
    const result = generateBrunoRequest('GET', '/api/users', 'List All Users')

    expect(result).toContain('name: List All Users')
  })

  it('should handle root path', () => {
    const result = generateBrunoRequest('GET', '/api')

    expect(result).toContain('name: get')
  })

  it('should handle kebab-case URLs', () => {
    const result = generateBrunoRequest('GET', '/api/user-profiles')

    expect(result).toContain('name: get user profiles')
  })
})

describe('generateFolderBru', () => {
  it('should generate folder.bru content', () => {
    const result = generateFolderBru('/users')

    expect(result).toContain('meta {')
    expect(result).toContain('name: /users')
    expect(result).toContain('auth {')
    expect(result).toContain('mode: inherit')
  })

  it('should handle nested folder names', () => {
    const result = generateFolderBru('/api/v1/users')

    expect(result).toContain('name: /api/v1/users')
  })
})

describe('mapRouteToBrunoPath', () => {
  it('should map simple route to Bruno path', () => {
    const routePath = path.join(testDir, 'src/api/users.get.ts')
    const {brunoDir: dir, brunoFilePath} = mapRouteToBrunoPath(
      routePath,
      brunoDir,
      'GET',
      '/api/users',
    )

    expect(dir).toBe(brunoDir)
    expect(brunoFilePath).toBe(path.join(brunoDir, 'get users.bru'))
  })

  it('should map nested route to Bruno path', () => {
    const routePath = path.join(testDir, 'src/api/users/$id.get.ts')
    const {brunoDir: dir, brunoFilePath} = mapRouteToBrunoPath(
      routePath,
      brunoDir,
      'GET',
      '/api/users/:id',
    )

    expect(dir).toBe(path.join(brunoDir, 'users'))
    expect(brunoFilePath).toBe(path.join(brunoDir, 'users', 'get users.bru'))
  })

  it('should handle deeply nested routes', () => {
    const routePath = path.join(testDir, 'src/api/v1/users/profile.get.ts')
    const {brunoDir: dir, brunoFilePath} = mapRouteToBrunoPath(
      routePath,
      brunoDir,
      'GET',
      '/api/v1/users/profile',
    )

    expect(dir).toBe(path.join(brunoDir, 'v1', 'users'))
    expect(brunoFilePath).toBe(
      path.join(brunoDir, 'v1', 'users', 'get v1 users profile.bru'),
    )
  })

  it('should throw error for non-api routes', () => {
    const routePath = path.join(testDir, 'src/other/users.get.ts')

    expect(() =>
      mapRouteToBrunoPath(routePath, brunoDir, 'GET', '/users'),
    ).toThrow('Route file must be under src/api directory')
  })
})

describe('ensureFolderBruFiles', () => {
  it('should create folder.bru files for nested directories', () => {
    const targetDir = path.join(brunoDir, 'users', 'profile')

    ensureFolderBruFiles(targetDir, brunoDir)

    // Check that directories were created
    expect(fs.existsSync(path.join(brunoDir, 'users'))).toBe(true)
    expect(fs.existsSync(targetDir)).toBe(true)

    // Check that folder.bru files were created
    const usersFolderBru = path.join(brunoDir, 'users', 'folder.bru')
    const profileFolderBru = path.join(targetDir, 'folder.bru')

    expect(fs.existsSync(usersFolderBru)).toBe(true)
    expect(fs.existsSync(profileFolderBru)).toBe(true)

    // Verify content
    const usersContent = fs.readFileSync(usersFolderBru, 'utf-8')
    expect(usersContent).toContain('name: /users')

    const profileContent = fs.readFileSync(profileFolderBru, 'utf-8')
    expect(profileContent).toContain('name: /users/profile')
  })

  it('should not create folder.bru at collection root', () => {
    ensureFolderBruFiles(brunoDir, brunoDir)

    const rootFolderBru = path.join(brunoDir, 'folder.bru')
    expect(fs.existsSync(rootFolderBru)).toBe(false)
  })

  it('should not overwrite existing folder.bru files', () => {
    const targetDir = path.join(brunoDir, 'users')
    fs.mkdirSync(targetDir, {recursive: true})

    const folderBruPath = path.join(targetDir, 'folder.bru')
    fs.writeFileSync(folderBruPath, 'custom content', 'utf-8')

    ensureFolderBruFiles(targetDir, brunoDir)

    const content = fs.readFileSync(folderBruPath, 'utf-8')
    expect(content).toBe('custom content')
  })
})

describe('createBrunoRequest', () => {
  it('should create Bruno request file with proper structure', () => {
    const routePath = path.join(testDir, 'src/api/users.get.ts')

    createBrunoRequest(routePath, brunoDir, 'GET', '/api/users')

    const brunoFile = path.join(brunoDir, 'get users.bru')
    expect(fs.existsSync(brunoFile)).toBe(true)

    const content = fs.readFileSync(brunoFile, 'utf-8')
    expect(content).toContain('name: get users')
    expect(content).toContain('get {')
    expect(content).toContain('url: {{appUrl}}/api/users')
  })

  it('should create nested structure with folder.bru files', () => {
    const routePath = path.join(testDir, 'src/api/users/$id.get.ts')

    createBrunoRequest(routePath, brunoDir, 'GET', '/api/users/:id')

    // Check directory structure
    const usersDir = path.join(brunoDir, 'users')
    expect(fs.existsSync(usersDir)).toBe(true)

    // Check folder.bru
    const folderBru = path.join(usersDir, 'folder.bru')
    expect(fs.existsSync(folderBru)).toBe(true)

    // Check request file
    const brunoFile = path.join(usersDir, 'get users.bru')
    expect(fs.existsSync(brunoFile)).toBe(true)

    const content = fs.readFileSync(brunoFile, 'utf-8')
    expect(content).toContain('name: get users')
    expect(content).toContain('url: {{appUrl}}/api/users/{{id}}')
  })

  it('should handle POST requests', () => {
    const routePath = path.join(testDir, 'src/api/users.post.ts')

    createBrunoRequest(routePath, brunoDir, 'POST', '/api/users')

    const brunoFile = path.join(brunoDir, 'create users.bru')
    const content = fs.readFileSync(brunoFile, 'utf-8')

    expect(content).toContain('post {')
    expect(content).toContain('body:json {')
  })

  it('should handle method-only file names (put.ts)', () => {
    const routePath = path.join(testDir, 'src/api/users/put.ts')

    createBrunoRequest(routePath, brunoDir, 'PUT', '/api/users')

    // File path has users/put, so Bruno goes into users/ subdirectory
    const usersDir = path.join(brunoDir, 'users')
    const brunoFile = path.join(usersDir, 'overwrite users.bru')
    expect(fs.existsSync(brunoFile)).toBe(true)

    const content = fs.readFileSync(brunoFile, 'utf-8')
    expect(content).toContain('name: overwrite users')
    expect(content).toContain('put {')
    expect(content).toContain('url: {{appUrl}}/api/users')
  })

  it('should treat get.ts and index.get.ts the same URL', () => {
    // Test with get.ts - file at products/get.ts
    const getPath = path.join(testDir, 'src/api/products/get.ts')
    createBrunoRequest(getPath, brunoDir, 'GET', '/api/products')

    // Test with index.get.ts - file at orders/index.get.ts
    const indexGetPath = path.join(testDir, 'src/api/orders/index.get.ts')
    createBrunoRequest(indexGetPath, brunoDir, 'GET', '/api/orders')

    // Both map to same URL but different file locations result in same directory structure
    const productsFile = path.join(brunoDir, 'products', 'get products.bru')
    const ordersFile = path.join(brunoDir, 'orders', 'get orders.bru')

    expect(fs.existsSync(productsFile)).toBe(true)
    expect(fs.existsSync(ordersFile)).toBe(true)

    const productsContent = fs.readFileSync(productsFile, 'utf-8')
    const ordersContent = fs.readFileSync(ordersFile, 'utf-8')

    expect(productsContent).toContain('name: get products')
    expect(ordersContent).toContain('name: get orders')
  })
})
