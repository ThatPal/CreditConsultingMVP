import './entry-f1-guard.mjs';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createPrisma } from '../apps/api/src/lib/prisma.js';

if (new URL(process.env.DATABASE_URL!).port !== '5549')
  throw new Error('Legacy evidence requires the dedicated 5549 disposable container');
const prisma = createPrisma(process.env.DATABASE_URL!);
const path = '.tmp/entry-legacy-baseline.json';
try {
  if (process.argv[2] === 'seed') {
    const userId = randomUUID(),
      clientId = randomUUID();
    await prisma.$executeRaw`INSERT INTO "User" (id, email, name, role, "updatedAt") VALUES (${userId}::uuid, 'legacy-entry@example.test', 'Legacy Entry', 'CLIENT', NOW())`;
    await prisma.$executeRaw`INSERT INTO "Client" (id, "userId", "firstName", "lastName", "termsAcceptedAt", "updatedAt") VALUES (${clientId}::uuid, ${userId}::uuid, 'Legacy', 'Entry', NOW(), NOW())`;
    const goal = await prisma.clientGoal.create({
      data: {
        clientId,
        goalType: 'TOTAL_AVAILABLE_CREDIT',
        scope: 'PERSONAL',
        targetAmount: 55000,
        currentAmount: 12000,
        priority: 'PRIMARY',
        version: 3,
      },
    });
    const revision = await prisma.clientGoalRevision.create({
      data: {
        goalId: goal.id,
        clientId,
        version: 3,
        goalType: goal.goalType,
        scope: goal.scope,
        targetAmount: goal.targetAmount,
        allowAnnualFee: false,
        priority: 'PRIMARY',
        status: 'ACTIVE',
      },
    });
    const journey = await prisma.creditJourney.create({ data: { clientId } });
    const cycle = await prisma.applicationCycle.create({
      data: { clientId, journeyId: journey.id, cycleNumber: 1 },
    });
    const snapshot = await prisma.cycleGoalSnapshot.create({
      data: {
        cycleId: cycle.id,
        sourceGoalId: goal.id,
        sourceGoalVersion: 3,
        goalType: goal.goalType,
        scope: goal.scope,
        targetAmount: goal.targetAmount,
        allowAnnualFee: false,
        cardTypePreference: 'NO_PREFERENCE',
        feePreference: 'NO_ANNUAL_FEE_ONLY',
      },
    });
    const intake = await prisma.anonymousGoalIntake.create({
      data: {
        tokenHash: 'legacy-entry-hash',
        goalType: goal.goalType,
        scope: goal.scope,
        targetAmount: 55000,
        firstName: 'Legacy',
        lastName: 'Entry',
        email: 'legacy-entry@example.test',
        expiresAt: new Date(0),
        consumedAt: new Date(),
        consumedByClientId: clientId,
      },
    });
    const claimId = randomUUID();
    await prisma.$executeRaw`INSERT INTO "GoalIntakeRegistrationClaim" (id, "registrationEmailHash", "intakeTokenHash", "expiresAt") VALUES (${claimId}::uuid, 'legacy-email-hash', 'legacy-entry-hash', NOW())`;
    fs.writeFileSync(
      path,
      JSON.stringify({ clientId, userId, claimId, goal, revision, snapshot, intake }, null, 2),
    );
    console.log(
      'Representative legacy Goal, revision, cycle snapshot, consumed intake and email-only claim seeded.',
    );
  } else if (process.argv[2] === 'verify') {
    const before = JSON.parse(fs.readFileSync(path, 'utf8'));
    const serialize = (value: unknown) => JSON.parse(JSON.stringify(value));
    assert.deepEqual(
      serialize(await prisma.clientGoal.findUniqueOrThrow({ where: { id: before.goal.id } })),
      before.goal,
    );
    assert.deepEqual(
      serialize(
        await prisma.clientGoalRevision.findUniqueOrThrow({ where: { id: before.revision.id } }),
      ),
      before.revision,
    );
    assert.deepEqual(
      serialize(
        await prisma.cycleGoalSnapshot.findUniqueOrThrow({ where: { id: before.snapshot.id } }),
      ),
      before.snapshot,
    );
    assert.deepEqual(
      serialize(
        await prisma.anonymousGoalIntake.findUniqueOrThrow({ where: { id: before.intake.id } }),
      ),
      before.intake,
    );
    const client = await prisma.client.findUniqueOrThrow({ where: { id: before.clientId } });
    assert.equal(client.goalSetVersion, 0);
    const claim = await prisma.goalIntakeRegistrationClaim.findUniqueOrThrow({
      where: { id: before.claimId },
    });
    for (const field of [
      'registrationAttemptKeyHash',
      'requestHash',
      'intakeVersion',
      'attachedUserId',
      'attachedClientId',
      'attachedAt',
    ] as const)
      assert.equal(claim[field], null);
    assert.equal(await prisma.goalIntakeResolution.count(), 0);
    await assert.rejects(
      prisma.client.update({ where: { id: client.id }, data: { goalSetVersion: -1 } }),
    );
    await assert.rejects(
      prisma.goalIntakeRegistrationClaim.create({
        data: {
          registrationEmailHash: 'constraint-test',
          intakeTokenHash: 'constraint-test',
          registrationAttemptKeyHash: randomUUID(),
          requestHash: 'test',
          expiresAt: new Date(),
        },
      }),
    );
    fs.writeFileSync(
      'docs/evidence/entry-f1/migration.json',
      JSON.stringify(
        {
          status: 'PASS',
          database: 'credit_strategy_entry_f1_test',
          port: 5549,
          baseMigrations: 69,
          additiveMigration: '20260922000000_entry_f1',
          assertions: [
            'Goal unchanged including currentAmount/version',
            'revision unchanged',
            'historical cycle snapshot unchanged',
            'consumed intake unchanged',
            'legacy claim remains unattached with null new fields',
            'new collection epoch is zero',
            'no fabricated resolutions',
            'negative epoch rejected',
            'partial new claim rejected',
          ],
        },
        null,
        2,
      ),
    );
    console.log('PASS: all legacy preservation and additive constraint assertions.');
  } else throw new Error('Use seed before migration, then verify after migration');
} finally {
  await prisma.$disconnect();
}
