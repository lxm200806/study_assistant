import type { ContentType, TopicCategory } from '../vocabulary/types'

export interface WordTaxonomy {
  contentType: ContentType
  topic: TopicCategory
  tags?: string[]
}

const WORD_TAGS: Record<string, WordTaxonomy> = {
  // KET - daily life & nature
  apple: { contentType: 'non-fiction', topic: 'daily-life', tags: ['food'] },
  banana: { contentType: 'non-fiction', topic: 'daily-life', tags: ['food'] },
  orange: { contentType: 'non-fiction', topic: 'daily-life', tags: ['food'] },
  breakfast: { contentType: 'non-fiction', topic: 'daily-life', tags: ['food'] },
  coffee: { contentType: 'non-fiction', topic: 'daily-life', tags: ['food'] },
  pizza: { contentType: 'non-fiction', topic: 'daily-life', tags: ['food'] },
  water: { contentType: 'non-fiction', topic: 'daily-life' },
  cat: { contentType: 'non-fiction', topic: 'nature', tags: ['animal'] },
  dog: { contentType: 'non-fiction', topic: 'nature', tags: ['animal'] },
  bird: { contentType: 'non-fiction', topic: 'nature', tags: ['animal'] },
  fish: { contentType: 'non-fiction', topic: 'nature', tags: ['animal'] },
  elephant: { contentType: 'non-fiction', topic: 'nature', tags: ['animal'] },
  garden: { contentType: 'non-fiction', topic: 'nature' },
  beach: { contentType: 'non-fiction', topic: 'travel' },
  weather: { contentType: 'non-fiction', topic: 'science' },
  // KET - school & tech
  book: { contentType: 'non-fiction', topic: 'school' },
  school: { contentType: 'non-fiction', topic: 'school' },
  computer: { contentType: 'non-fiction', topic: 'science', tags: ['technology'] },
  phone: { contentType: 'non-fiction', topic: 'science', tags: ['technology'] },
  // KET - travel
  car: { contentType: 'non-fiction', topic: 'travel' },
  bus: { contentType: 'non-fiction', topic: 'travel' },
  // KET - health & places
  hospital: { contentType: 'non-fiction', topic: 'health' },
  restaurant: { contentType: 'non-fiction', topic: 'daily-life' },
  family: { contentType: 'non-fiction', topic: 'daily-life' },
  // KET - entertainment
  football: { contentType: 'non-fiction', topic: 'entertainment', tags: ['sport'] },
  music: { contentType: 'fiction', topic: 'entertainment', tags: ['art'] },
  happy: { contentType: 'non-fiction', topic: 'abstract' },
  adventure: { contentType: 'fiction', topic: 'entertainment', tags: ['story'] },
  amazing: { contentType: 'non-fiction', topic: 'abstract' },
  // KET - function words
  about: { contentType: 'function', topic: 'abstract' },
  accident: { contentType: 'non-fiction', topic: 'abstract' },
  across: { contentType: 'function', topic: 'abstract' },
  activity: { contentType: 'non-fiction', topic: 'entertainment' },
  address: { contentType: 'non-fiction', topic: 'daily-life' },
  agree: { contentType: 'function', topic: 'abstract' },
  allow: { contentType: 'function', topic: 'abstract' },
  answer: { contentType: 'function', topic: 'school' },
  arrive: { contentType: 'function', topic: 'travel' },
  become: { contentType: 'function', topic: 'abstract' },
  believe: { contentType: 'function', topic: 'abstract' },
  // PET
  abroad: { contentType: 'non-fiction', topic: 'travel' },
  airport: { contentType: 'non-fiction', topic: 'travel' },
  mountain: { contentType: 'non-fiction', topic: 'nature' },
  university: { contentType: 'non-fiction', topic: 'school' },
  environment: { contentType: 'non-fiction', topic: 'science' },
  celebrate: { contentType: 'non-fiction', topic: 'entertainment' },
  beautiful: { contentType: 'non-fiction', topic: 'abstract' },
  journey: { contentType: 'non-fiction', topic: 'travel' },
  temperature: { contentType: 'non-fiction', topic: 'science' },
  vacation: { contentType: 'non-fiction', topic: 'travel' },
  government: { contentType: 'non-fiction', topic: 'society' },
  difficult: { contentType: 'non-fiction', topic: 'abstract' },
  fantastic: { contentType: 'non-fiction', topic: 'abstract' },
  immediately: { contentType: 'function', topic: 'abstract' },
  knowledge: { contentType: 'non-fiction', topic: 'school' },
  language: { contentType: 'non-fiction', topic: 'school' },
  necessary: { contentType: 'non-fiction', topic: 'abstract' },
  opportunity: { contentType: 'non-fiction', topic: 'abstract' },
  population: { contentType: 'non-fiction', topic: 'society' },
  quality: { contentType: 'non-fiction', topic: 'abstract' },
  situation: { contentType: 'non-fiction', topic: 'abstract' },
  wonderful: { contentType: 'non-fiction', topic: 'abstract' },
  yesterday: { contentType: 'function', topic: 'abstract' },
  advantage: { contentType: 'non-fiction', topic: 'abstract' },
  appointment: { contentType: 'non-fiction', topic: 'daily-life' },
  available: { contentType: 'non-fiction', topic: 'abstract' },
  communicate: { contentType: 'non-fiction', topic: 'school' },
  competition: { contentType: 'non-fiction', topic: 'entertainment', tags: ['sport'] },
  convenient: { contentType: 'non-fiction', topic: 'abstract' },
  decision: { contentType: 'non-fiction', topic: 'abstract' },
  description: { contentType: 'non-fiction', topic: 'school' },
  development: { contentType: 'non-fiction', topic: 'science' },
  disappoint: { contentType: 'non-fiction', topic: 'abstract' },
  education: { contentType: 'non-fiction', topic: 'school' },
  experience: { contentType: 'non-fiction', topic: 'abstract' },
  important: { contentType: 'non-fiction', topic: 'abstract' },
  information: { contentType: 'non-fiction', topic: 'science' },
  international: { contentType: 'non-fiction', topic: 'society' },
  // 初中
  ability: { contentType: 'non-fiction', topic: 'abstract' },
  accept: { contentType: 'function', topic: 'abstract' },
  achieve: { contentType: 'non-fiction', topic: 'abstract' },
  advice: { contentType: 'non-fiction', topic: 'abstract' },
  animal: { contentType: 'non-fiction', topic: 'nature' },
  appear: { contentType: 'function', topic: 'abstract' },
  article: { contentType: 'non-fiction', topic: 'school' },
  attention: { contentType: 'non-fiction', topic: 'abstract' },
  avoid: { contentType: 'function', topic: 'abstract' },
  break: { contentType: 'function', topic: 'daily-life' },
  bridge: { contentType: 'non-fiction', topic: 'travel' },
  business: { contentType: 'non-fiction', topic: 'business' },
  care: { contentType: 'non-fiction', topic: 'health' },
  challenge: { contentType: 'non-fiction', topic: 'abstract' },
  character: { contentType: 'fiction', topic: 'entertainment', tags: ['story'] },
  choice: { contentType: 'non-fiction', topic: 'abstract' },
  compare: { contentType: 'function', topic: 'school' },
  complete: { contentType: 'function', topic: 'school' },
  condition: { contentType: 'non-fiction', topic: 'abstract' },
  continue: { contentType: 'function', topic: 'abstract' },
  control: { contentType: 'non-fiction', topic: 'abstract' },
  culture: { contentType: 'non-fiction', topic: 'society' },
  describe: { contentType: 'function', topic: 'school' },
  develop: { contentType: 'non-fiction', topic: 'science' },
  difference: { contentType: 'non-fiction', topic: 'abstract' },
  discover: { contentType: 'non-fiction', topic: 'science' },
  // 高中
  abandon: { contentType: 'function', topic: 'abstract' },
  absolute: { contentType: 'non-fiction', topic: 'abstract' },
  abstract: { contentType: 'non-fiction', topic: 'abstract' },
  academic: { contentType: 'non-fiction', topic: 'school' },
  accomplish: { contentType: 'non-fiction', topic: 'abstract' },
  accurate: { contentType: 'non-fiction', topic: 'science' },
  acknowledge: { contentType: 'function', topic: 'abstract' },
  acquire: { contentType: 'function', topic: 'abstract' },
  adapt: { contentType: 'non-fiction', topic: 'science' },
  adequate: { contentType: 'non-fiction', topic: 'abstract' },
  adjust: { contentType: 'function', topic: 'abstract' },
  adopt: { contentType: 'function', topic: 'abstract' },
  affect: { contentType: 'function', topic: 'abstract' },
  aggressive: { contentType: 'non-fiction', topic: 'abstract' },
  allocate: { contentType: 'non-fiction', topic: 'business' },
  alter: { contentType: 'function', topic: 'abstract' },
  ambitious: { contentType: 'non-fiction', topic: 'abstract' },
  analyze: { contentType: 'non-fiction', topic: 'science' },
  announce: { contentType: 'function', topic: 'society' },
  apparent: { contentType: 'non-fiction', topic: 'abstract' },
  appreciate: { contentType: 'function', topic: 'abstract' },
  appropriate: { contentType: 'non-fiction', topic: 'abstract' },
  approximately: { contentType: 'function', topic: 'abstract' },
  arise: { contentType: 'function', topic: 'abstract' },
  assess: { contentType: 'non-fiction', topic: 'school' },
  assume: { contentType: 'function', topic: 'abstract' },
  atmosphere: { contentType: 'non-fiction', topic: 'science' },
  attitude: { contentType: 'non-fiction', topic: 'abstract' },
  authority: { contentType: 'non-fiction', topic: 'society' },
  benefit: { contentType: 'non-fiction', topic: 'abstract' },
  campaign: { contentType: 'non-fiction', topic: 'society' },
  candidate: { contentType: 'non-fiction', topic: 'society' },
  capacity: { contentType: 'non-fiction', topic: 'abstract' },
  category: { contentType: 'non-fiction', topic: 'abstract' },
  characteristic: { contentType: 'non-fiction', topic: 'abstract' },
  circumstance: { contentType: 'non-fiction', topic: 'abstract' },
  commitment: { contentType: 'non-fiction', topic: 'abstract' },
  consequence: { contentType: 'non-fiction', topic: 'abstract' }
}

const FUNCTION_WORDS = new Set([
  'about', 'across', 'agree', 'allow', 'answer', 'arrive', 'become', 'believe',
  'immediately', 'yesterday', 'accept', 'appear', 'avoid', 'break', 'compare',
  'complete', 'continue', 'describe', 'abandon', 'acknowledge', 'acquire',
  'adjust', 'adopt', 'affect', 'alter', 'appreciate', 'approximately', 'arise',
  'assume'
])

export function resolveWordTaxonomy(
  word: string,
  overrides?: Partial<WordTaxonomy>
): WordTaxonomy {
  if (overrides?.contentType && overrides?.topic) {
    return {
      contentType: overrides.contentType,
      topic: overrides.topic,
      tags: overrides.tags || []
    }
  }

  const key = word.toLowerCase()
  if (WORD_TAGS[key]) {
    return { ...WORD_TAGS[key], tags: overrides?.tags || WORD_TAGS[key].tags }
  }

  if (FUNCTION_WORDS.has(key)) {
    return { contentType: 'function', topic: 'abstract', tags: overrides?.tags }
  }

  return {
    contentType: overrides?.contentType || 'non-fiction',
    topic: overrides?.topic || 'abstract',
    tags: overrides?.tags
  }
}
