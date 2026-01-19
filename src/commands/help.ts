import chalk from 'chalk'

export function help() {
  console.log(chalk.bold.blue('🚀 Fastify File-Based Routing CLI'))
  console.log()
  console.log(
    chalk.gray(
      'Automatically synchronizes Fastify route URLs with their file paths.',
    ),
  )
  console.log()
  console.log(chalk.bold('Usage:'))
  console.log('  ffr              ' + chalk.gray('Watch src/api for changes'))
  console.log('  ffr --help       ' + chalk.gray('Show this help message'))
  console.log('  ffr -h           ' + chalk.gray('Show this help message'))
  console.log('  ffr --version    ' + chalk.gray('Show version number'))
  console.log('  ffr -v           ' + chalk.gray('Show version number'))
  console.log(
    '  ffr --verbose    ' + chalk.gray('Show detailed output during operation'),
  )
  console.log()
  console.log(chalk.bold('How it works:'))
  console.log(
    chalk.gray('  • Scans your src/api directory for Fastify route files'),
  )
  console.log(
    chalk.gray(
      '  • Automatically updates the "url" field to match the file path',
    ),
  )
  console.log(chalk.gray('  • Watches for file changes and keeps URLs in sync'))
  console.log()
  console.log(chalk.bold('Routing conventions:'))
  console.log(
    chalk.gray('  • src/api/users.get.ts              → url: "/users" (GET)'),
  )
  console.log(
    chalk.gray(
      '  • src/api/users/$id.get.ts          → url: "/users/:id" (GET)',
    ),
  )
  console.log(
    chalk.gray('  • src/api/users/index.post.ts       → url: "/users" (POST)'),
  )
  console.log(
    chalk.gray('  • src/api/_auth/login.post.ts       → url: "/login" (POST)'),
  )
  console.log()
  console.log(chalk.bold('Supported HTTP methods:'))
  console.log(chalk.gray('  GET, POST, PUT, PATCH, DELETE'))
  console.log()
  console.log(chalk.bold('Examples:'))
  console.log(chalk.cyan('  # Start watching your API directory (quiet mode)'))
  console.log('  $ ffr')
  console.log()
  console.log(chalk.cyan('  # Start watching with detailed output'))
  console.log('  $ ffr --verbose')
  console.log()
  console.log(chalk.cyan('  # The CLI will:'))
  console.log(chalk.gray('  • Scan all route files and fix any incorrect URLs'))
  console.log(chalk.gray('  • Watch for new/modified/deleted route files'))
  console.log(
    chalk.gray('  • Automatically update URLs when files are moved or renamed'),
  )
  console.log()
  console.log(chalk.bold('More info:'))
  console.log(chalk.gray('  https://github.com/0livare/fastify-file-routes'))
  console.log()
}
