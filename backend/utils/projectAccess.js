const prisma = require('../lib/prisma');

async function findAccessibleProject(projectId, user) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { userId: user.id },
        {
          members: {
            some: {
              OR: [
                { userId: user.id, status: 'accepted' },
                { email: user.email, status: { in: ['pending', 'accepted'] } },
              ],
            },
          },
        },
      ],
    },
    include: {
      members: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

async function findOwnedProject(projectId, userId) {
  return prisma.project.findFirst({
    where: { id: projectId, userId },
    include: {
      members: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

function acceptedAssignees(project) {
  const names = (project.members || [])
    .filter((m) => m.status === 'accepted')
    .map((m) => m.name || m.email.split('@')[0]);
  if (project.user?.name) names.unshift(project.user.name);
  return [...new Set(names)];
}

module.exports = { findAccessibleProject, findOwnedProject, acceptedAssignees };
