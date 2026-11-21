#!/usr/bin/env ts-node
/**
 * 已废弃：MSE 释义请改 senses.json，课表改 books/mse-*.json。
 * 旧 *-glosses.json 已删除。
 */
console.error('polish:mse 已废弃。请维护 senses.json + books/mse-ket.json|mse-pet.json，然后：')
console.error('  npm run tongbu:cishu -- --force mse-ket mse-pet')
process.exit(1)
