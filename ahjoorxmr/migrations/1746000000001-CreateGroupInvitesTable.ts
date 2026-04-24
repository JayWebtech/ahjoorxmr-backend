import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGroupInvitesTable1746000000001 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "group_invites_status_enum" AS ENUM ('ACTIVE', 'EXPIRED', 'EXHAUSTED')
    `);
    await queryRunner.query(`
      CREATE TABLE "group_invites" (
        "id"          UUID NOT NULL DEFAULT uuid_generate_v4(),
        "groupId"     UUID NOT NULL,
        "createdBy"   UUID NOT NULL,
        "code"        VARCHAR(12) NOT NULL,
        "maxUses"     INT NOT NULL DEFAULT 1,
        "usedCount"   INT NOT NULL DEFAULT 0,
        "expiresAt"   TIMESTAMP NOT NULL,
        "status"      "group_invites_status_enum" NOT NULL DEFAULT 'ACTIVE',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_group_invites" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_group_invites_code" UNIQUE ("code"),
        CONSTRAINT "FK_group_invites_group" FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_group_invites_creator" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`CREATE INDEX "IDX_group_invites_code" ON "group_invites" ("code")`);
    await queryRunner.query(`CREATE INDEX "IDX_group_invites_groupId" ON "group_invites" ("groupId")`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "group_invites"`);
    await queryRunner.query(`DROP TYPE "group_invites_status_enum"`);
  }
}
