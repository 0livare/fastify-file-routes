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
  console.info(
    '  fastify-sync --bruno      ' +
      chalk.gray(
        'Auto-generate Bruno API request files when a new Fastify route is created',
      ),
  )
  console.info(
    '  fastify-sync --template FILE  ' +
      chalk.gray('Use custom template file for new routes'),
  )
  console.info(
    '  fastify-sync -t FILE          ' +
      chalk.gray('Use custom template file for new routes'),
  )
  console.info()
  console.info(chalk.bold('How it works:'))
  gray(
    '  • Scans your src/api directory for Fastify route files. Auto-fixing any URL mismatches.',
  )
  gray('  • Automatically updates `url` and `method` to match the file path')
  gray('  • Watches for file changes and keeps URLs in sync')
  console.info()
  console.info(chalk.bold('Custom Templates:'))
  gray('  • Use --template or -t to point to an existing route file')
  gray('  • The tool copies the template and replaces method/URL values')
  gray('  • Relative imports are automatically adjusted')
  gray('  • Example: fastify-sync --template ./src/api/users/example.get.ts')
  console.info()
  console.info(chalk.bold('Routing conventions:'))
  gray('  • src/api/users.get.ts              → url: "/api/users" (GET)')
  gray('  • src/api/users/$id.get.ts          → url: "/api/users/:id" (GET)')
  gray('  • src/api/users.$id.get.ts          → url: "/api/users/:id" (GET)')
  gray('  • src/api/users/index.post.ts       → url: "/api/users" (POST)')
  gray('  • src/api/users/post.ts             → url: "/api/users" (POST)')
  gray('  • src/api/_auth/login.post.ts       → url: "/api/login" (POST)')
  console.info()
  console.info(chalk.bold('Supported HTTP methods:'))
  console.info('  GET, POST, PUT, PATCH, DELETE')
  console.info()
  console.info()
  console.info(chalk.bold('More info:'))
  console.info(chalk.gray('  https://github.com/0livare/fastify-file-routes'))
  console.info('\n')
}

function gray(text: string) {
  console.info(chalk.gray(text))
}
