import "dotenv/config"

import { AccountAddress, Network } from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import chalk from "chalk"
import { filesize } from "filesize"
import { cmd } from "./util/format"
import truncate from "./util/truncate"

const SHELBY_ACCOUNT_ADDRESS = process.env.SHELBY_ACCOUNT_ADDRESS
const SHELBY_ACCOUNT_PRIVATE_KEY = process.env.SHELBY_ACCOUNT_PRIVATE_KEY

if (!SHELBY_ACCOUNT_ADDRESS) {
	console.error("SHELBY_ACCOUNT_ADDRESS is not set in", chalk.cyan(".env"))
	process.exit(1)
}

const client = new ShelbyNodeClient({
	network: Network.SHELBYNET,
	apiKey: "AG-5Y2LDN4FNNRETSQRMS9VQRFFOKVHSRZ6J",
})

async function main() {
	try {
		console.log(
			chalk.bold.whiteBright(
				"Listing blobs for account",
				`${chalk.cyan(truncate(SHELBY_ACCOUNT_ADDRESS as string))}:`,
			),
		)
		const blobs = await client.coordination.getAccountBlobs({
			account: AccountAddress.fromString(
				SHELBY_ACCOUNT_ADDRESS as string,
			),
		})
		console.log(
			chalk.bold.whiteBright(
				"Current blobs for",
				`${chalk.cyan(truncate(SHELBY_ACCOUNT_ADDRESS as string))}:\n`,
			),
		)
		for (const blob of blobs) {
			const expiry = new Date(
				blob.expirationMicros / 1000,
			).toLocaleString()
			console.log(
				`· ${chalk.cyan(blob.name)} — ${chalk.yellow(
					filesize(blob.size),
				)}, expiring: ${chalk.cyan(expiry)}`,
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
					"Unauthorized (401). Did you set your API key?",
				),
			)
			console.log(e)
		} else {
			console.error("Unexpected error:", e)
			console.error("---")
			console.error(chalk.bold.whiteBright("Please report this issue."))
		}
		process.exit(1)
	}
}

main()
