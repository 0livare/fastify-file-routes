import {describe, it, expect} from 'vitest'
import path from 'node:path'
import {transformImportPaths} from '../util/import-transformer'

describe('transformImportPaths', () => {
  it('should transform single relative import with ./', () => {
    const content = `import {foo} from './utils'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/utils'`)
  })

  it('should transform parent directory imports with ../', () => {
    const content = `import {bar} from '../helpers/bar'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../helpers/bar'`)
  })

  it('should not transform absolute package imports', () => {
    const content = `import {fastify} from 'fastify'`
    const result = transformImportPaths(content, '/a', '/b')
    expect(result).toBe(content)
  })

  it('should not transform scoped package imports', () => {
    const content = `import {foo} from '@scope/package'`
    const result = transformImportPaths(content, '/a', '/b')
    expect(result).toBe(content)
  })

  it('should handle multiple imports on separate lines', () => {
    const content = `import {foo} from './foo'
import {bar} from './bar'
import {baz} from 'package'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/foo'`)
    expect(result).toContain(`from '../../templates/bar'`)
    expect(result).toContain(`from 'package'`)
  })

  it('should preserve import formatting and whitespace', () => {
    const content = `import  {  foo  }  from  './utils'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    // Should preserve whitespace around import statement
    expect(result).toMatch(/import\s+\{\s+foo\s+\}\s+from/)
  })

  it('should handle default imports', () => {
    const content = `import foo from './foo'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/foo'`)
  })

  it('should handle namespace imports', () => {
    const content = `import * as utils from './utils'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/utils'`)
  })

  it('should handle mixed imports', () => {
    const content = `import React, {useState} from './react-wrapper'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/react-wrapper'`)
  })

  it('should handle type imports', () => {
    const content = `import type {Foo} from './types'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/types'`)
  })

  it('should transform paths when going deeper into directory structure', () => {
    const content = `import {foo} from './foo'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api/users/profile'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../../../templates/foo'`)
  })

  it('should transform paths when template is deeper than target', () => {
    const content = `import {foo} from './foo'`
    const templateDir = '/project/src/templates/advanced'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../templates/advanced/foo'`)
  })

  it('should handle single quotes', () => {
    const content = `import {foo} from './foo'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/foo'`)
  })

  it('should handle double quotes', () => {
    const content = `import {foo} from "./foo"`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from "../../templates/foo"`)
  })

  it('should preserve file extensions in imports', () => {
    const content = `import {foo} from './foo.js'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api'

    const result = transformImportPaths(content, templateDir, targetDir)
    expect(result).toContain(`from '../../templates/foo.js'`)
  })

  it('should handle complex real-world scenario', () => {
    const content = `import type { FastifyInstance } from 'fastify'
import {validator} from '../utils/validator'
import {logger} from './logger'
import * as helpers from '../helpers'`
    const templateDir = '/project/templates'
    const targetDir = '/project/src/api/users'

    const result = transformImportPaths(content, templateDir, targetDir)

    // fastify import should remain unchanged
    expect(result).toContain(`from 'fastify'`)
    // ../utils/validator should be transformed
    expect(result).toContain(`from '../../../utils/validator'`)
    // ./logger should be transformed
    expect(result).toContain(`from '../../../templates/logger'`)
    // ../helpers should be transformed
    expect(result).toContain(`from '../../../helpers'`)
  })
})
