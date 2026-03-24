import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGroupSoftDelete1772100000000 implements MigrationInterface {
  name = 'AddGroupSoftDelete1772100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "groups"
      ADD COLUMN IF NOT EXISTS "deletedAt" timestamp NULL DEFAULT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_groups_deletedAt"
      ON "groups" ("deletedAt")
      WHERE "deletedAt" IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_groups_deletedAt"`);
    await queryRunner.query(`ALTER TABLE "groups" DROP COLUMN IF EXISTS "deletedAt"`);
  }
}
