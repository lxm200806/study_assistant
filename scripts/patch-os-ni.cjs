/** uni-cli checkUpdate 在部分环境下会因 os.networkInterfaces 崩溃；给空实现兜底 */
try {
  const os = require('os')
  os.networkInterfaces = () => ({})
} catch {
  // ignore
}
