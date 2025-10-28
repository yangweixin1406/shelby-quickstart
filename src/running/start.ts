import "dotenv/config"
import { readFileSync, writeFileSync, mkdirSync, createWriteStream } from "node:fs"
import { join, dirname, basename } from "node:path"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream } from "node:stream/web"
import {
	Account,
	AccountAddress,
	Ed25519PrivateKey,
	Network,
	type AptosApiError,
} from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import { filesize } from "filesize"

// 本地 JSONL 文件路径
const CONFIG_FILE = join(process.cwd(), "config.jsonl")

// 生成文件输出路径
const TEMP_DIR = join(process.cwd(), "assets")
mkdirSync(TEMP_DIR, { recursive: true })

// 随机文件类型
const FILE_EXTS = ["txt", "json", "js"]

const CHOICES = [
  { name: "1 minute", value: 60 * 1_000_000 },
  { name: "1 hour", value: 60 * 60 * 1_000_000 },
  { name: "1 day", value: 24 * 60 * 60 * 1_000_000 },
  { name: "1 week", value: 7 * 24 * 60 * 60 * 1_000_000 },
  { name: "1 month", value: 30 * 24 * 60 * 60 * 1_000_000 },
  { name: "1 year", value: 365 * 24 * 60 * 60 * 1_000_000 },
]

// 随机内容生成函数
function randomContent() {
	const phrases = [
		"Hello Shelby!",
		"Upload test from script",
		`Timestamp: ${new Date().toISOString()}`,
		`Random number: ${Math.random()}`,
	]
	return phrases.join("\n")
}

// 生成随机文件并返回路径
function generateRandomFile() {
	const ext = FILE_EXTS[Math.floor(Math.random() * FILE_EXTS.length)]
	const filename = `demo_${Date.now()}_${Math.floor(Math.random() * 9999)}.${ext}`
	const filePath = join(TEMP_DIR, filename)

	let content = randomContent()
	if (ext === "json") {
		content = JSON.stringify({ message: "Hello Shelby", time: Date.now() }, null, 2)
	} else if (ext === "js") {
		content = `// Auto-generated demo file\nexport default { createdAt: "${new Date().toISOString()}" }\n`
	}

	writeFileSync(filePath, content)
	return filePath
}

// 读取 JSONL 文件并解析为对象数组
function loadAccounts() {
	const lines = readFileSync(CONFIG_FILE, "utf-8")
		.split("\n")
		.filter(Boolean)
		.map(line => JSON.parse(line))
	return lines
}

// 主上传逻辑
async function uploadForAccount({ apiKey, privateKey, address }) {
	const client = new ShelbyNodeClient({
		network: Network.SHELBYNET,
		apiKey,
	})

	const signer = Account.fromPrivateKey({
		privateKey: new Ed25519PrivateKey(privateKey),
	})
	const account = AccountAddress.fromString(address)

  const timeObj = CHOICES[Math.floor(Math.random() * CHOICES.length)]

	const filePath = generateRandomFile()
	const blobName = basename(filePath)
	const fileData = readFileSync(filePath)
	const expirationMicros = Date.now() * 1000 + timeObj.value

	console.log(`\n📤 Uploading ${blobName} \n⏱️ Uploading expired time ${timeObj.name}`)

	try {
		await client.upload({
			blobData: fileData,
			signer,
			blobName,
			expirationMicros,
		})
		console.log(`\n✅ Uploaded ${blobName} (${filesize(fileData.length)}) successfully \n💰 address is ${address}`)
    console.log('------------------------ Time Line --------------------------')
	} catch (e) {
		const err = e as AptosApiError
		const msg = e instanceof Error ? e.message : String(e)
		if (msg.includes("EBLOB_WRITE_CHUNKSET_ALREADY_EXISTS")) {
			console.warn(`⚠️ ${blobName} already uploaded.`)
		} else if (msg.includes("INSUFFICIENT_BALANCE")) {
			console.error(`❌ Insufficient balance for ${address}.`)
		} else {
			console.error(`❌ Upload failed for ${address}:`, msg)
		}
	}
}

// 入口函数
async function main() {
	const accounts = loadAccounts()
	console.log(`Loaded ${accounts.length} accounts from ${CONFIG_FILE}`)

	for (const acc of accounts) {
		await uploadForAccount(acc)
	}
}

main().catch(err => console.error("Fatal error:", err))
