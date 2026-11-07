import { prisma } from "../prisma";

export async function listNotifications(recipientId: string) {
  return prisma.notification.findMany({
    where: { recipientId },
    select: {
      id: true,
      title: true,
      message: true,
      readAt: true,
      createdAt: true,
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 100,
  });
}

export async function setNotificationReadState(
  notificationId: string,
  recipientId: string,
  read: boolean,
) {
  const updated = await prisma.notification.updateMany({
    where: { id: notificationId, recipientId },
    data: { readAt: read ? new Date() : null },
  });
  if (updated.count !== 1) return false;
  return true;
}
