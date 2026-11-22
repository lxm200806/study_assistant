/** uni-cli checkUpdate / Vite 在部分环境下会因 os.networkInterfaces 崩溃；兜底假网卡 */
try {
  const os = require('os')
  const original = os.networkInterfaces.bind(os)
  os.networkInterfaces = () => {
    try {
      const real = original()
      if (real && Object.keys(real).length) return real
    } catch {
      // fall through
    }
    return {
      lo0: [
        {
          address: '127.0.0.1',
          netmask: '255.0.0.0',
          family: 'IPv4',
          mac: '00:00:00:00:00:00',
          internal: true,
          cidr: '127.0.0.1/8'
        }
      ]
    }
  }
} catch {
  // ignore
}
