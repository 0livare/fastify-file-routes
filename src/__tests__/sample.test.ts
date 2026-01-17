import {describe, it, expect} from 'vitest'

describe('Sample test suite', () => {
  it('should pass a basic test', () => {
    expect(1 + 1).toBe(2)
  })

  it('should verify string equality', () => {
    expect('hello').toBe('hello')
  })
})
