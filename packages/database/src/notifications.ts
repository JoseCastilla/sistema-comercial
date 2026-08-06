import { Client } from "pg";

export function createPostgresNotificationClient(
  connectionString: string,
): Client {
  return new Client({ connectionString });
}
