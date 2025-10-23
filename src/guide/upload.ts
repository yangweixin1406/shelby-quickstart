import "dotenv/config"
import { readFileSync } from "node:fs"
import { join, basename } from "node:path"
import {
	Account,
	type AptosApiError,
	Ed25519PrivateKey,
	Network,
} from "@aptos-labs/ts-sdk"
import { input, select } from "@inquirer/prompts"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import chalk from "chalk"
// import { filesize } from "filesize"
import ora from "ora"
import prettyMilliseconds from "pretty-ms"
import {
	apiKeyDocsUrl,
	aptFaucetUrl,
	defaultApiKey,
	shelbyFaucetUrl,
	shelbyTicker,
} from "../../config.json"
import { navigateFileTree } from "./util/file-tree-navigator"
import { cmd, url } from "./util/format"
import { setLastUpload } from "./util/last-upload"

const SHELBY_ACCOUNT_ADDRESS = process.env.SHELBY_ACCOUNT_ADDRESS
const SHELBY_ACCOUNT_PRIVATE_KEY = process.env.SHELBY_ACCOUNT_PRIVATE_KEY
const SHELBY_API_KEY = process.env.SHELBY_API_KEY

if (!SHELBY_ACCOUNT_ADDRESS) {
	console.error("SHELBY_ACCOUNT_ADDRESS is not set in", chalk.cyan(".env"))
	process.exit(1)
}
if (!SHELBY_ACCOUNT_PRIVATE_KEY) {
	console.error(
		"SHELBY_ACCOUNT_PRIVATE_KEY is not set in",
		chalk.cyan(".env"),
	)
	process.exit(1)
}
if (!SHELBY_API_KEY) {
	console.error("SHELBY_API_KEY is not set in", chalk.cyan(".env"))
	process.exit(1)
}

const client = new ShelbyNodeClient({
	network: Network.SHELBYNET,
	apiKey: SHELBY_API_KEY,
})
const signer = Account.fromPrivateKey({
	privateKey: new Ed25519PrivateKey(SHELBY_ACCOUNT_PRIVATE_KEY),
})

async function main() {
	const spinner = ora()
	try {
		console.log(
			chalk.bold.whiteBright(
				"Welcome to the Shelby Blob Uploader!\nSelect a file to upload. Sample assets included below:",
			),
		)
		const uploadFile = await navigateFileTree(join(process.cwd(), "assets"))
		console.log(
			chalk.bold.whiteBright("You selected:"),
			chalk.cyan(uploadFile),
		)
		const blobName = await input({
			message: "What would you like to name this blob on Shelby?",
			default: basename(uploadFile),
		})
		const duration = await select({
			message: "How long should the blob be stored?",
			choices: [
				{ name: "1 minute", value: 60 * 1_000_000 },
				{ name: "1 hour", value: 60 * 60 * 1_000_000 },
				{ name: "1 day", value: 24 * 60 * 60 * 1_000_000 },
				{ name: "1 week", value: 7 * 24 * 60 * 60 * 1_000_000 },
				{ name: "1 month", value: 30 * 24 * 60 * 60 * 1_000_000 },
				{ name: "1 year", value: 365 * 24 * 60 * 60 * 1_000_000 },
			],
		})
		spinner.text = chalk.bold.whiteBright(
			"Storing",
			chalk.cyan(uploadFile),
			"on Shelby as",
			chalk.cyan(blobName),
			"for",
			chalk.cyan(prettyMilliseconds(duration / 1000, { verbose: true })) +
				"...",
		)
		spinner.start()
		/**
		 * Upload the blob to Shelby
		 */
		const results = await client.upload({
			blobData: readFileSync(uploadFile),
			signer,
			blobName,
			expirationMicros: Date.now() * 1000 + duration,
		})
		spinner.stop()
		console.log(
			chalk.green("✔"),
			chalk.bold.whiteBright(
				"Uploaded",
				chalk.cyan(blobName),
				"successfully!\n",
			),
		)
		// FIXME: No longer returning blob commitments from upload call
		// We need to make a call for blob metadata after upload

		// const blobSize = filesize(results.blobCommitments.raw_data_size)
		// console.log("Blob size:", chalk.yellow(blobSize))
		console.log(
			"Full blob name:",
			`${chalk.cyan(SHELBY_ACCOUNT_ADDRESS)}/${chalk.cyan(blobName)}`,
		)
		// console.log(
		// 	"Merkle root:",
		// 	chalk.cyan(results.blobCommitments.blob_merkle_root),
		// 	"\n",
		// )
		setLastUpload(blobName)
		console.log(
			chalk.bold.whiteBright(
				"Next: Use",
				cmd("npm run list"),
				"to see the blobs you have uploaded.\n",
			),
		)
	} catch (e: unknown) {
		spinner.stop()
		if (e instanceof Error && e.name === "ExitPromptError") {
			console.error(
				chalk.bold.whiteBright("Upload canceled. No funds were spent."),
			)
			process.exit(1)
		}
		const err = e as AptosApiError
		if (err.message.includes("EBLOB_WRITE_CHUNKSET_ALREADY_EXISTS")) {
			console.log(
				chalk.bold.whiteBright(
					"This blob has already been uploaded. Try uploading something else?",
				),
			)
			return
		}
		if (err.message.includes("INSUFFICIENT_BALANCE_FOR_TRANSACTION_FEE")) {
			// FIXME: Assuming the user is always on devnet at this point
			console.log(
				chalk.bold.whiteBright(
					"You don't have enough",
					chalk.cyan("APT"),
					"to pay for the transaction fee. Visit the faucet:\n",
				),
				url(`${aptFaucetUrl}?address=${SHELBY_ACCOUNT_ADDRESS}`),
			)
			return
		}
		if (err.message.includes("E_INSUFFICIENT_FUNDS")) {
			console.log(
				chalk.bold.whiteBright(
					"You don't have enough",
					chalk.cyan(shelbyTicker),
					"to upload this blob. Visit the faucet:\n",
					url(`${shelbyFaucetUrl}?address=${SHELBY_ACCOUNT_ADDRESS}`),
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
		const msg = e instanceof Error ? e.message : String(e)
		if (/500|internal server error/i.test(msg)) {
			console.error(
				chalk.bold.redBright(
					"A server error occurred (500). Please try again later or contact support.",
				),
			)
			process.exit(1)
		}
		console.log(chalk.bold.whiteBright("Unexpected error:\n", msg))
		process.exit(1)
	}
}

main()
