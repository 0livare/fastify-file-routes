import chalk from 'chalk'
import pkg from '../../package.json'

export function help() {
  console.info('\n' + pkg.description + '\n')

  console.info(
    `${chalk.bold('Usage:')} ${chalk.bold.green('in')} ${chalk.cyan('[flags]')} [...<pkg>]`,
  )

  // Flags
  console.info(`\n${chalk.bold('Flags:')}`)
  console.info(
    `  ${chalk.cyan('-d')}, ${chalk.cyan('-D')}, ${chalk.cyan('--dev')}, ${chalk.cyan('--save-dev')}        Install pkg as a development dependency`,
  )
  console.info(
    `  ${chalk.cyan('-z')}, ${chalk.cyan('--frozen')}, ${chalk.cyan('--frozen-lockfile')}  Disallow changes to lockfile`,
  )
  console.info(
    `  ${chalk.cyan('-v')}, ${chalk.cyan('--version')}                    Print version number`,
  )
  console.info(
    `  ${chalk.cyan('-h')}, ${chalk.cyan('--help')}                       Print help information`,
  )

  // Examples
  console.info(`\n${chalk.bold('Examples:')}`)
  console.info(
    chalk.bold.green('  in'),
    '                   ',
    chalk.gray('Install all project dependencies'),
  )
  console.info(
    chalk.bold.green('  in express'),
    '           ',
    chalk.gray('Add a project dependency'),
  )
  console.info(
    chalk.bold.green('  in --dev nodemon'),
    '     ',
    chalk.gray('Add a project development dependency'),
  )
  console.info(
    chalk.bold.green('  in react immer axios'),
    ' ',
    chalk.gray('Add multiple project dependencies at once'),
  )
}
