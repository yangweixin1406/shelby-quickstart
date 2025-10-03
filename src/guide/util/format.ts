import chalk from "chalk"

export function cmd(command: string): string {
	return chalk.bgMagenta.black(` ${command} `)
}

export function url(url: string): string {
	return chalk.cyan(url)
}
