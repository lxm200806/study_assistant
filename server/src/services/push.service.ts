import prisma from '../prisma/client'

export async function registerPushToken(
  userId: string,
  token: string,
  platform = 'unknown',
  provider = 'unknown'
) {
  return prisma.pushToken.upsert({
    where: { token },
    create: { userId, token, platform, provider },
    update: { userId, platform, provider, lastSeenAt: new Date() }
  })
}

export async function removePushToken(userId: string, token: string) {
  await prisma.pushToken.deleteMany({ where: { userId, token } })
}
