const prisma = require('../lib/prisma');

/** Projects listed on the projects page (owned + accepted invites only) */
function accessibleProjectsWhere(user) {
  return {
    OR: [
      { userId: user.id },
      { members: { some: { userId: user.id, status: 'accepted' } } },
    ],
  };
}

/** View project detail — includes pending invites so invite links work */
function viewableProjectWhere(user) {
  return {
    OR: [
      { userId: user.id },
      {
        members: {
          some: {
            OR: [
              { userId: user.id, status: { in: ['pending', 'accepted'] } },
              { email: user.email, status: { in: ['pending', 'accepted'] } },
            ],
          },
        },
      },
    ],
  };
}

/** Edit project — owner or accepted members only */
function editableProjectWhere(user) {
  return {
    OR: [
      { userId: user.id },
      { members: { some: { userId: user.id, status: 'accepted' } } },
    ],
  };
}

async function findAccessibleProject(projectId, user) {
  return prisma.project.findFirst({
    where: { id: projectId, ...viewableProjectWhere(user) },
    include: {
      members: { orderBy: { createdAt: 'asc' } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
}

async function findEditableProject(projectId, user) {
  return prisma.project.findFirst({
    where: { id: projectId, ...editableProjectWhere(user) },
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
  viewableProjectWhere,
  editableProjectWhere,
  findAccessibleProject,
  findEditableProject,
  findOwnedProject,
  acceptedAssignees,
};
