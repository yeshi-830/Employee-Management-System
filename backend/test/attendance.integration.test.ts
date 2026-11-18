import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { after, before, test } from 'node:test';
import { resolve } from 'node:path';
import { once } from 'node:events';
import type { Server } from 'node:http';
import jwt from 'jsonwebtoken';

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error('Set TEST_DATABASE_URL to an isolated local MySQL database ending in _test.');
}

const databaseUrl = new URL(testDatabaseUrl);
const databaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
if (!['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname) || !databaseName.endsWith('_test')) {
  throw new Error('Integration tests only run against a local database whose name ends in _test.');
}

process.env.DATABASE_URL = testDatabaseUrl;
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'attendance-integration-test-secret-only';

const prismaCli = resolve(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');
const schemaPush = spawnSync(
  process.execPath,
  [prismaCli, 'db', 'push', '--skip-generate'],
  {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    stdio: 'inherit',
  },
);
if (schemaPush.error) throw schemaPush.error;
if (schemaPush.status !== 0) {
  throw new Error('Unable to prepare the isolated integration-test database. Check MySQL availability and test database permissions.');
}

const { prisma } = await import('../src/lib/prisma.js');
const { default: app } = await import('../src/server.js');

const fixtureToken = randomUUID().replaceAll('-', '');
const csrfToken = randomUUID().replaceAll('-', '');
const employeeIds: string[] = [];
const userIds: string[] = [];
const departmentIds: string[] = [];
const attendanceIds: string[] = [];
let server: Server | undefined;
let baseUrl = '';

type TestUser = { id: string; email: string };

async function createEmployee(email: string, employeeNumber: string, departmentId: string) {
  const employee = await prisma.employee.create({
    data: {
      employeeNumber,
      firstName: 'Integration',
      lastName: employeeNumber.slice(-4),
      email,
      departmentId,
      jobTitle: 'Integration Test Employee',
      hireDate: new Date('2024-01-01T00:00:00.000Z'),
    },
  });
  employeeIds.push(employee.id);
  return employee;
}

async function createUser(email: string, role: 'EMPLOYEE' | 'DEPARTMENT_MANAGER' | 'ADMIN') {
  const user = await prisma.user.create({
    data: {
      email,
      password: 'integration-test-only',
      firstName: 'Integration',
      lastName: role,
      role,
    },
  });
  userIds.push(user.id);
  return user;
}

function authHeaders(userId: string, includeCsrf = false): Record<string, string> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${jwt.sign({ sub: userId }, process.env.JWT_SECRET!, {
      expiresIn: '5m',
      issuer: 'employee-management-system',
    })}`,
  };
  if (includeCsrf) {
    headers.cookie = `__csrf=${csrfToken}`;
    headers['x-csrf-token'] = csrfToken;
    headers['content-type'] = 'application/json';
  }
  return headers;
}

async function apiRequest(path: string, userId: string, method = 'GET', includeCsrf = false) {
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: authHeaders(userId, includeCsrf),
    ...(method === 'GET' ? {} : { body: '{}' }),
  });
}

before(async () => {
  await prisma.$connect();

  const departmentA = await prisma.department.create({
    data: { name: `Attendance Test ${fixtureToken} A` },
  });
  const departmentB = await prisma.department.create({
    data: { name: `Attendance Test ${fixtureToken} B` },
  });
  departmentIds.push(departmentA.id, departmentB.id);

  const employeeA = await createEmployee(
    `attendance-a-${fixtureToken}@example.test`,
    `AT-A-${fixtureToken.slice(0, 12)}`,
    departmentA.id,
  );
  const employeeB = await createEmployee(
    `attendance-b-${fixtureToken}@example.test`,
    `AT-B-${fixtureToken.slice(0, 12)}`,
    departmentB.id,
  );
  const manager = await createEmployee(
    `attendance-manager-${fixtureToken}@example.test`,
    `AT-M-${fixtureToken.slice(0, 12)}`,
    departmentA.id,
  );

  const employeeUserA = await createUser(employeeA.email, 'EMPLOYEE');
  await createUser(employeeB.email, 'EMPLOYEE');
  await createUser(manager.email, 'DEPARTMENT_MANAGER');
  await createUser(`attendance-admin-${fixtureToken}@example.test`, 'ADMIN');

  server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  assert(address && typeof address !== 'string');
  baseUrl = `http://127.0.0.1:${address.port}/api`;
  testContext.employeeAUserId = employeeUserA.id;
  testContext.employeeBUserId = (await prisma.user.findUniqueOrThrow({ where: { email: employeeB.email } })).id;
  testContext.managerUserId = (await prisma.user.findUniqueOrThrow({ where: { email: manager.email } })).id;
  testContext.adminUserId = (await prisma.user.findUniqueOrThrow({
    where: { email: `attendance-admin-${fixtureToken}@example.test` },
  })).id;
  testContext.employeeAId = employeeA.id;
  testContext.employeeBId = employeeB.id;
});

