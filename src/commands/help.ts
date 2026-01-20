import chalk from 'chalk'

export function help() {
  console.info(chalk.bold.blue('🚀 Fastify Sync CLI'))
  console.info()
  console.info(
    chalk.gray(
      'Automatically synchronizes Fastify route URLs with their file paths.',
    ),
  )
  console.info()
  console.info(chalk.bold('Usage:'))
  console.info(
    '  fastify-sync              ' + chalk.gray('Watch src/api for changes'),
  )
  console.info(
    '  fastify-sync --help       ' + chalk.gray('Show this help message'),
  )
  console.info(
    '  fastify-sync -h           ' + chalk.gray('Show this help message'),
  )
  console.info(
    '  fastify-sync --version    ' + chalk.gray('Show version number'),
  )
  console.info(
    '  fastify-sync -v           ' + chalk.gray('Show version number'),
  )
  console.info(
    '  fastify-sync --verbose    ' +
      chalk.gray('Show detailed output during operation'),
  )
  console.info()
  console.info(chalk.bold('How it works:'))
  console.info(
    chalk.gray('  • Scans your src/api directory for Fastify route files'),
  )
  console.info(
    chalk.gray(
      '  • Automatically updates the "url" field to match the file path',
    ),
  )
  console.info(
    chalk.gray('  • Watches for file changes and keeps URLs in sync'),
  )
  console.info()
  console.info(chalk.bold('Routing conventions:'))
  console.info(
    chalk.gray(
      '  • src/api/users.get.ts              → url: "/api/users" (GET)',
    ),
  )
  console.info(
    chalk.gray(
      '  • src/api/users/$id.get.ts          → url: "/api/users/:id" (GET)',
    ),
  )
  console.info(
    chalk.gray(
      '  • src/api/users.$id.get.ts          → url: "/api/users/:id" (GET)',
    ),
  )
  console.info(
    chalk.gray(
      '  • src/api/users/index.post.ts       → url: "/api/users" (POST)',
    ),
  )
  console.info(
    chalk.gray(
      '  • src/api/_auth/login.post.ts       → url: "/api/login" (POST)',
    ),
  )
  console.info()
  console.info(chalk.bold('Supported HTTP methods:'))
  console.info(chalk.gray('  GET, POST, PUT, PATCH, DELETE'))
  console.info()
  console.info(chalk.bold('Examples:'))
  console.info(chalk.cyan('  # Start watching your API directory (quiet mode)'))
  console.info('  $ fastify-sync')
  console.info()
  console.info(chalk.cyan('  # Start watching with detailed output'))
  console.info('  $ fastify-sync --verbose')
  console.info()
  console.info(chalk.cyan('  # The CLI will:'))
  console.info(
    chalk.gray('  • Scan all route files and fix any incorrect URLs'),
  )
  console.info(chalk.gray('  • Watch for new/modified/deleted route files'))
  console.info(
    chalk.gray('  • Automatically update URLs when files are moved or renamed'),
  )
  console.info()
  console.info(chalk.bold('More info:'))
  console.info(chalk.gray('  https://github.com/0livare/fastify-file-routes'))
  console.info()
}
