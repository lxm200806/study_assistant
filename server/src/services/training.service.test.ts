import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => {
  const tx = {
    vocabularyStat: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn()
    },
    trainingRecord: { create: vi.fn() }
  }
  return {
    book: { findUnique: vi.fn() },
    vocabularyStat: { findMany: vi.fn() },
    $transaction: vi.fn(),
    tx
  }
})

vi.mock('../prisma/client', () => ({ default: prismaMock }))

import { getDueCount, isRetryableTransactionError, practice } from './training.service'

function runTransaction(
  implementation: (fn: (tx: typeof prismaMock.tx) => Promise<unknown>) => Promise<unknown>
) {
  prismaMock.$transaction.mockImplementation(implementation)
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.tx.vocabularyStat.findUnique.mockResolvedValue(null)
  prismaMock.tx.vocabularyStat.create.mockResolvedValue({ wordId: 'w1' })
  prismaMock.tx.vocabularyStat.update.mockResolvedValue({ wordId: 'w1' })
  prismaMock.tx.trainingRecord.create.mockResolvedValue({ id: 'r1' })
  runTransaction(async fn => fn(prismaMock.tx))
})

describe('practice', () => {
  it('在同一个事务里写入学习状态与训练流水', async () => {
    const result = await practice('learner-1', { wordId: 'w1', type: 'reading', isCorrect: true })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.$transaction.mock.calls[0][1]).toEqual({ isolationLevel: 'Serializable' })
    expect(prismaMock.tx.vocabularyStat.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.tx.trainingRecord.create).toHaveBeenCalledWith({
      data: { learnerId: 'learner-1', wordId: 'w1', type: 'reading', isCorrect: true }
    })
    expect(result.needsReconfirm).toBe(false)
  })

  it('答错时保留已有的待核对标记', async () => {
    prismaMock.tx.vocabularyStat.findUnique.mockResolvedValue({ id: 's1', needsReconfirm: true })

    const result = await practice('learner-1', { wordId: 'w1', type: 'reading', isCorrect: false })

    const updateData = prismaMock.tx.vocabularyStat.update.mock.calls[0][0].data
    expect(updateData.needsReconfirm).toBe(true)
    expect(result.needsReconfirm).toBe(true)
  })

  it('并发冲突时重试事务', async () => {
    prismaMock.$transaction
      .mockRejectedValueOnce({ code: 'P2034' })
      .mockImplementationOnce(async fn => fn(prismaMock.tx))

    await practice('learner-1', { wordId: 'w1', type: 'reading', isCorrect: true })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
    expect(prismaMock.tx.trainingRecord.create).toHaveBeenCalledTimes(1)
  })

  it('不可重试的错误直接抛出', async () => {
    const error = new Error('boom')
    prismaMock.$transaction.mockRejectedValueOnce(error)

    await expect(
      practice('learner-1', { wordId: 'w1', type: 'reading', isCorrect: true })
    ).rejects.toThrow('boom')
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})

describe('isRetryableTransactionError', () => {
  it('只重试写冲突与唯一约束错误', () => {
    expect(isRetryableTransactionError({ code: 'P2034' })).toBe(true)
    expect(isRetryableTransactionError({ code: 'P2002' })).toBe(true)
    expect(isRetryableTransactionError({ code: 'P2025' })).toBe(false)
    expect(isRetryableTransactionError(new Error('boom'))).toBe(false)
    expect(isRetryableTransactionError(null)).toBe(false)
  })
})

describe('getDueCount', () => {
  it('按词去重统计到期待复习，且包含待跨书核对的词', async () => {
    prismaMock.book.findUnique.mockResolvedValue({
      vocabulary: [{ wordId: 'w1' }, { wordId: 'w2' }]
    })
    prismaMock.vocabularyStat.findMany.mockResolvedValue([{ wordId: 'w1' }, { wordId: 'w2' }])

    const result = await getDueCount('learner-1', 'kew4500', 'reading')

    const query = prismaMock.vocabularyStat.findMany.mock.calls[0][0]
    expect(query.distinct).toEqual(['wordId'])
    expect(query.where.OR).toEqual([
      { due: { lte: expect.any(Date) } },
      { needsReconfirm: true }
    ])
    expect(query.where.type).toBe('reading')
    expect(query.take).toBeUndefined()
    expect(result).toEqual({ dueCount: 2, overdueCount: 2 })
  })

  it('词书不存在时返回 0', async () => {
    prismaMock.book.findUnique.mockResolvedValue(null)

    await expect(getDueCount('learner-1', 'missing')).resolves.toEqual({
      dueCount: 0,
      overdueCount: 0
    })
  })
})
