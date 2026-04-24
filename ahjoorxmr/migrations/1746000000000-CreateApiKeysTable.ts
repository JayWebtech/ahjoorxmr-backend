import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateApiKeysTable1746000000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "api_keys" (
        "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
        "keyHash"     VARCHAR(64) NOT NULL,
        "name"        VARCHAR(255) NOT NULL,
        "ownerId"     UUID NOT NULL,
        "scopes"      TEXT[] NOT NULL DEFAULT '{}',
        "lastUsedAt"  TIMESTAMP,
        "expiresAt"   TIMESTAMP,
        "revokedAt"   TIMESTAMP,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_api_keys" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_api_keys_keyHash" UNIQUE ("keyHash"),
        CONSTRAINT "FK_api_keys_owner" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_keyHash" ON "api_keys" ("keyHash")`);
    await queryRunner.query(`CREATE INDEX "IDX_api_keys_ownerId" ON "api_keys" ("ownerId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "api_keys"`);
  }
}
