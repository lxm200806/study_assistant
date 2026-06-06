import { describe, expect, it } from 'vitest'
import { buildSystemPrompt, type LearnerChatContext } from './chat-learner-context.service'

const sampleContext: LearnerChatContext = {
  bookCode: 'ket',
  bookLevel: 'A2',
  coverageRate: 25,
  practicedCount: 50,
  wordCount: 200,
  weakTopics: ['food', 'travel'],
  dueWordCount: 3,
  backgroundWords: ['her', 'book', 'striped'],
  challengeWordEntries: [
    { word: 'her', meaning: '她的', example: 'This is her book.' },
    { word: 'book', meaning: '书；预订', example: 'I like to read books.' },
  ],
  levelHint: 'developing'
}

describe('buildSystemPrompt', () => {
  it('free mode uses a friend persona and has a single rule', () => {
    const prompt = buildSystemPrompt('free', sampleContext)
    expect(prompt).toContain('Alex')
    expect(prompt).toContain('One rule only')
    // Must not contain legacy drill-style section headers
    expect(prompt).not.toContain('本轮优先目标词')
    // Must not list backgroundWords as drill targets
    expect(prompt).not.toMatch(/her.*book.*striped.*练习/)
  })

  it('free mode shows positive/negative examples', () => {
    const prompt = buildSystemPrompt('free', sampleContext)
    expect(prompt).toContain('✅')
    expect(prompt).toContain('❌')
  })

  it('challenge mode includes word + meaning + example', () => {
    const prompt = buildSystemPrompt('challenge', sampleContext)
    expect(prompt).toContain('Word Challenge')
    expect(prompt).toContain('her')
    expect(prompt).toContain('她的')
    expect(prompt).toContain('Step 1')
  })

  it('roleplay mode stays in scenario and includes alex role', () => {
    const prompt = buildSystemPrompt('roleplay', sampleContext, 'cafe')
    expect(prompt).toContain('咖啡馆点餐')
    expect(prompt).toContain('barista')
    expect(prompt).toContain('in character')
  })

  it('roleplay mode with custom scenario falls back gracefully', () => {
    const prompt = buildSystemPrompt('roleplay', sampleContext, 'At the museum')
    expect(prompt).toContain('At the museum')
  })
})
