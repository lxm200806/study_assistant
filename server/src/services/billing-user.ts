import prisma from '../prisma/client'

export async function getBillingUser(learnerId: string) {
  const learner = await prisma.learner.findUnique({
    where: { id: learnerId },
    include: { account: true }
  })
  return learner?.account || null
}
