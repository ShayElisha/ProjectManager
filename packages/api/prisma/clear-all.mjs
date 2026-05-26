import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const p of [".env", resolve(process.cwd(), "packages/api/.env")]) {
  if (existsSync(p)) {
    config({ path: p });
    break;
  }
}

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.timesheetEntry.deleteMany();
  await prisma.budgetLineItem.deleteMany();
  await prisma.baseline.deleteMany();
  await prisma.resourceAssignment.deleteMany();
  await prisma.taskDependency.deleteMany();
  await prisma.task.deleteMany();
  await prisma.projectMember.deleteMany();
  await prisma.project.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.organization.deleteMany();
  console.log("MongoDB collections cleared.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
