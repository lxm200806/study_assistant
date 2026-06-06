export interface ChatScenario {
  id: string
  label: string
  alexRole: string
  userRole: string
  openingLine: string
}

export const BUILT_IN_SCENARIOS: ChatScenario[] = [
  {
    id: 'cafe',
    label: '咖啡馆点餐',
    alexRole: 'barista at a cozy café',
    userRole: 'customer',
    openingLine: "Welcome! What can I get for you today?"
  },
  {
    id: 'shopping',
    label: '逛商场',
    alexRole: 'shop assistant in a clothing store',
    userRole: 'customer',
    openingLine: "Hi there! Can I help you find anything?"
  },
  {
    id: 'directions',
    label: '问路',
    alexRole: 'friendly local who knows the area well',
    userRole: 'visitor who is lost',
    openingLine: "Hey, you look a bit lost — need some help?"
  },
  {
    id: 'doctor',
    label: '看医生',
    alexRole: 'doctor at a clinic',
    userRole: 'patient',
    openingLine: "Good morning! What brings you in today?"
  },
  {
    id: 'hotel',
    label: '酒店入住',
    alexRole: 'hotel receptionist',
    userRole: 'guest checking in',
    openingLine: "Good evening! Do you have a reservation with us?"
  },
  {
    id: 'airport',
    label: '机场对话',
    alexRole: 'fellow traveler sitting next to you at the gate',
    userRole: 'traveler',
    openingLine: "Long wait, huh? Where are you headed?"
  },
  {
    id: 'birthday',
    label: '生日派对',
    alexRole: 'friend who organised the birthday party',
    userRole: 'guest at the party',
    openingLine: "So glad you could make it! Want something to drink?"
  },
  {
    id: 'interview',
    label: '工作面试',
    alexRole: 'interviewer at a company',
    userRole: 'job applicant',
    openingLine: "Thanks for coming in today. Tell me a little about yourself."
  }
]

export function findScenario(idOrLabel: string): ChatScenario | undefined {
  return BUILT_IN_SCENARIOS.find(
    s => s.id === idOrLabel || s.label === idOrLabel
  )
}
