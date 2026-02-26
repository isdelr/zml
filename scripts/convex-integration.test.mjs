#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { ConvexHttpClient } from "convex/browser";

const DEFAULT_ENV_FILE = ".env.docker.dev";
const NOTIFICATION_PAGE_SIZE = 50;
const NOTIFICATION_PAGE_LIMIT = 5;
const POLL_DELAY_MS = 200;
const POLL_ATTEMPTS = 30;

function loadEnv() {
  const envFile = path.resolve(process.cwd(), DEFAULT_ENV_FILE);
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
  const envLocal = path.resolve(process.cwd(), ".env.local");
  if (fs.existsSync(envLocal)) {
    dotenv.config({ path: envLocal, override: false });
  }
  dotenv.config({ override: false });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function createAdminClient() {
  const convexUrl = requireEnv("CONVEX_SELF_HOSTED_URL");
  const adminKey = requireEnv("CONVEX_SELF_HOSTED_ADMIN_KEY");
  const client = new ConvexHttpClient(convexUrl);
  client.setAdminAuth(adminKey);
  return client;
}

function createUserClient(userId) {
  const convexUrl = requireEnv("CONVEX_SELF_HOSTED_URL");
  const adminKey = requireEnv("CONVEX_SELF_HOSTED_ADMIN_KEY");
  const client = new ConvexHttpClient(convexUrl);
  client.setAdminAuth(adminKey, {
    subject: userId,
    issuer: "https://docker.dev.local",
  });
  return client;
}

function createUnauthClient() {
  const convexUrl = requireEnv("CONVEX_SELF_HOSTED_URL");
  return new ConvexHttpClient(convexUrl);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(predicate, message) {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    // eslint-disable-next-line no-await-in-loop
    const result = await predicate();
    if (result) {
      return result;
    }
    // eslint-disable-next-line no-await-in-loop
    await sleep(POLL_DELAY_MS);
  }
  throw new Error(message);
}

async function findNotificationsByMarkers(client, markers) {
  const found = new Map();
  let cursor = null;

  for (let pageIndex = 0; pageIndex < NOTIFICATION_PAGE_LIMIT; pageIndex += 1) {
    // eslint-disable-next-line no-await-in-loop
    const page = await client.query("notifications:getForUser", {
      paginationOpts: { cursor, numItems: NOTIFICATION_PAGE_SIZE },
    });

    for (const notification of page.page) {
      for (const marker of markers) {
        if (
          !found.has(marker) &&
          notification.message.includes(marker)
        ) {
          found.set(marker, notification);
        }
      }
    }

    if (found.size === markers.length || page.isDone || !page.continueCursor) {
      break;
    }
    cursor = page.continueCursor;
  }

  return found;
}

loadEnv();

test("Convex critical paths on Docker self-hosted backend", async () => {
  const admin = createAdminClient();
  const unauth = createUnauthClient();
  const namespace = `plan-finish-${Date.now()}`;

  await admin.mutation("devSeed:resetNamespace", { namespace }).catch(() => null);

  const seedResult = await admin.mutation("devSeed:seedNamespace", {
    namespace,
    cleanupFirst: true,
    fakeUsers: 8,
    simulateActivity: false,
  });

  const leagueOpenId = seedResult.leagues.open;
  const leagueVotingId = seedResult.leagues.voting;
  const roundVotingId = seedResult.rounds.voting;

  const openLeague = await admin.query("leagues:get", { leagueId: leagueOpenId });
  assert.ok(openLeague, "Expected seeded open league");
  const ownerId = openLeague.creatorId;
  const ownerClient = createUserClient(ownerId);

  await assert.rejects(
    () =>
      unauth.mutation("leagues:manageInviteCode", {
        leagueId: leagueOpenId,
        action: "enable",
      }),
    /permission|Authentication required|Not authenticated|logged in/i,
  );

  const inviteResult = await ownerClient.mutation("leagues:manageInviteCode", {
    leagueId: leagueOpenId,
    action: "enable",
  });
  assert.ok(
    typeof inviteResult.newCode === "string" && inviteResult.newCode.length > 0,
    "Expected invite code regeneration for authorized owner",
  );

  const openMemberships = await admin.query("notifications:getLeagueMemberships", {
    leagueId: leagueOpenId,
  });
  const openSpectator = openMemberships.find((membership) => membership.isSpectator);
  assert.ok(openSpectator, "Expected a seeded spectator in open league");

  const spectatorId = openSpectator.userId;
  const spectatorClient = createUserClient(spectatorId);

  await ownerClient.mutation("leagues:kickMember", {
    leagueId: leagueOpenId,
    memberIdToKick: spectatorId,
  });

  const openJoinResult = await spectatorClient.mutation("leagues:joinPublicLeague", {
    leagueId: leagueOpenId,
    asSpectator: false,
  });
  assert.equal(openJoinResult, leagueOpenId);

  const openStandings = await admin.query("leagues:getLeagueStandings", {
    leagueId: leagueOpenId,
  });
  assert.ok(
    openStandings.some((standing) => standing.userId === spectatorId),
    "Expected re-joined member to get standings row",
  );

  const votingSubmissions = await admin.query("submissions:getForRound", {
    roundId: roundVotingId,
  });
  assert.ok(votingSubmissions.length > 0, "Expected seeded submissions in voting round");

  const targetSubmission = votingSubmissions[0];
  const submitterClient = createUserClient(targetSubmission.userId);

  await assert.rejects(
    () => unauth.mutation("votes:castVote", { submissionId: targetSubmission._id, delta: 1 }),
    /Not authenticated/i,
  );

  await assert.rejects(
    () =>
      submitterClient.mutation("votes:castVote", {
        submissionId: targetSubmission._id,
        delta: 1,
      }),
    /own submission/i,
  );

  const votingMemberships = await admin.query("notifications:getLeagueMemberships", {
    leagueId: leagueVotingId,
  });
  const votingSpectator =
    votingMemberships.find((membership) => membership.userId === spectatorId) ??
    votingMemberships.find((membership) => membership.isSpectator);
  assert.ok(votingSpectator, "Expected spectator in voting league");

  await ownerClient.mutation("leagues:kickMember", {
    leagueId: leagueVotingId,
    memberIdToKick: votingSpectator.userId,
  });

  const votingJoinResult = await createUserClient(votingSpectator.userId).mutation(
    "leagues:joinPublicLeague",
    {
      leagueId: leagueVotingId,
      asSpectator: false,
    },
  );
  assert.equal(votingJoinResult, leagueVotingId);

  await assert.rejects(
    () =>
      createUserClient(votingSpectator.userId).mutation("votes:castVote", {
        submissionId: targetSubmission._id,
        delta: 1,
      }),
    /must submit a song/i,
  );

  const recipientId = spectatorId;
  const triggeringUserId = ownerId === recipientId ? targetSubmission.userId : ownerId;
  const recipientClient = createUserClient(recipientId);

  await recipientClient.mutation("notifications:markAllAsRead", {});

  const markerOne = `[PLAN TEST ${namespace}] comment one`;
  await admin.mutation("notifications:create", {
    userId: recipientId,
    type: "new_comment",
    message: markerOne,
    link: `/leagues/${leagueVotingId}/round/${roundVotingId}?marker=one`,
    triggeringUserId,
  });

  const unreadAfterOne = await waitFor(
    async () => {
      const unread = await recipientClient.query("notifications:getUnreadCount", {});
      return unread >= 1 ? unread : null;
    },
    "Timed out waiting for first unread notification",
  );
  assert.ok(unreadAfterOne >= 1);

  const markerOneNotification = await waitFor(
    async () => {
      const found = await findNotificationsByMarkers(recipientClient, [markerOne]);
      return found.get(markerOne) ?? null;
    },
    "Timed out waiting for first marker notification to be visible",
  );
  assert.ok(markerOneNotification, "Expected seeded test notification to be present");

  await recipientClient.mutation("notifications:markAsRead", {
    notificationId: markerOneNotification._id,
  });

  await recipientClient.mutation("notifications:markAllAsRead", {});
  const markerOneRead = await waitFor(
    async () => {
      const found = await findNotificationsByMarkers(recipientClient, [markerOne]);
      const notification = found.get(markerOne);
      if (!notification) {
        return null;
      }
      return notification.read ? notification : null;
    },
    "Timed out waiting for marker one notification to become read",
  );
  assert.ok(markerOneRead.read);

  const markerTwo = `[PLAN TEST ${namespace}] comment two`;
  const markerThree = `[PLAN TEST ${namespace}] comment three`;
  await admin.mutation("notifications:createMany", {
    notifications: [
      {
        userId: recipientId,
        type: "new_comment",
        message: markerTwo,
        link: `/leagues/${leagueVotingId}/round/${roundVotingId}?marker=two`,
        triggeringUserId,
      },
      {
        userId: recipientId,
        type: "new_comment",
        message: markerThree,
        link: `/leagues/${leagueVotingId}/round/${roundVotingId}?marker=three`,
        triggeringUserId,
      },
    ],
  });

  const unreadAfterMany = await waitFor(
    async () => {
      const unread = await recipientClient.query("notifications:getUnreadCount", {});
      return unread >= 2 ? unread : null;
    },
    "Timed out waiting for multiple unread notifications",
  );
  assert.ok(unreadAfterMany >= 2);

  const createdMarkers = await waitFor(
    async () => {
      const found = await findNotificationsByMarkers(recipientClient, [
        markerTwo,
        markerThree,
      ]);
      return found.size === 2 ? found : null;
    },
    "Timed out waiting for marker two/three notifications",
  );
  assert.equal(createdMarkers.size, 2);

  await recipientClient.mutation("notifications:markAllAsRead", {});
  const markersRead = await waitFor(
    async () => {
      const found = await findNotificationsByMarkers(recipientClient, [
        markerTwo,
        markerThree,
      ]);
      if (found.size !== 2) {
        return null;
      }
      const allRead = [...found.values()].every((notification) => notification.read);
      return allRead ? found : null;
    },
    "Timed out waiting for marker notifications to become read after markAllAsRead",
  );
  assert.equal(markersRead.size, 2);

  await admin.mutation("devSeed:resetNamespace", { namespace });
});
