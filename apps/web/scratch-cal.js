process.env.DATABASE_URL = "postgresql://postgres:%23%2CD7FxsgLxaQMP8@db.zjsgddkmanzjhyjzigzf.supabase.co:5432/postgres";
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const branches = await prisma.branch.findMany({
    include: {
      restaurant: true,
      tableTypes: true
    }
  });

  for (const b of branches) {
    console.log(`Branch Name: ${b.name}`);
    console.log(`Branch ID: ${b.id}`);
    console.log(`Restaurant Slug: ${b.restaurant?.slug}`);
    console.log(`Restaurant Timezone: ${b.restaurant?.timezone}`);
    console.log(`TableTypes:`);
    for (const tt of b.tableTypes) {
      console.log(`  - ID: ${tt.id}, Name: ${tt.name}, CalcomEventId: ${tt.calcomEventId}`);
    }
    console.log('-------------------------------');
  }
}

main()
  .catch(e => console.error(e))
  .finally(() => {
    prisma.$disconnect();
    pool.end();
  });
