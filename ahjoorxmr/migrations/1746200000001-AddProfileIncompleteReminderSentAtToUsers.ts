import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProfileIncompleteReminderSentAtToUsers1746200000001
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn(
            'users',
            new TableColumn({
                name: 'profileIncompleteReminderSentAt',
                type: 'timestamp',
                isNullable: true,
                default: null,
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropColumn('users', 'profileIncompleteReminderSentAt');
    }
}
