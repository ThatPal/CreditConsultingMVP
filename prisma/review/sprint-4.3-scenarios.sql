-- Idempotent local-review scenarios for the persistent Phase 4-5 Credit database.
INSERT INTO "ClientGoal" (id, "clientId", "goalType", scope, "targetAmount", "allowAnnualFee", "cardTypePreference", "offerPreferences", "feePreference", priority, status, version, "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, 'TOTAL_AVAILABLE_CREDIT', 'PERSONAL', 50000, false, 'NO_PREFERENCE', ARRAY[]::"GoalOfferPreference"[], 'NO_ANNUAL_FEE_ONLY', 'PRIMARY', 'ACTIVE', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Client" c JOIN "User" u ON u.id=c."userId" AND u.email='client@credit.local'
WHERE NOT EXISTS (SELECT 1 FROM "ClientGoal" WHERE "clientId"=c.id AND status='ACTIVE');

WITH subject AS (
  SELECT c.id AS client_id, j.id AS journey_id, g.id AS goal_id, g.version, g."goalType", g.scope,
         g."targetAmount", g."allowAnnualFee", g."cardTypePreference", g."offerPreferences",
         g."feePreference", g."preferenceNote"
  FROM "Client" c
  JOIN "User" u ON u.id = c."userId" AND u.email = 'client@credit.local'
  JOIN "CreditJourney" j ON j."clientId" = c.id
  JOIN LATERAL (SELECT * FROM "ClientGoal" WHERE "clientId" = c.id AND status = 'ACTIVE' ORDER BY priority, id LIMIT 1) g ON TRUE
), inserted AS (
  INSERT INTO "ApplicationCycle" (id, "clientId", "journeyId", "cycleNumber", "displayName", status, "currentStage", "startedAt", "closedAt", "finalResult", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), client_id, journey_id, 1, 'Historical review cycle', 'COMPLETE', 'FINAL_RESULTS', '2025-09-01T14:00:00Z', '2025-11-15T14:00:00Z', 'Review completed; no outcome guarantee recorded.', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM subject WHERE NOT EXISTS (SELECT 1 FROM "ApplicationCycle" WHERE "clientId" = subject.client_id AND "displayName" = 'Historical review cycle')
  RETURNING id, "clientId"
)
INSERT INTO "CycleGoalSnapshot" (id, "cycleId", "sourceGoalId", "sourceGoalVersion", "goalType", scope, "targetAmount", "allowAnnualFee", "cardTypePreference", "offerPreferences", "feePreference", "preferenceNote", "capturedAt")
SELECT gen_random_uuid(), inserted.id, subject.goal_id, subject.version, subject."goalType", subject.scope, subject."targetAmount", subject."allowAnnualFee", subject."cardTypePreference", subject."offerPreferences", subject."feePreference", subject."preferenceNote", '2025-09-01T14:00:00Z'
FROM inserted JOIN subject ON subject.client_id = inserted."clientId";

WITH subject AS (
  SELECT c.id AS client_id, j.id AS journey_id, g.id AS goal_id, g.version, g."goalType", g.scope,
         g."targetAmount", g."allowAnnualFee", g."cardTypePreference", g."offerPreferences",
         g."feePreference", g."preferenceNote"
  FROM "Client" c
  JOIN "User" u ON u.id = c."userId" AND u.email = 'client@credit.local'
  JOIN "CreditJourney" j ON j."clientId" = c.id
  JOIN LATERAL (SELECT * FROM "ClientGoal" WHERE "clientId" = c.id AND status = 'ACTIVE' ORDER BY priority, id LIMIT 1) g ON TRUE
), inserted AS (
  INSERT INTO "ApplicationCycle" (id, "clientId", "journeyId", "cycleNumber", "displayName", status, "currentStage", "startedAt", "createdAt", "updatedAt")
  SELECT gen_random_uuid(), client_id, journey_id, 2, 'Current onboarding cycle', 'ACTIVE', 'CREDIT_REVIEW', '2026-08-25T14:00:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
  FROM subject WHERE NOT EXISTS (SELECT 1 FROM "ApplicationCycle" WHERE "clientId" = subject.client_id AND status = 'ACTIVE')
  RETURNING id, "clientId"
)
INSERT INTO "CycleGoalSnapshot" (id, "cycleId", "sourceGoalId", "sourceGoalVersion", "goalType", scope, "targetAmount", "allowAnnualFee", "cardTypePreference", "offerPreferences", "feePreference", "preferenceNote", "capturedAt")
SELECT gen_random_uuid(), inserted.id, subject.goal_id, subject.version, subject."goalType", subject.scope, subject."targetAmount", subject."allowAnnualFee", subject."cardTypePreference", subject."offerPreferences", subject."feePreference", subject."preferenceNote", '2026-08-25T14:00:00Z'
FROM inserted JOIN subject ON subject.client_id = inserted."clientId";

INSERT INTO "NurturePeriod" (id, "clientId", "journeyId", status, "reasonCode", "startedAt", "endedAt", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, j.id, 'COMPLETE', 'HISTORICAL_PREPARATION', '2026-01-10T14:00:00Z', '2026-03-10T14:00:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Client" c JOIN "User" u ON u.id=c."userId" AND u.email='client@credit.local' JOIN "CreditJourney" j ON j."clientId"=c.id
WHERE NOT EXISTS (SELECT 1 FROM "NurturePeriod" WHERE "clientId"=c.id AND "reasonCode"='HISTORICAL_PREPARATION');

INSERT INTO "NurturePeriod" (id, "clientId", "journeyId", status, "reasonCode", "startedAt", "expectedEnd", "createdAt", "updatedAt")
SELECT gen_random_uuid(), c.id, j.id, 'ACTIVE', 'UTILIZATION_PREPARATION', CURRENT_TIMESTAMP, '2026-11-01T14:00:00Z', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Client" c JOIN "User" u ON u.id=c."userId" AND u.email='client-directory-02@credit.local' JOIN "CreditJourney" j ON j."clientId"=c.id
WHERE NOT EXISTS (SELECT 1 FROM "NurturePeriod" WHERE "clientId"=c.id AND status='ACTIVE');
