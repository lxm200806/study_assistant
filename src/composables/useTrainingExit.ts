export function useTrainingExit(options: {
  onExit: () => void
  beforeExit?: () => void
}) {
  const requestExit = () => {
    uni.showModal({
      title: '退出训练',
      content: '确定要退出吗？已答题目会保留练习记录。',
      confirmText: '退出',
      cancelText: '继续训练',
      success: (res) => {
        if (res.confirm) {
          options.beforeExit?.()
          options.onExit()
        }
      }
    })
  }

  return { requestExit }
}
