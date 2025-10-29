import "dotenv/config"
import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from "node:fs"
import { join, basename } from "node:path"
import { Account, AccountAddress, Ed25519PrivateKey, Network, type AptosApiError } from "@aptos-labs/ts-sdk"
import { ShelbyNodeClient } from "@shelby-protocol/sdk/node"
import { filesize } from "filesize"

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

// ======= 随机英文句子生成 =======
const words = [
  "sun", "moon", "star", "river", "mountain", "ocean", "dream", "shadow", "light",
  "storm", "flower", "tree", "bird", "stone", "wind", "flame", "path", "cloud",
  "forest", "whisper", "memory", "echo", "silence", "mirror", "fire", "rain",
  "sky", "dust", "snow", "song", "heart", "time", "world", "night", "day", "soul",
  "hope", "truth", "fate", "spark", "wave", "field", "leaf", "seed", "riverbank",
  "valley", "dreamer", "hunter", "creator", "wanderer", "painter", "thinker",
  "poet", "believer", "traveler", "guardian", "shadowed", "eternal", "gentle",
  "wild", "silent", "mystic", "ancient", "bright", "endless", "hidden", "fragile",
  "strong", "lonely", "free", "kind", "lost", "true", "pure", "broken", "deep",
  "soft", "empty", "golden", "silver", "blue", "green", "crimson", "dark", "clear",
  "wildfire", "serenity", "moment", "breeze", "vision", "lightning", "dawn",
  "twilight", "horizon", "circle", "flameheart", "rising", "falling", "eternity",
  "dreamscape", "mystery", "pathway", "meadow", "island", "shore", "harbor",
  "voyage", "destiny", "freedom", "truthful", "grace", "balance", "shadowfall",
  "afterglow", "ember", "pulse", "songbird", "lighthouse", "reflection", "garden",
  "bloom", "promise", "memorylane", "echoes", "silversky", "enduring", "awakening",
  "flamelight", "riverflow", "timeless", "dreamlight", "symphony", "whisperwind",
  "solitude", "clarity", "serenity", "wanderlust", "evergreen", "crystal",
  "hopeful", "radiant", "infinite", "celestial", "harmony", "shimmer", "essence",
  "destined", "brighter", "faithful", "peaceful", "motion", "glimmer", "awakening",
  "wildsong", "beyond", "whispered", "northern", "southern", "forgotten",
  "remembered", "sacred", "eternal", "tranquil", "goldleaf", "frozen", "melody",
  "glow", "softly", "wandering", "pathless", "rainfall", "dreambound", "inspired",
  "fallen", "ascending", "distant", "wildpath", "moonlight", "skydance",
  "midnight", "blooming", "glorious", "silverleaf", "brightpath", "firewind",
  "starlit", "ripple", "murmur", "radiance", "everlight", "whirlwind", "dreamwave",
  "boundless", "twinkling", "goldpath", "miracle", "radiance", "truelight", "seraph",
  "emberwind", "wildrose", "hollow", "aurora", "zenith", "solaris", "echoheart",
  "bliss", "myst", "nova", "eden", "pulsefire", "infinity", "tempest", "drift",
  "wander", "sparkle", "dusk", "vivid", "paradox", "lumina", "wildwood", "kindred",
  "spirit", "depth", "soulpath", "mindful", "timeless", "flight", "graceful",
  "wonder", "origin", "stream", "shadowline", "hollowed", "moonrise", "twilightpath",
  "beacon", "truthpath", "sapphire", "crimsonpath", "dreamwind"
]

function randomSentence() {
  const length = 6 + Math.floor(Math.random() * 8)
  const sentence = Array.from({ length }, () => words[Math.floor(Math.random() * words.length)])
  const text = sentence.join(" ")
  return text.charAt(0).toUpperCase() + text.slice(1) + "."
}

function randomParagraph() {
  const count = 2 + Math.floor(Math.random() * 3)
  return Array.from({ length: count }, () => randomSentence()).join(" ")
}

// ======= 随机文件名生成 =======
function randomFileName() {
  const adjectives = ["cool", "amazing", "bright", "mystic", "silent", "brave", "clever", "lucky"]
  const nouns = ["fox", "wolf", "otter", "panda", "falcon", "whale", "lion", "tiger"]
  const exts = ["txt", "md", "json", "js"]
  const name = `${adjectives[Math.floor(Math.random() * adjectives.length)]}-${nouns[Math.floor(Math.random() * nouns.length)]}.${exts[Math.floor(Math.random() * exts.length)]}`
  return name
}

// ======= 延迟函数 =======
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ======= 生成随机文件内容 =======
function generateRandomFile() {
  const filename = randomFileName()
  const filePath = join(TEMP_DIR, filename)
  const ext = filename.split(".").pop()

  let content = randomParagraph()
  if (ext === "json") {
    content = JSON.stringify({ message: randomSentence(), createdAt: new Date().toISOString() }, null, 2)
  } else if (ext === "js") {
    content = `\nexport const message = "${randomSentence()}";\nexport const createdAt = "${new Date().toISOString()}";\n`
  }

  writeFileSync(filePath, content)
  return filePath
}

// ======= 加载账户 =======
function loadAccounts() {
  const lines = readFileSync(CONFIG_FILE, "utf-8").split("\n").filter(Boolean)
  return lines.map(line => JSON.parse(line))
}

// ======= 读取上传进度 =======
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
  const client = new ShelbyNodeClient({
    network: Network.SHELBYNET,
    apiKey,
  })

  const signer = Account.fromPrivateKey({
    privateKey: new Ed25519PrivateKey(privateKey),
  })

  const account = AccountAddress.fromString(address)
  const uploadTimes = 3 + Math.floor(Math.random() * 4) // 3~6 次上传

  for (let i = 0; i < uploadTimes; i++) {
    const filePath = generateRandomFile()
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

      // 上传成功后删除文件
      unlinkSync(filePath)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (msg.includes("EBLOB_WRITE_CHUNKSET_ALREADY_EXISTS")) {
        console.warn(`⚠️ ${blobName} already uploaded.`)
      } else if (msg.includes("INSUFFICIENT_BALANCE")) {
        console.error(`❌ Insufficient balance for ${address}.`)
      } else {
        console.error(`❌ Upload failed for ${address}: ${msg}`)
      }
      try { unlinkSync(filePath) } catch {}
    }

    // 文件间上传延迟（1–3秒）
    const delay = 1000 + Math.random() * 2000
    console.log(`⏳ Waiting ${(delay / 1000).toFixed(1)}s before next upload...`)
    await sleep(delay)
  }

  console.log(`\n🏁 Finished uploads for ${address}`)
  console.log("--------------------------------")

  // 地址之间延迟（3–8秒）
  const nextDelay = 3000 + Math.random() * 5000
  console.log(`⏸️ Waiting ${(nextDelay / 1000).toFixed(1)}s before next address...\n`)
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

main().catch(err => console.error("Fatal error:", err))
