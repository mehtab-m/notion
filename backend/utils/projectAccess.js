const prisma = require('../lib/prisma');

/** Projects the user owns or has accepted an invite to */
function accessibleProjectsWhere(user) {
  return {
    OR: [
      { userId: user.id },
      { members: { some: { userId: user.id, status: 'accepted' } } },
    ],
  };
}

async function findAccessibleProject(projectId, user) {
  return prisma.project.findFirst({
    where: {
      id: projectId,
      ...accessibleProjectsWhere(user),
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

module.exports = {
  accessibleProjectsWhere,
  findAccessibleProject,
  findOwnedProject,
  acceptedAssignees,
};
