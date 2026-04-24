import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey, TableIndex } from 'typeorm';

export class AddPenaltyFieldsToGroupsAndCreatePenaltiesTable1746300000000
    implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add penalty fields to groups table
        await queryRunner.addColumn(
            'groups',
            new TableColumn({
                name: 'penaltyRate',
                type: 'decimal',
                precision: 5,
                scale: 4,
                default: 0.05,
                comment: 'Penalty rate as decimal (e.g., 0.05 = 5%)',
            }),
        );

        await queryRunner.addColumn(
            'groups',
            new TableColumn({
                name: 'gracePeriodHours',
                type: 'integer',
                default: 24,
                comment: 'Grace period in hours after deadline before penalty applies',
            }),
        );

        // Create penalties table
        await queryRunner.createTable(
            new Table({
                name: 'penalties',
                columns: [
                    {
                        name: 'id',
                        type: 'uuid',
                        isPrimary: true,
                        generationStrategy: 'uuid',
                        default: 'gen_random_uuid()',
                    },
                    {
                        name: 'groupId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'userId',
                        type: 'uuid',
                        isNullable: false,
                    },
                    {
                        name: 'roundNumber',
                        type: 'integer',
                        isNullable: false,
                    },
                    {
                        name: 'amount',
                        type: 'varchar',
                        length: 255,
                        isNullable: false,
                        comment: 'Penalty amount in asset units',
                    },
                    {
                        name: 'assetCode',
                        type: 'varchar',
                        length: 12,
                        default: "'XLM'",
                        isNullable: false,
                    },
                    {
                        name: 'dueAt',
                        type: 'timestamp',
                        isNullable: false,
                    },
                    {
                        name: 'paidAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'status',
                        type: 'enum',
                        enum: ['PENDING', 'PAID', 'WAIVED'],
                        default: "'PENDING'",
                        isNullable: false,
                    },
                    {
                        name: 'waiverReason',
                        type: 'text',
                        isNullable: true,
                    },
                    {
                        name: 'waivedByUserId',
                        type: 'uuid',
                        isNullable: true,
                    },
                    {
                        name: 'waivedAt',
                        type: 'timestamp',
                        isNullable: true,
                    },
                    {
                        name: 'createdAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false,
                    },
                    {
                        name: 'updatedAt',
                        type: 'timestamp',
                        default: 'CURRENT_TIMESTAMP',
                        isNullable: false,
                    },
                ],
                foreignKeys: [
                    new TableForeignKey({
                        columnNames: ['groupId'],
                        referencedTableName: 'groups',
                        referencedColumnNames: ['id'],
                        onDelete: 'CASCADE',
                    }),
                    new TableForeignKey({
                        columnNames: ['userId'],
                        referencedTableName: 'users',
                        referencedColumnNames: ['id'],
                        onDelete: 'CASCADE',
                    }),
                ],
                indices: [
                    new TableIndex({
                        columnNames: ['groupId', 'roundNumber'],
                    }),
                    new TableIndex({
                        columnNames: ['userId', 'groupId'],
                    }),
                    new TableIndex({
                        columnNames: ['status'],
                    }),
                ],
            }),
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.dropTable('penalties');
        await queryRunner.dropColumn('groups', 'gracePeriodHours');
        await queryRunner.dropColumn('groups', 'penaltyRate');
    }
}
