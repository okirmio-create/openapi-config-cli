import chalk from 'chalk';

export function success(msg: string): void {
  console.log(chalk.green('✓') + ' ' + msg);
}

export function error(msg: string): void {
  console.error(chalk.red('✗') + ' ' + chalk.red(msg));
}

export function info(msg: string): void {
  console.log(chalk.cyan('ℹ') + ' ' + msg);
}

export function warn(msg: string): void {
  console.log(chalk.yellow('⚠') + ' ' + chalk.yellow(msg));
}

export function header(msg: string): void {
  console.log(chalk.bold.blue('\n' + msg));
}

export function detail(key: string, value: string): void {
  console.log('  ' + chalk.gray(key + ':') + ' ' + value);
}

export function listItem(msg: string): void {
  console.log(chalk.gray('  •') + ' ' + msg);
}
