const DEFAULT_HABITS = [
  { name: 'Namaz', icon: '🕌', description: 'Daily prayer', frequency: 'daily' },
  { name: 'Read Book', icon: '📚', description: 'Read for 30 minutes', frequency: 'daily' },
  { name: 'Exercise', icon: '💪', description: 'Stay active', frequency: 'daily' },
  { name: 'Drink Water', icon: '💧', description: 'Stay hydrated', frequency: 'daily' },
  { name: 'Meditate', icon: '🧘', description: 'Mindfulness practice', frequency: 'daily' },
];

async function seedDefaultHabits(prisma, userId) {
  const count = await prisma.habit.count({ where: { userId } });
  if (count > 0) return;

  await prisma.habit.createMany({
    data: DEFAULT_HABITS.map((h) => ({ ...h, userId })),
  });
}

module.exports = { DEFAULT_HABITS, seedDefaultHabits };
