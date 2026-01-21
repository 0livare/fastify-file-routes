import {findFile, findFirstFile} from '../src/util/file-finder'

// Example 1: Find all files named "config.ts" in the src directory
console.log('Example 1: Find all config.ts files')
const configFiles = findFile('config.ts', 'src')
console.log('Found files:', configFiles)

// Example 2: Find the first occurrence of "index.ts"
console.log('\nExample 2: Find first index.ts file')
const firstIndex = findFirstFile('index.ts', 'src')
console.log('First index.ts:', firstIndex)

// Example 3: Find all TypeScript files named "index" (with extension filter)
console.log('\nExample 3: Find all index files with .ts extension')
const indexTsFiles = findFile('index', 'src', {
  extensions: ['.ts'],
})
console.log('Found files:', indexTsFiles)

// Example 4: Find files with limited depth
console.log('\nExample 4: Find config.ts files only 2 levels deep')
const shallowConfig = findFile('config.ts', 'src', {
  maxDepth: 2,
})
console.log('Found files:', shallowConfig)

// Example 5: Case-insensitive search
console.log('\nExample 5: Case-insensitive search for README')
const readmeFiles = findFile('readme.md', '.', {
  caseSensitive: false,
  maxDepth: 1,
})
console.log('Found files:', readmeFiles)

// Example 6: Exclude specific directories
console.log('\nExample 6: Find config files, excluding test directories')
const nonTestConfigs = findFile('config', 'src', {
  extensions: ['.ts', '.js'],
  excludeDirs: ['__tests__', 'node_modules', 'dist'],
})
console.log('Found files:', nonTestConfigs)

// Example 7: Search for multiple file types
console.log('\nExample 7: Find all route files (TypeScript and JavaScript)')
const routeFiles = findFile('route', 'src', {
  extensions: ['.ts', '.js', '.tsx', '.jsx'],
})
console.log('Found files:', routeFiles)
