import { PrismaClient, PublishStatus, TagType, UserRole } from "@prisma/client";
import { hashPassword } from "../lib/auth/password";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL ?? "admin@example.com";
  const adminUsername = process.env.SEED_ADMIN_USERNAME ?? "admin";
  const adminPassword = await hashPassword(process.env.SEED_ADMIN_PASSWORD ?? "change-me-admin");
  const memberEmail = process.env.SEED_MEMBER_EMAIL ?? "member@example.com";
  const memberUsername = process.env.SEED_MEMBER_USERNAME ?? "member";
  const memberPassword = await hashPassword(process.env.SEED_MEMBER_PASSWORD ?? "change-me-member");

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      username: adminUsername,
      passwordHash: adminPassword,
      role: UserRole.ADMIN
    },
    create: {
      email: adminEmail,
      username: adminUsername,
      passwordHash: adminPassword,
      role: UserRole.ADMIN
    }
  });

  await prisma.user.deleteMany({
    where: {
      email: "admin@example.com"
    }
  });

  await prisma.user.upsert({
    where: { email: memberEmail },
    update: {
      username: memberUsername
    },
    create: {
      email: memberEmail,
      username: memberUsername,
      passwordHash: memberPassword,
      role: UserRole.MEMBER
    }
  });

  const tags = await Promise.all([
    prisma.tag.upsert({
      where: { slug: "artist-a" },
      update: {},
      create: { name: "Artist A", slug: "artist-a", type: TagType.AUTHOR }
    }),
    prisma.tag.upsert({
      where: { slug: "blue-archive" },
      update: {},
      create: { name: "Blue Archive", slug: "blue-archive", type: TagType.WORK }
    }),
    prisma.tag.upsert({
      where: { slug: "watercolor" },
      update: {},
      create: { name: "Watercolor", slug: "watercolor", type: TagType.STYLE }
    }),
    prisma.tag.upsert({
      where: { slug: "editorial" },
      update: {},
      create: { name: "Editorial", slug: "editorial", type: TagType.USAGE }
    }),
    prisma.tag.upsert({
      where: { slug: "type-character-card" },
      update: {},
      create: { name: "Character card", slug: "type-character-card", type: TagType.TYPE }
    }),
    prisma.tag.upsert({
      where: { slug: "type-cloth-card" },
      update: {},
      create: { name: "Cloth card", slug: "type-cloth-card", type: TagType.TYPE }
    }),
    prisma.tag.upsert({
      where: { slug: "type-scene-card" },
      update: {},
      create: { name: "Scene Card", slug: "type-scene-card", type: TagType.TYPE }
    }),
    prisma.tag.upsert({
      where: { slug: "type-overlay" },
      update: {},
      create: { name: "Overlay", slug: "type-overlay", type: TagType.TYPE }
    }),
    prisma.tag.upsert({
      where: { slug: "type-texture" },
      update: {},
      create: { name: "Texture", slug: "type-texture", type: TagType.TYPE }
    })
  ]);

  const characterTag = await prisma.tag.upsert({
    where: { slug: "character-blue-archive-hoshino" },
    update: {
      workTagId: tags[1].id
    },
    create: {
      name: "Hoshino",
      slug: "character-blue-archive-hoshino",
      type: TagType.CHARACTER,
      workTagId: tags[1].id
    }
  });

  const content = await prisma.content.upsert({
    where: { slug: "morning-garden" },
    update: {},
    create: {
      title: "Morning Garden",
      slug: "morning-garden",
      description: "A sample published work for the initial browsing experience.",
      coverImageUrl: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1200&q=80",
      publishStatus: PublishStatus.PUBLISHED
    }
  });

  await prisma.contentImage.deleteMany({
    where: { contentId: content.id }
  });

  await prisma.contentImage.create({
    data: {
      contentId: content.id,
      imageUrl: content.coverImageUrl,
      sortOrder: 0
    }
  });

  await prisma.contentTag.upsert({
    where: {
      contentId_tagId: {
        contentId: content.id,
        tagId: tags[0].id
      }
    },
    update: {},
    create: {
      contentId: content.id,
      tagId: tags[0].id
    }
  });

  await prisma.contentTag.upsert({
    where: {
      contentId_tagId: {
        contentId: content.id,
        tagId: tags[2].id
      }
    },
    update: {},
    create: {
      contentId: content.id,
      tagId: tags[2].id
    }
  });

  await prisma.contentTag.upsert({
    where: {
      contentId_tagId: {
        contentId: content.id,
        tagId: tags[3].id
      }
    },
    update: {},
    create: {
      contentId: content.id,
      tagId: tags[3].id
    }
  });

  await prisma.contentTag.upsert({
    where: {
      contentId_tagId: {
        contentId: content.id,
        tagId: tags[4].id
      }
    },
    update: {},
    create: {
      contentId: content.id,
      tagId: tags[4].id
    }
  });

  await prisma.contentTag.upsert({
    where: {
      contentId_tagId: {
        contentId: content.id,
        tagId: tags[1].id
      }
    },
    update: {},
    create: {
      contentId: content.id,
      tagId: tags[1].id
    }
  });

  await prisma.contentTag.upsert({
    where: {
      contentId_tagId: {
        contentId: content.id,
        tagId: characterTag.id
      }
    },
    update: {},
    create: {
      contentId: content.id,
      tagId: characterTag.id
    }
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
