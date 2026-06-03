import prisma from '../prisma/client'

export async function sendMessage(userId: string, content: string) {
  await prisma.chatRecord.create({
    data: {
      userId,
      role: 'user',
      content
    }
  })
  
  const aiResponse = generateAIResponse(content)
  
  await prisma.chatRecord.create({
    data: {
      userId,
      role: 'ai',
      content: aiResponse
    }
  })
  
  return {
    userMessage: content,
    aiResponse
  }
}

export async function getChatHistory(userId: string, page: number = 1, limit: number = 20) {
  const skip = (page - 1) * limit
  
  return prisma.chatRecord.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    skip,
    take: limit
  })
}

function generateAIResponse(userMessage: string): string {
  const responses = [
    'That sounds great! Tell me more about it.',
    'I understand. How can I help you further?',
    'Interesting! What do you think about that?',
    'Good point! Let me think...',
    'Thanks for sharing! I appreciate your perspective.',
    'I see. Have you considered trying something new?',
    'That\'s a great idea! Keep going.',
    'I\'m here to help if you need anything.',
    'Let\'s practice some vocabulary together!',
    'What word would you like to learn today?'
  ]
  
  const greetingResponses = [
    'Hello! How can I assist you today?',
    'Hi there! What would you like to practice?',
    'Welcome! Let\'s start learning together!'
  ]
  
  const greetings = ['hello', 'hi', 'hey', 'greetings', 'good morning', 'good afternoon', 'good evening']
  
  const lowerMessage = userMessage.toLowerCase()
  
  if (greetings.some(greeting => lowerMessage.includes(greeting))) {
    return greetingResponses[Math.floor(Math.random() * greetingResponses.length)]
  }
  
  return responses[Math.floor(Math.random() * responses.length)]
}