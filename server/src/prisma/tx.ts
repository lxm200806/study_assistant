import { Prisma } from '@prisma/client'
import prisma from './client'

function isRetryableTxError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    // P2034：串行化事务写冲突/死锁；P2002：并发首次创建同一行
    return error.code === 'P2034' || error.code === 'P2002'
  }
  return false
}

/**
 * 以 Serializable 隔离级别运行事务，冲突时自动重试。
 * 用于「读-改-写」型统计，避免并发请求互相覆盖或重复累加。
 */
export async function runSerializable<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  attempts = 3
): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await prisma.$transaction(fn, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable
      })
    } catch (error) {
      lastError = error
      if (!isRetryableTxError(error)) throw error
    }
  }
  throw lastError
}
