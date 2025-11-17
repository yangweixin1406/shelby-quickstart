import "dotenv/config"
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  unlinkSync,
  createWriteStream,
} from "node:fs"
import { join, basename } from "node:path"
import {
  Account,
  AccountAddress,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import { filesize } from "filesize"
import fetch from "node-fetch"
import chalk from "chalk"
import { Readable } from "node:stream"
import { pipeline } from "node:stream/promises"

// ======= 基础路径配置 =======
const CONFIG_FILE = join(process.cwd(), "config.jsonl")
const TEMP_DIR = join(process.cwd(), "assets")
const DOWN_DIR = join(process.cwd(), "downloads")
const PROGRESS_FILE = join(process.cwd(), "progress.json")
mkdirSync(TEMP_DIR, { recursive: true })
mkdirSync(DOWN_DIR, { recursive: true })

// ======= 上传时间选项 =======
const CHOICES = [
  { name: "1 minute", value: 60 * 1_000_000 },
  { name: "1 hour", value: 60 * 60 * 1_000_000 },
  { name: "1 day", value: 24 * 60 * 60 * 1_000_000 },
  { name: "1 week", value: 7 * 24 * 60 * 60 * 1_000_000 },
  { name: "1 month", value: 30 * 24 * 60 * 60 * 1_000_000 },
  { name: "1 year", value: 365 * 24 * 60 * 60 * 1_000_000 },
]

// ======= 稳定图源（无 302，不限流） =======
const IMAGE_SOURCES = [
  (w: number, h: number) => `https://picsum.photos/seed/${Math.random()}/${w}/${h}`,
  (w: number, h: number) => `https://placehold.co/${w}x${h}.jpg`,
  (w: number, h: number) => `https://dummyimage.com/${w}x${h}/000/fff.jpg`,
]

// ======= 延迟 =======
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ======= 随机文件名 =======
function randomImageName() {
  const words = [
    "dream", "sky", "forest", "flame", "river", "storm", "light",
    "shadow", "path", "echo", "whisper", "ocean", "stone", "leaf", 'reason', 'season', 'light', 'dark', 'soundness', 'candle', 'kind',
    'nobody', 'rubbish', 'rabbit', 'cake', 'box', 'hunt', 'mute', 'lake', 'robot', 'position', 'computer', 'front', 'end', 'comfortable',
    'label', 'table'
  ]
  const w1 = words[Math.floor(Math.random() * words.length)]
  const w2 = words[Math.floor(Math.random() * words.length)]
  return `${w1}_${w2}.jpg`
}

// ======= fallback 最小 JPG（永不失败） =======
function generateFallbackJPG() {
  return Buffer.from([
    0xFF,0xD8,0xFF,0xDB,0x00,0x43,0x00,0x03,0x02,0x02,0x03,0x02,0x02,0x03,0x03,0x03,
    0x03,0x04,0x03,0x03,0x04,0x05,0x08,0x06,0x05,0x05,0x05,0x05,0x0A,0x07,0x07,0x06,
    0x08,0x0C,0x0A,0x0C,0x0C,0x0B,0x0A,0x0B,0x0B,0x0D,0x0E,0x12,0x10,0x0D,0x0E,0x11,
    0x0E,0x0B,0x0B,0x10,0x16,0x10,0x11,0x13,0x14,0x15,0x15,0x15,0x0C,0x0F,0x17,0x18,
    0x16,0x14,0x18,0x12,0x14,0x15,0x14,0xFF,0xC0,0x00,0x11,0x08,0x00,0x01,0x00,0x01,
    0x03,0x01,0x11,0x00,0x02,0x11,0x01,0x03,0x11,0x01,0xFF,0xC4,0x00,0x14,0x00,0x01,
    0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0xFF,
    0xDA,0x00,0x0C,0x03,0x01,0x00,0x02,0x11,0x03,0x11,0x00,0x3F,0x00,0xFF,0xD9
  ])
}

// ======= 重写 downloadRandomImage（永不退出） =======
async function downloadRandomImage() {
  const width = 800 + Math.floor(Math.random() * 800)
  const height = 800 + Math.floor(Math.random() * 800)

  for (let attempt = 1; attempt <= 5; attempt++) {
    const urlFn = IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)]
    const url = urlFn(width, height)

    console.log(`🖼️  Downloading image [${attempt}/5]: ${url}`)

    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 15000)

      const res = await fetch(url, { signal: controller.signal })
      clearTimeout(timeout)

      if (!res.ok || !res.body) {
        console.warn(`⚠️ HTTP ${res.status} ${res.statusText}`)
        continue
      }

      const filePath = join(TEMP_DIR, randomImageName())
      const stream = createWriteStream(filePath)

      await new Promise((resolve, reject) => {
        res.body.pipe(stream)
        res.body.on("error", reject)
        stream.on("finish", resolve)
      })

      console.log(`✅ Saved → ${filePath}`)
      return filePath
    } catch (err) {
      console.warn(`⚠️ Download error: ${err}`)
      await sleep(500)
    }
  }

  // ======= 所有图源失败 → fallback 生成本地 JPG =======
  console.warn("⚠️ All image sources failed → using fallback image")

  const filePath = join(TEMP_DIR, randomImageName())
  writeFileSync(filePath, generateFallbackJPG())

  console.log(`✅ Fallback image created → ${filePath}`)
  return filePath
}

