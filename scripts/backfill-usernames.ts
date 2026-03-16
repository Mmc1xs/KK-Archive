import { db } from "../lib/db";
import { generateUniqueUsername, getEmailUsernameSeed } from "../lib/auth/username";

async function main() {
  const users = await db.user.findMany({
    where: {
      username: null
    },
    select: {
      id: true,
      email: true
    }
  });

  for (const user of users) {
    await db.user.update({
      where: { id: user.id },
      data: {
        username: await generateUniqueUsername(getEmailUsernameSeed(user.email))
      }
    });
  }

  console.log(`Backfilled usernames for ${users.length} user(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
