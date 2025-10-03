import { confirm, select } from "@inquirer/prompts"
import chalk from "chalk"
import { defaultRPC } from "../../../config.json"
import { url } from "./format"
import type { ShelbyConfig } from "./types"

const suggestedContext = {
	context_name: "devnet",
	network: "devnet",
	rpc: defaultRPC,
}

export default async function contextConfig(config: ShelbyConfig): Promise<
	| {
			context_name: string
			network: string
			rpc: string
	  }
	| undefined
> {
	const useSuggested = await confirm({
		message: `Would you like to use suggested network settings for ${url("devnet")} context?`,
		default: true,
	})
	if (useSuggested) {
		return suggestedContext
	}
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
			message: `Would you like to use default ${chalk.cyan(defaultContext)} context from Shelby config?`,
			default: true,
		})
		if (useDefault) {
			const context = contexts[defaultContext]
			return {
				context_name: defaultContext,
				network: context.aptos_network,
				rpc: context.shelby_rpc_endpoint,
			}
		}
	}
	const choices = contextNames.map((name) => ({
		name: `${chalk.bold(name)} (aptos network: ${contexts[name].aptos_network})`,
		value: name,
	}))
	const selected = await select({
		message: "Which Shelby context would you like to use?",
		choices,
	})
	return {
		context_name: selected,
		network: contexts[selected].aptos_network,
		rpc: contexts[selected].shelby_rpc_endpoint,
	}
}
