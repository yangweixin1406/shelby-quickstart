import { confirm, input } from "@inquirer/prompts"
import { defaultApiKey } from "../../../config.json"
import { url } from "./format"

export default async function apiConfig(): Promise<{ api_key: string }> {
	const hasApiKey = await confirm({
		message: "Do you have an API key yet? (optional)",
		default: false,
	})
	if (!hasApiKey) {
		// FIXME: Add link to the docs about obtaining an API key
		console.log(
			"\nPlease consider obtaining an API key after completing this quickstart guide.",
			"\nCreate an account for free at:",
			url("https://geomi.dev"),
			"\n",
		)
		return { api_key: defaultApiKey }
	}
	const apiKey = await input({
		message: "Please enter your API key:",
	})
	return { api_key: apiKey }
}
