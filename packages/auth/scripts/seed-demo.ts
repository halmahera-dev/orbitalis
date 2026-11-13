import { db } from "@repo/db";
import { account, user } from "@repo/db/schema/auth";
import { hashPassword } from "better-auth/crypto";
import { createLocalAccountIssuer } from "better-auth/db";
import { inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";

// Synthetic demo data only. Every demo account shares this local test password.
const demoPassword = "landas-demo";

const demoUsers = [
  { name: "Dewi Regulator", email: "regulator@landas.test" },
  { name: "Budi Inspector", email: "inspector@landas.test" },
  { name: "Sari Planner", email: "planner@landas.test" },
];

await db.delete(user).where(
  inArray(
    user.email,
    demoUsers.map((demoUser) => demoUser.email),
  ),
);

const passwordHash = await hashPassword(demoPassword);

for (const demoUser of demoUsers) {
  const userId = randomUUID();
  await db.insert(user).values({ id: userId, ...demoUser, emailVerified: true });
  await db.insert(account).values({
    id: randomUUID(),
    issuer: createLocalAccountIssuer("credential"),
    accountId: userId,
    providerId: "credential",
    userId,
    password: passwordHash,
  });
}

console.log(`Seeded ${demoUsers.length} demo accounts. Password: "${demoPassword}".`);
for (const demoUser of demoUsers) {
  console.log(`  ${demoUser.email}`);
}
