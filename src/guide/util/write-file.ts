import { writeFileSync } from "node:fs"
import { join } from "node:path"
import type { EnvVariables } from "./types"

export default function writeFile(settings: EnvVariables) {
	const envFile = join(process.cwd(), ".env")
	const envContent = [
		`SHELBY_ACCOUNT_NAME=${settings.account_name}`,
		`SHELBY_ACCOUNT_ADDRESS=${settings.address}`,
		`SHELBY_ACCOUNT_PRIVATE_KEY=${settings.private_key}`,
		`SHELBY_CONTEXT_NAME=${settings.context_name}`,
		`SHELBY_APTOS_NETWORK=${settings.network}`,
	].join("\n")
	try {
		writeFileSync(envFile, envContent)
		return null
	} catch (e) {
		return e
	}
}
