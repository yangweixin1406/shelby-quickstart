import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

export function setLastUpload(blobName: string): Error | null {
	const filePath = join(process.cwd(), ".last_upload")
	try {
		writeFileSync(filePath, blobName)
		return null
	} catch (e) {
		return e as Error
	}
}
export function getLastUpload(): string | null {
	const filePath = join(process.cwd(), ".last_upload")
	try {
		return (readFileSync(filePath, "utf8") || null) as string | null
	} catch {
		return null
	}
}
