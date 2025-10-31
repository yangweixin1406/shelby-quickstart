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

// ======= 基础路径配置 =======
const CONFIG_FILE = join(process.cwd(), "config.jsonl")
const TEMP_DIR = join(process.cwd(), "assets")
const PROGRESS_FILE = join(process.cwd(), "progress.json")
mkdirSync(TEMP_DIR, { recursive: true })

// ======= 上传时间选项 =======
const CHOICES = [
  { name: "1 minute", value: 60 * 1_000_000 },
  { name: "1 hour", value: 60 * 60 * 1_000_000 },
  { name: "1 day", value: 24 * 60 * 60 * 1_000_000 },
  { name: "1 week", value: 7 * 24 * 60 * 60 * 1_000_000 },
  { name: "1 month", value: 30 * 24 * 60 * 60 * 1_000_000 },
  { name: "1 year", value: 365 * 24 * 60 * 60 * 1_000_000 },
]

// ======= 多源随机图片链接（更新版） =======
const IMAGE_SOURCES = [
  (w: number, h: number) => `https://picsum.photos/${w}/${h}?random=${Math.floor(Math.random() * 10000)}`,
  (w: number, h: number) => `https://source.unsplash.com/random/${w}x${h}?sig=${Math.floor(Math.random() * 10000)}`,
  (w: number, h: number) => `https://loremflickr.com/${w}/${h}/landscape?lock=${Math.floor(Math.random() * 10000)}`,
  (w: number, h: number) => `https://dummyimage.com/${w}x${h}/000/fff.jpg&text=AI+Generated`,
]

// ======= 延迟函数 =======
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ======= 随机图片文件名 =======
function randomImageName() {
  const words = [
    "dream", "sky", "forest", "flame", "river", "storm", "light",
    "shadow", "path", "echo", "whisper", "ocean", "stone", "leaf",
  ]
  const w1 = words[Math.floor(Math.random() * words.length)]
  const w2 = words[Math.floor(Math.random() * words.length)]
  return `${w1}_${w2}.jpg`
}

// ======= 下载随机图片（多源容错） =======
async function downloadRandomImage() {
  const width = 800 + Math.floor(Math.random() * 800)
  const height = 800 + Math.floor(Math.random() * 800)

  for (let attempt = 0; attempt < 5; attempt++) {
    const urlFn = IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)]
    const url = urlFn(width, height)

    console.log(`🖼️  Downloading image [try ${attempt + 1}/5]: ${url}`)

    try {
      const res = await fetch(url, { redirect: "follow", timeout: 10000 })
      if (!res.ok) {
        console.warn(`⚠️  HTTP ${res.status} ${res.statusText || "(no text)"}`)
        continue
      }

      if (!res.body) {
        console.warn(`⚠️  No response body for ${url}`)
        continue
      }

      const filePath = join(TEMP_DIR, randomImageName())
      const stream = createWriteStream(filePath)
      await new Promise((resolve, reject) => {
        res.body.pipe(stream)
        res.body.on("error", reject)
        stream.on("finish", resolve)
      })
      return filePath
    } catch (err) {
      console.warn(`⚠️  Fetch error for ${url}: ${err}`)
      await sleep(500)
    }
  }

  throw new Error("All image sources failed after 5 attempts.")
}

// ======= 加载账户 =======
function loadAccounts() {
  const lines = readFileSync(CONFIG_FILE, "utf-8").split("\n").filter(Boolean)
  return lines.map((line) => JSON.parse(line))
}

// ======= 上传进度 =======
function loadProgress() {
  try {
    const data = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"))
    return data?.lastIndex ?? 0
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

  const uploadTimes = 1 + Math.floor(Math.random() * 3) // ✅ 随机上传 1–3 张图片

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
      const msg = e instanceof Error ? e.message : String(e)
      console.error(`❌ Upload failed: ${msg}`)
    } finally {
      try {
        unlinkSync(filePath)
      } catch {}
    }

    const delay = 1000 + Math.random() * 2000
    console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next upload...`)
    await sleep(delay)
  }

  console.log(`\n🏁 Finished uploads for ${address}`)
  const nextDelay = 3000 + Math.random() * 5000
  console.log(`⏸️ Waiting ${(nextDelay / 1000).toFixed(1)}s before next account...\n`)
  await sleep(nextDelay)
}

// ======= 主流程 =======
async function main() {
  const accounts = loadAccounts()
  const startIndex = loadProgress()
  console.log(`🚀 Starting from index ${startIndex} (${accounts.length} total)`)

  for (let i = startIndex; i < accounts.length; i++) {
    const acc = accounts[i]
    console.log(`\n🔹 [${i + 1}/${accounts.length}] Processing address: ${acc.address}`)
    await uploadForAccount(acc)
    saveProgress(i + 1)
  }

  console.log("\n🎉 All uploads completed!")
}

main().catch((err) => console.error("Fatal error:", err))
