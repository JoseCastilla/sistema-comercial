import 'dotenv/config';

import { Global, Module } from '@nestjs/common';

import { DatabaseService } from './database.service';
import type { DatabaseClientPort } from './database.types';

interface DatabasePackage {
  createPrismaClient(): unknown;
}

const databasePackageName = '@repo/database';

@Global()
@Module({
  providers: [
    {
      provide: DatabaseService,

      useFactory: async (): Promise<DatabaseService> => {
        const databasePackage = (await import(
          databasePackageName
        )) as DatabasePackage;

        const client =
          databasePackage.createPrismaClient() as DatabaseClientPort;

        await client.$connect();

        return new DatabaseService(client);
      },
    },
  ],

  exports: [DatabaseService],
})
export class DatabaseModule {}
