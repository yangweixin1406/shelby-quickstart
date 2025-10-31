// 如果你用 ts-node 或 node --loader ts-node/esm 运行，保持 ESM import 方式
import * as fs from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx'
import fetch from 'node-fetch'

// ========== 常量配置 ==========
const FILE_PATH = join(process.cwd(), 'aptos.xlsx')
const JSONL_PATH = join(process.cwd(), 'config.jsonl')
const ASSETS_DIR = join(process.cwd(), 'assets')

if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR)

// 多源图片列表（每次随机使用一个）
const IMAGE_SOURCES = [
  'https://picsum.photos/seed/',
  'https://placekitten.com/',
  'https://placebear.com/',
  'https://random.imagecdn.app/',
  'https://loremflickr.com/',
]

// ========== 加载 Excel ==========
function loadWorkbook(path: string) {
  if (typeof XLSX.readFile === 'function') {
    return XLSX.readFile(path)
  }
  const data = fs.readFileSync(path)
  return XLSX.read(data, { type: 'buffer' })
}

// ========== 下载图片（带重试机制） ==========
async function downloadRandomImage(id: string, attempt = 1): Promise<string> {
  try {
    const source =
      IMAGE_SOURCES[Math.floor(Math.random() * IMAGE_SOURCES.length)]
    const width = 400 + Math.floor(Math.random() * 600)
    const height = 400 + Math.floor(Math.random() * 600)
    let url = ''

    // 适配不同源
    if (source.includes('picsum.photos')) {
      url = `${source}${id}/${width}/${height}`
    } else if (source.includes('placekitten') || source.includes('placebear')) {
      url = `${source}${width}/${height}`
    } else if (source.includes('random.imagecdn.app')) {
      url = `${source}${width}/${height}`
    } else if (source.includes('loremflickr')) {
      url = `${source}${width}/${height}`
    } else {
      throw new Error('Invalid image source')
    }

    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const filePath = join(ASSETS_DIR, `${id}.jpg`)
    const buffer = Buffer.from(await res.arrayBuffer())
    fs.writeFileSync(filePath, buffer)
    return filePath
  } catch (err) {
    if (attempt < 3) {
      console.warn(`⚠️ 下载失败 (${attempt}) 次, 重试中...`, err.message)
      await new Promise((r) => setTimeout(r, 1000))
      return downloadRandomImage(id, attempt + 1)
    }
    console.error(`❌ 下载失败 ${id}: ${err.message}`)
    return ''
  }
}

// ========== 主函数 ==========
async function main() {
  const workbook = loadWorkbook(FILE_PATH)
  const sheetNames = workbook.SheetNames
  console.log('📘 Sheets:', sheetNames)

  const sheet = workbook.Sheets[sheetNames[0]]
  const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null })

  const data = jsonData
    .filter((_: any) => !!_.apiKey)
    .map((_: any) => {
      const { apiKey, address, privateKey } = _
      return {
        apiKey,
        address,
        privateKey: `ed25519-priv-${privateKey}`,
      }
    })

  // 写入 JSONL 文件
  const fileStream = fs.createWriteStream(JSONL_PATH, { flags: 'w' })
  for (const row of data) {
    fileStream.write(JSON.stringify(row) + '\n')
  }
  fileStream.close()
  console.log(`✅ 已生成 JSONL 文件: ${JSONL_PATH}`)

  // 下载图片（演示）
  for (const item of data) {
    const id = item.address.slice(2, 10) // 简短 ID
    const imagePath = await downloadRandomImage(id)
    if (imagePath) {
      console.log(`🖼️ 下载成功: ${imagePath}`)
      // 上传逻辑可放在此处
      fs.unlinkSync(imagePath) // 删除临时文件
      console.log(`🗑️ 已删除本地图片: ${imagePath}`)
    }
  }

  console.log('🎯 全部任务完成！')
}

// ========== 启动 ==========
main().catch((err) => console.error('💥 Fatal error:', err))
