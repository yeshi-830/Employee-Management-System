import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.auditEvent.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();
  await prisma.leaveType.deleteMany();

  const hr = await prisma.user.create({
    data: {
      email: 'hr@northstar.example',
      password: '$2a$10$QkPpRrY0QJfPeJQp49K5m.h0v7KfK8tBc4b8kJoE0U4wWxn7Hsl9uO',
      firstName: 'Ari',
      lastName: 'Green',
      role: 'HR_MANAGER',
      isActive: true,
    },
  });

  const engineering = await prisma.department.create({
    data: {
      name: 'Engineering',
      description: 'Product and platform work',
      budget: 120000,
    },
  });

  const people = await prisma.department.create({
    data: {
      name: 'People Ops',
      description: 'HR operations and employee lifecycle',
      budget: 45000,
    },
  });

  const annual = await prisma.leaveType.create({
    data: {
      name: 'Annual Leave',
      description: 'Regular vacation leave',
      daysAllowed: 20,
    },
  });

  const sick = await prisma.leaveType.create({
    data: {
      name: 'Sick Leave',
      description: 'Medical absences',
      daysAllowed: 10,
    },
  });

  const manager = await prisma.employee.create({
    data: {
      employeeNumber: 'EMP-101',
      firstName: 'Nia',
      lastName: 'Cooper',
      email: 'nia.cooper@northstar.example',
      phone: '+1-555-0101',
      departmentId: engineering.id,
      jobTitle: 'Engineering Manager',
      hireDate: new Date('2021-04-10'),
      employmentStatus: 'ACTIVE',
    },
  });

  await prisma.employee.create({
    data: {
      employeeNumber: 'EMP-102',
      firstName: 'Leo',
      lastName: 'Hart',
      email: 'leo.hart@northstar.example',
      phone: '+1-555-0102',
      departmentId: engineering.id,
      jobTitle: 'Frontend Engineer',
      managerId: manager.id,
      hireDate: new Date('2023-10-04'),
      employmentStatus: 'ACTIVE',
    },
  });

  await prisma.employee.create({
    data: {
      employeeNumber: 'EMP-103',
      firstName: 'Mila',
      lastName: 'Reed',
      email: 'mila.reed@northstar.example',
      phone: '+1-555-0103',
      departmentId: people.id,
      jobTitle: 'HR Specialist',
      hireDate: new Date('2022-08-15'),
      employmentStatus: 'PROBATION',
    },
  });

  await prisma.leaveRequest.create({
    data: {
      employeeId: manager.id,
      leaveTypeId: annual.id,
      startDate: new Date('2026-11-01'),
      endDate: new Date('2026-11-05'),
      reason: 'Family vacation',
      status: 'PENDING',
    },
  });

  await prisma.auditEvent.create({
    data: {
      actorId: hr.id,
      action: 'SEED_DATA_CREATED',
      entityType: 'system',
      entityId: 'initial-seed',
      metadata: { source: 'prisma-seed' },
    },
  });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
