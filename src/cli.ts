import {parseArgs} from 'util'
import chalk from 'chalk'

export function parseCliArgs() {
  let args
  try {
    args = parseArgs({
      args: Bun.argv.slice(2), // Skip bun executable and script path
      options: {
        help: {type: 'boolean', short: 'h'},
        quiet: {type: 'boolean', short: 'q'},
      },
      strict: true,
      allowPositionals: false,
    })
  } catch (e: any) {
    console.error(chalk.red(e.message))
    process.exit(1)
  }

  return args.values
}
