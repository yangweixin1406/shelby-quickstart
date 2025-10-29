// 如果用 ts-node / node --loader ts-node/esm 等，保持 ESM import 方式
import * as fs from 'node:fs'
import { join } from 'node:path'
import * as XLSX from 'xlsx' // 通常这样导入可以拿到模块对象

const FILE_PATH = join(process.cwd(), 'aptos.xlsx')
const JSONL_PATH = join(process.cwd(), 'config.jsonl')

function loadWorkbook(path) {
  // 优先使用 XLSX.readFile（某些打包/平台下可用）
  if (typeof XLSX.readFile === 'function') {
    return XLSX.readFile(path)
  }

  // 否则读取为 Buffer，使用 XLSX.read
  const data = fs.readFileSync(path)
  return XLSX.read(data, { type: 'buffer' })
}

const workbook = loadWorkbook(FILE_PATH)
const sheetNames = workbook.SheetNames
console.log('Sheets:', sheetNames)

const sheet = workbook.Sheets[sheetNames[0]]
const jsonData = XLSX.utils.sheet_to_json(sheet, { defval: null })
const data = jsonData.slice(0, 100).map((_) => {
  const { apiKey, address, privateKey } = _
  return {
    apiKey,
    address,
    privateKey: `ed25519-priv-${privateKey}`,
  }
})

// 写入 JSONL
const fileStream = fs.createWriteStream(JSONL_PATH, { flags: 'w' })
for (const row of data) {
  fileStream.write(JSON.stringify(row) + '\n')
}
fileStream.close()
