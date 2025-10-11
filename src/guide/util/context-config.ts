import { confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import type { ShelbyConfig } from "./types"

export default async function contextConfig(config: ShelbyConfig): Promise<
	| {
			context_name: string
			network: string
	  }
	| undefined
> {
	const contexts = config.contexts || {}
	const contextNames = Object.keys(contexts)
	if (!contextNames || contextNames.length === 0) {
		return undefined
	}
	const defaultContext = config.default_context || undefined
	const defaultContextExists =
		defaultContext && contextNames.includes(defaultContext)
	if (defaultContextExists) {
		const useDefault = await confirm({
			message: `Would you like to use the default ${chalk.cyan(defaultContext)} context from Shelby CLI config?`,
			default: true,
		})
		if (useDefault) {
			const context = contexts[defaultContext]
			return {
				context_name: defaultContext,
				network: context.aptos_network,
			}
		}
	}
	const choices = contextNames.map((name) => ({
		name: chalk.bold(name),
		value: name,
	}))
	const selected = await select({
		message: "Which Shelby context would you like to use?",
		choices,
	})
	return {
		context_name: selected,
		network: contexts[selected].aptos_network,
	}
}
