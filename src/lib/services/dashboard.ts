import { DisciplinaryCaseStatus, InformationStatus } from "@prisma/client";
import { prisma } from "../../../backend/prisma";

export async function getDashboardMetrics(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      campuses: { select: { campusId: true } },
      roles: {
        select: {
          role: {
            select: {
              name: true,
              isGlobal: true,
              permissions: {
                select: { permission: { select: { key: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!user) {
    throw new Error("The authenticated account could not be found.");
  }

  const canViewAllCampuses = user.roles.some(({ role }) => role.isGlobal);
  const permissionKeys = new Set(
    user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  const campusIds = new Set(user.campuses.map(({ campusId }) => campusId));
  const isRepresentative = user.roles.some(
    ({ role }) => role.name === "President's Representative",
  );

  if (isRepresentative && !canViewAllCampuses) {
    campusIds.clear();
    const now = new Date();
    const delegations = await prisma.delegation.findMany({
      where: {
        delegateId: userId,
        startsAt: { lte: now },
        endsAt: { gte: now },
        grantor: {
          roles: { some: { role: { name: "Peace Forum President" } } },
        },
      },
      select: { campusId: true },
    });
    for (const delegation of delegations) campusIds.add(delegation.campusId);
  }

  const accessibleCampuses = await prisma.campus.findMany({
    where: canViewAllCampuses
      ? { isActive: true }
      : { id: { in: [...campusIds] }, isActive: true },
    select: { id: true, name: true, code: true },
    orderBy: { name: "asc" },
  });
  const accessibleCampusIds = accessibleCampuses.map(({ id }) => id);
  const campusFilter = { in: accessibleCampusIds };
  const canReadStudents = permissionKeys.has("student:read");
  const canReadCases = permissionKeys.has("case:read");
  const canReadInformation = permissionKeys.has("information:read");

  const [
    students,
    cases,
    openCases,
    resolvedCases,
    pendingSubmissions,
    studentCampusCounts,
    activities,
    notifications,
  ] =
    await Promise.all([
      canReadStudents && accessibleCampusIds.length > 0
        ? prisma.student.count({ where: { campusId: campusFilter } })
        : Promise.resolve(null),
      canReadCases && accessibleCampusIds.length > 0
        ? prisma.disciplinaryCase.count({
            where: { campusId: campusFilter },
          })
        : Promise.resolve(null),
      canReadCases && accessibleCampusIds.length > 0
        ? prisma.disciplinaryCase.count({
            where: {
              campusId: campusFilter,
              status: {
                in: [
                  DisciplinaryCaseStatus.OPEN,
                  DisciplinaryCaseStatus.UNDER_REVIEW,
                ],
              },
            },
          })
        : Promise.resolve(null),
      canReadCases && accessibleCampusIds.length > 0
        ? prisma.disciplinaryCase.count({
            where: {
              campusId: campusFilter,
              status: DisciplinaryCaseStatus.RESOLVED,
            },
          })
        : Promise.resolve(null),
      canReadInformation && accessibleCampusIds.length > 0
        ? prisma.informationSubmission.count({
            where: {
              campusId: campusFilter,
              status: InformationStatus.PENDING,
            },
          })
        : Promise.resolve(null),
      canReadStudents && accessibleCampusIds.length > 0
        ? prisma.student.groupBy({
            by: ["campusId"],
            where: { campusId: campusFilter },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      prisma.auditLog.findMany({
        where: { actorId: userId },
        select: {
          id: true,
          action: true,
          entityType: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        take: 5,
      }),
      permissionKeys.has("notifications:read")
        ? prisma.notification.findMany({
            where: { recipientId: userId },
            select: {
              id: true,
              title: true,
              message: true,
              createdAt: true,
              readAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 5,
          })
        : Promise.resolve([]),
    ]);

  const studentCounts = new Map<string, number>();
  for (const { campusId, _count } of studentCampusCounts) {
    studentCounts.set(campusId, _count._all);
  }

  return {
    students,
    cases,
    openCases,
    resolvedCases,
    pendingSubmissions,
    campuses: accessibleCampuses.map((campus) => ({
      ...campus,
      students: canReadStudents ? studentCounts.get(campus.id) ?? 0 : null,
    })),
    activities,
    notifications,
  };
}
