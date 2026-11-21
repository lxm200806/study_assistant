#!/usr/bin/env ts-node
/**
 * 对比成品词书与全局词典，导出增量到 tmp/lexicon-from-books/<book>/
 * 不修改 senses.json。
 *
 *   npm run cishu:daochu
 *   npm run cishu:daochu -- kew1200 kew4500
 */
import { exportBookDelta } from './book-lexicon-delta'
import { resolveBookCodes } from './book-lexicon-paths'

function main() {
  const codes = resolveBookCodes(process.argv.slice(2))
  console.log(`导出词书→总表增量（只写 tmp）: ${codes.join(', ')}`)
  for (const code of codes) {
    const report = exportBookDelta(code)
    console.log(
      `${code}: 词 ${report.totalWords} | 已覆盖 ${report.sameOrCovered} | delta ${report.delta} (缺词 ${report.missing}, 补洞 ${report.fill}) | 冲突 ${report.unresolved}`
    )
    console.log(`  → ${report.deltaPath}`)
    console.log(`  → ${report.unresolvedPath}`)
  }
  console.log('\n下一步预览合并: npm run cidian:hebing -- --book <code> --dry-run')
  console.log('确认后合并: npm run cidian:hebing -- --book <code>')
}

main()