// ======= 加载账户 =======
function loadAccounts() {
  const lines = readFileSync(CONFIG_FILE, "utf-8").split("\n").filter(Boolean)
  return lines.map((line) => JSON.parse(line))
}

function loadProgress() {
  try {
    return JSON.parse(readFileSync(PROGRESS_FILE, "utf-8")).lastIndex ?? 0
  } catch {
    return 0
  }
}

function saveProgress(index) {
  writeFileSync(PROGRESS_FILE, JSON.stringify({ lastIndex: index }, null, 2))
}

// ======= 上传逻辑 =======
async function uploadForAccount({ apiKey, privateKey, address }) {
  const client = new ShelbyNodeClient({ network: Network.SHELBYNET, apiKey })
  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  })
  const account = AccountAddress.fromString(address)

  const uploadTimes = 1 + Math.floor(Math.random() * 3)

  for (let i = 0; i < uploadTimes; i++) {
    const filePath = await downloadRandomImage()
    const blobName = basename(filePath)
    const fileData = readFileSync(filePath)
    const timeObj = CHOICES[Math.floor(Math.random() * CHOICES.length)]
    const expirationMicros = Date.now() * 1000 + timeObj.value

    console.log(`\n📤 Uploading ${blobName} (${filesize(fileData.length)})`)
    console.log(`⏱️ Expiration: ${timeObj.name}`)

    try {
      await client.upload({
        blobData: fileData,
        signer,
        blobName,
        expirationMicros,
      })
      console.log(`✅ Uploaded successfully → ${address}`)
    } catch (e) {
      console.error(`❌ Upload failed: ${e}`)
    } finally {
      try {
        unlinkSync(filePath)
      } catch {}
    }

    const delay = 1000 + Math.random() * 2000
    console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s...`)
    await sleep(delay)
  }
  console.log(`🏁 Finished uploads for ${address}`)

  console.log(`⬇️ Start download blob......`)
  await downloadBlobs({ apiKey, address, privateKey })
  const nextDelay = 3000 + Math.random() * 5000
  await sleep(nextDelay)
}

async function downloadBlobs({ apiKey, privateKey, address }) {
  const client = new ShelbyNodeClient({
    network: Network.SHELBYNET,
    apiKey,
  })
  const account = AccountAddress.fromString(address)

  const blobs = await client.coordination.getAccountBlobs({ account })

  const temp = []
  for (const blob of blobs) {
    const expiryDate = new Date(blob.expirationMicros / 1000)
    const now = new Date()
    const isExpired = expiryDate < now

    if (!isExpired) {
      const splitArr = blob.name.split('/')
      const name = splitArr[splitArr.length - 1]
      temp.push({ name })
    }
  }
  console.log('🏁 blobs not expired list', temp)
  if (temp.length) {
    const blobName = temp[0].name
    const outPath = join(DOWN_DIR, blobName)
    const blob = await client.download({ account, blobName })
    const webStream = blob.readable as ReadableStream<Uint8Array>
    await pipeline(Readable.fromWeb(webStream), createWriteStream(outPath))
    console.log(
			chalk.green("✔"),
			chalk.bold.whiteBright(
				"Blob",
				`${chalk.cyan(account.toString())}/${chalk.cyan(blobName)}`,
				"downloaded successfully!\n",
			)
		)

    unlinkSync(outPath)
  } else {
    console.log('❌ download failed, not found blobs')
  }
}

// ======= 主流程 =======
async function main() {
  const accounts = loadAccounts()
  const startIndex = loadProgress()

  console.log(`🚀 Starting from index ${startIndex} (${accounts.length} total)`)

  for (let i = startIndex; i < accounts.length; i++) {
    const acc = accounts[i]
    console.log(`\n🔹 [${i + 1}/${accounts.length}] ${acc.address}`)
    await uploadForAccount(acc)
    saveProgress(i + 1)
  }

  console.log("\n🎉 All uploads completed!")
}

main().catch((err) => console.error("Fatal error:", err))