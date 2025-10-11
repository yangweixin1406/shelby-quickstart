import { writeFileSync } from "node:fs"
import { join } from "node:path"
import type { EnvVariables } from "./types"

export default function writeFile(settings: EnvVariables) {
	const envFile = join(process.cwd(), ".env")
	console.log(settings)
	const envContent = [
		`SHELBY_ACCOUNT_NAME=${settings.account_name}`,
		`SHELBY_ACCOUNT_ADDRESS=${settings.address}`,
		`SHELBY_ACCOUNT_PRIVATE_KEY=${settings.private_key}`,
		`SHELBY_CONTEXT_NAME=${settings.context_name}`,
		`SHELBY_API_KEY=${settings.api_key}`,
		`SHELBY_NETWORK_NAME=${settings.network.name}`,
		`SHELBY_FULLNODE=${settings.network.fullnode}`,
		`SHELBY_FAUCET=${settings.network.faucet}`,
		`SHELBY_INDEXER=${settings.network.indexer}`,
		`SHELBY_PEPPER=${settings.network.pepper}`,
		`SHELBY_PROVER=${settings.network.prover}`,
	].join("\n")
	try {
		writeFileSync(envFile, envContent)
		return null
	} catch (e) {
		return e
	}
}
