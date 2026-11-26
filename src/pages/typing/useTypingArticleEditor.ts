import { ref, type Ref } from 'vue'
import { typingAPI } from '@/utils/api'
import { isBrowserH5 } from '@/platform/runtime'
import type { ArticleRow } from './typing.types'

interface Options {
  refreshArticles: () => Promise<unknown> | unknown
  suspendKeys: Ref<boolean>
}

/** 短文列表的编辑/导入/删除逻辑，页面只负责展示和开始练习。 */
export function useTypingArticleEditor(options: Options) {
  const isH5 = isBrowserH5()
  const articleTitle = ref('')
  const articleBody = ref('')
  const articleTranslation = ref('')
  const editingId = ref('')
  const editingBuiltin = ref(false)
  const editImpact = ref<{ kept: number; reset: number; retired: number } | null>(null)

  function notify(title: string) {
    uni.showToast({ title, icon: 'none' })
  }

  function readTextFile(limit: number, assign: (text: string) => void) {
    if (!isH5 || typeof document === 'undefined') {
      notify('文件导入请在电脑浏览器里使用，或直接粘贴')
      return
    }
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.txt,text/plain,.md'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      if (file.size > 200000) {
        notify('文件太大')
        return
      }
      const reader = new FileReader()
      reader.onload = () => assign(String(reader.result || '').slice(0, limit))
      reader.onerror = () => notify('没能读取文件')
      reader.readAsText(file)
    }
    input.click()
  }

  function pickArticleFile() {
    readTextFile(8000, text => {
      articleBody.value = text
      notify(editingId.value ? '已放入短文，确认后保存修改' : '已放入短文，确认后保存')
      void refreshEditImpact()
    })
  }

  async function beginEdit(item: ArticleRow) {
    try {
      const result = await typingAPI.article(item.id)
      const data = result.data as {
        title?: string
        body?: string
        sourceTranslation?: string
        translation?: string
      }
      editingId.value = item.id
      editingBuiltin.value = !!item.builtin
      articleTitle.value = data?.title || item.title
      articleBody.value = data?.body || ''
      articleTranslation.value = data?.sourceTranslation || data?.translation || ''
      editImpact.value = null
      await refreshEditImpact()
    } catch (error) {
      notify((error as Error).message || '没能打开短文')
    }
  }

  function cancelEdit() {
    editingId.value = ''
    editingBuiltin.value = false
    editImpact.value = null
    articleTitle.value = ''
    articleBody.value = ''
    articleTranslation.value = ''
  }

  async function refreshEditImpact() {
    if (!editingId.value || !articleBody.value.trim()) {
      editImpact.value = null
      return
    }
    try {
      const result = await typingAPI.previewArticle(
        editingId.value,
        articleBody.value,
        articleTranslation.value
      )
      editImpact.value = (result.data as { kept: number; reset: number; retired: number }) || null
    } catch {
      editImpact.value = null
    }
  }

  function onArticleFieldBlur() {
    options.suspendKeys.value = false
    void refreshEditImpact()
  }

  async function saveArticle() {
    if (!articleBody.value.trim()) {
      notify('先粘贴短文')
      return
    }
    try {
      if (editingId.value) {
        await refreshEditImpact()
        const result = await typingAPI.updateArticle(
          editingId.value,
          articleTitle.value,
          articleBody.value,
          articleTranslation.value
        )
        const data = result.data as {
          kept?: number
          reset?: number
          retired?: number
          copied?: boolean
        }
        const changed = (data?.reset || 0) + (data?.retired || 0)
        const copied = data?.copied ? '已另存为你的短文。' : ''
        cancelEdit()
        await options.refreshArticles()
        if (changed) notify(`${copied}${data?.kept || 0} 句保留进度，${changed} 句重新开始`)
        else notify(copied || '短文已保存')
        return
      }
      await typingAPI.createArticle(articleTitle.value, articleBody.value, articleTranslation.value)
      articleTitle.value = ''
      articleBody.value = ''
      articleTranslation.value = ''
      await options.refreshArticles()
      notify('短文已保存')
    } catch (error) {
      notify((error as Error).message || '没能保存')
    }
  }

  async function removeArticle(id: string) {
    await typingAPI.deleteArticle(id)
    await options.refreshArticles()
  }

  return {
    articleTitle,
    articleBody,
    articleTranslation,
    editingId,
    editingBuiltin,
    editImpact,
    beginEdit,
    cancelEdit,
    onArticleFieldBlur,
    saveArticle,
    removeArticle,
    pickArticleFile
  }
}
