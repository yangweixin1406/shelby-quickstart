import "dotenv/config"

import { AccountAddress, Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk"
import { input } from "@inquirer/prompts"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import chalk from "chalk"
import { filesize } from "filesize"
import { cmd } from "./util/format"
import truncate from "./util/truncate"

const SHELBY_NETWORK = process.env.SHELBY_NETWORK || "devnet"
const SHELBY_ACCOUNT_ADDRESS = process.env.SHELBY_ACCOUNT_ADDRESS
const SHELBY_RPC = process.env.SHELBY_RPC

if (!SHELBY_RPC) {
	console.error("SHELBY_RPC is not set in", chalk.cyan(".env"))
	process.exit(1)
}

if (!SHELBY_ACCOUNT_ADDRESS) {
	console.error("SHELBY_ACCOUNT_ADDRESS is not set in", chalk.cyan(".env"))
	process.exit(1)
}

const aptos = new Aptos(
	new AptosConfig({
		network: Network[SHELBY_NETWORK as keyof typeof Network],
	}),
)
const client = new ShelbyNodeClient({ aptos, shelby: { baseUrl: SHELBY_RPC } })

async function main() {
	try {
		const accountStr = await input({
			message: "Which account's blobs would you like to list?",
			default: SHELBY_ACCOUNT_ADDRESS as string,
		})
		if (!accountStr) {
			console.error(
				chalk.bold.whiteBright("No account provided. Exiting."),
			)
			process.exit(1)
		}
		const blobs = await client.coordination.getAccountBlobs({
			account: AccountAddress.fromString(accountStr),
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
		} else {
			console.error("Unexpected error:", e)
			console.error("---")
			console.error(chalk.bold.whiteBright("Please report this issue."))
		}
		process.exit(1)
	}
}

main()
