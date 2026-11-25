import fs from 'node:fs'
import path from 'node:path'
import { openApiDocument } from '../src/validation/openapi'

const out = path.join(__dirname, '..', 'openapi.json')
fs.writeFileSync(out, `${JSON.stringify(openApiDocument, null, 2)}\n`, 'utf8')
console.log(`OpenAPI spec written to ${out}`)
