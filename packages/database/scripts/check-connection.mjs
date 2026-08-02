import 'dotenv/config';

import {
  createPrismaClient,
} from '../dist/index.js';

const database = createPrismaClient();

try {
  const rows = await database.$queryRaw`
    SELECT
      current_database() AS database_name,
      current_user AS database_user,
      current_setting('TimeZone') AS timezone,
      1::integer AS connection_ok
  `;

  const result = rows[0];

  if (!result) {
    throw new Error(
      'PostgreSQL no devolvió el resultado esperado',
    );
  }

  console.log('Conexión Prisma correcta');
  console.table([result]);
} catch (error) {
  console.error('Falló la conexión con PostgreSQL');

  console.error(
    error instanceof Error
      ? error.message
      : String(error),
  );

  process.exitCode = 1;
} finally {
  await database.$disconnect();
}