const testContext: {
  employeeAUserId: string;
  employeeBUserId: string;
  managerUserId: string;
  adminUserId: string;
  employeeAId: string;
  employeeBId: string;
} = {
  employeeAUserId: '',
  employeeBUserId: '',
  managerUserId: '',
  adminUserId: '',
  employeeAId: '',
  employeeBId: '',
};

after(async () => {
  try {
    if (server) {
      await new Promise<void>((resolveClose, rejectClose) => {
        server!.close((error) => error ? rejectClose(error) : resolveClose());
      });
    }

    await prisma.auditEvent.deleteMany({
      where: {
        OR: [
          { entityType: 'attendance', entityId: { in: attendanceIds } },
          { actorId: { in: userIds } },
        ],
      },
    });
    await prisma.attendanceRecord.deleteMany({ where: { id: { in: attendanceIds } } });
    await prisma.employee.deleteMany({ where: { id: { in: employeeIds } } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.department.deleteMany({ where: { id: { in: departmentIds } } });
  } finally {
    await prisma.$disconnect();
  }
});

test('attendance sessions persist, enforce single open sessions, and respect role scopes', async () => {
  const unauthorized = await fetch(`${baseUrl}/attendance`);
  assert.equal(unauthorized.status, 401);

  const missingCsrf = await apiRequest('/attendance/clock-in', testContext.employeeAUserId, 'POST');
  assert.equal(missingCsrf.status, 403);

  const initialResponse = await apiRequest('/attendance', testContext.employeeAUserId);
  assert.equal(initialResponse.status, 200);
  const initial = await initialResponse.json() as {
    attendanceRecords: unknown[];
    activeRecord: unknown;
    canClock: boolean;
  };
  assert.equal(initial.attendanceRecords.length, 0);
  assert.equal(initial.activeRecord, null);
  assert.equal(initial.canClock, true);

  const clockInResponses = await Promise.all([
    apiRequest('/attendance/clock-in', testContext.employeeAUserId, 'POST', true),
    apiRequest('/attendance/clock-in', testContext.employeeAUserId, 'POST', true),
  ]);
  assert.deepEqual(clockInResponses.map((response) => response.status).sort(), [201, 409]);

  const successfulClockIn = clockInResponses.find((response) => response.status === 201);
  assert(successfulClockIn);
  const clockInResult = await successfulClockIn.json() as {
    attendanceRecord: { id: string; employeeId: string; employeeName: string; clockInAt: string; clockOutAt: null };
  };
  const firstRecordId = clockInResult.attendanceRecord.id;
  attendanceIds.push(firstRecordId);
  assert.equal(clockInResult.attendanceRecord.employeeId, testContext.employeeAId);
  assert.match(clockInResult.attendanceRecord.employeeName, /^Integration /);
  assert.equal(Number.isNaN(Date.parse(clockInResult.attendanceRecord.clockInAt)), false);
  assert.equal(clockInResult.attendanceRecord.clockOutAt, null);

  const otherEmployeeRecord = await prisma.attendanceRecord.create({
    data: {
      employeeId: testContext.employeeBId,
      clockInAt: new Date(Date.now() - 3_600_000),
      clockOutAt: new Date(Date.now() - 1_800_000),
    },
  });
  attendanceIds.push(otherEmployeeRecord.id);

  const [employeeResponse, managerResponse, adminResponse] = await Promise.all([
    apiRequest('/attendance', testContext.employeeAUserId),
    apiRequest('/attendance', testContext.managerUserId),
    apiRequest('/attendance', testContext.adminUserId),
  ]);
  const [employeeList, managerList, adminList] = await Promise.all([
    employeeResponse.json() as Promise<{ attendanceRecords: Array<{ id: string }> }>,
    managerResponse.json() as Promise<{ attendanceRecords: Array<{ id: string }> }>,
    adminResponse.json() as Promise<{ attendanceRecords: Array<{ id: string }> }>,
  ]);
  assert.deepEqual(employeeList.attendanceRecords.map((record) => record.id), [firstRecordId]);
  assert.deepEqual(managerList.attendanceRecords.map((record) => record.id), [firstRecordId]);
  assert.equal(adminList.attendanceRecords.length, 2);

  const clockOutResponse = await apiRequest('/attendance/clock-out', testContext.employeeAUserId, 'POST', true);
  assert.equal(clockOutResponse.status, 200);
  const clockOutResult = await clockOutResponse.json() as {
    attendanceRecord: { id: string; clockInAt: string; clockOutAt: string | null };
  };
  assert.equal(clockOutResult.attendanceRecord.id, firstRecordId);
  assert(clockOutResult.attendanceRecord.clockOutAt);
  assert(Date.parse(clockOutResult.attendanceRecord.clockOutAt) >= Date.parse(clockOutResult.attendanceRecord.clockInAt));

  const duplicateClockOut = await apiRequest('/attendance/clock-out', testContext.employeeAUserId, 'POST', true);
  assert.equal(duplicateClockOut.status, 409);

  const secondClockInResponse = await apiRequest('/attendance/clock-in', testContext.employeeAUserId, 'POST', true);
  assert.equal(secondClockInResponse.status, 201);
  const secondClockIn = await secondClockInResponse.json() as { attendanceRecord: { id: string } };
  attendanceIds.push(secondClockIn.attendanceRecord.id);

  await prisma.employee.update({
    where: { id: testContext.employeeAId },
    data: { employmentStatus: 'INACTIVE' },
  });
  const activeInactiveEmployee = await apiRequest('/attendance', testContext.employeeAUserId);
  const activeStatus = await activeInactiveEmployee.json() as { activeRecord: unknown; canClock: boolean };
  assert(activeStatus.activeRecord);
  assert.equal(activeStatus.canClock, true);

  const finalClockOut = await apiRequest('/attendance/clock-out', testContext.employeeAUserId, 'POST', true);
  assert.equal(finalClockOut.status, 200);
  const inactiveEmployeeState = await apiRequest('/attendance', testContext.employeeAUserId);
  const inactiveState = await inactiveEmployeeState.json() as { activeRecord: unknown; canClock: boolean };
  assert.equal(inactiveState.activeRecord, null);
  assert.equal(inactiveState.canClock, false);

  const auditEvents = await prisma.auditEvent.findMany({
    where: { entityType: 'attendance', entityId: { in: attendanceIds } },
    select: { action: true },
  });
  assert.equal(auditEvents.filter((event) => event.action === 'ATTENDANCE_CLOCKED_IN').length, 2);
  assert.equal(auditEvents.filter((event) => event.action === 'ATTENDANCE_CLOCKED_OUT').length, 2);
});
