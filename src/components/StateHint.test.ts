import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import StateHint from './StateHint.vue'

describe('StateHint', () => {
  it('renders text and tone class', () => {
    const wrapper = mount(StateHint, {
      props: { text: '暂无内容', tone: 'empty' }
    })
    expect(wrapper.text()).toContain('暂无内容')
    expect(wrapper.classes()).toContain('is-empty')
  })

  it('renders slot content', () => {
    const wrapper = mount(StateHint, {
      props: { tone: 'loading' },
      slots: { default: '<text>加载中</text>' }
    })
    expect(wrapper.text()).toContain('加载中')
    expect(wrapper.classes()).toContain('is-loading')
  })
})
