import "dotenv/config"

import { AccountAddress, Network } from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import chalk from "chalk"
import { filesize } from "filesize"
import { apiKeyDocsUrl, defaultApiKey } from "../../config.json"
import { cmd, url } from "./util/format"
import truncate from "./util/truncate"

const SHELBY_ACCOUNT_ADDRESS = '0x2d24a702fba5ba06d25bcf952f2d69c53a5224dd0a53edc66156cf5db7d1d1f6'
const SHELBY_API_KEY = 'aptoslabs_83Y8Tj8QsYy_PKCFBhwmo1cNKyrDr6NYSqC2iBLUg4yaK'

const client = new ShelbyNodeClient({
	network: Network.SHELBYNET,
	apiKey: SHELBY_API_KEY,
})

async function main() {
	try {
		console.log(
			chalk.bold.whiteBright(
				"Requesting blob list for account",
				`${chalk.cyan(truncate(SHELBY_ACCOUNT_ADDRESS as string))}...`,
			),
		)
		const blobs = await client.coordination.getAccountBlobs({
			account: AccountAddress.fromString(
				SHELBY_ACCOUNT_ADDRESS as string,
			),
		})
		if (blobs.length === 0) {
			console.log(chalk.bold.whiteBright("\nNo blobs found."))
			console.log(
				chalk.bold.whiteBright(
					"\nUse",
					cmd("npm run upload"),
					"to upload a blob to Shelby.\n",
				),
			)
		} else {
			console.log(
				chalk.bold.whiteBright(
					"Current blobs for",
					`${chalk.cyan(truncate(SHELBY_ACCOUNT_ADDRESS as string))}:\n`,
				),
			)
			for (const blob of blobs) {
				const expiryDate = new Date(blob.expirationMicros / 1000)
				const now = new Date()
				const isExpired = expiryDate < now
				const expiry = expiryDate.toLocaleString()

				const expiryText = isExpired
					? `expired: ${chalk.red(expiry)}`
					: `expiring: ${chalk.cyan(expiry)}`

				console.log(
					`· ${chalk.cyan(blob.name)} — ${chalk.yellow(
						filesize(blob.size),
					)}, ${expiryText}`,
				)
			}
			console.log("\n")
			console.log(
				chalk.bold.whiteBright(
					"Next: Use",
					cmd("npm run download"),
					"to pull a blob back down from Shelby.\n",
				),
			)
		}
	} catch (e) {
		if (e instanceof Error && e.name === "ExitPromptError") {
			console.error(
				chalk.bold.whiteBright(
					"Configuration canceled. No file written.",
				),
			)
			return
		}
		if (e instanceof Error && e.message.includes("401")) {
			// FIXME: Add link to the docs about obtaining an API key
			console.error(
				chalk.bold.redBright(
					"Unauthorized (401). This means your API key is missing or invalid.",
				),
			)
			return
		}
		if (e instanceof Error && e.message.includes("429")) {
			console.error(chalk.bold.redBright("Rate limit exceeded (429)."))
			if (SHELBY_API_KEY === defaultApiKey) {
				console.error(
					chalk.bold.whiteBright(
						"\nYou're using the default API key, which is subject to strict rate limits.",
						"\nYou can get your own API key for free! More info:",
						url(apiKeyDocsUrl),
					),
				)
			}
			return
		}
		console.error("Unexpected error:", e)
		console.error("---")
		console.error(chalk.bold.whiteBright("Please report this issue."))
		process.exit(1)
	}
}

main()
