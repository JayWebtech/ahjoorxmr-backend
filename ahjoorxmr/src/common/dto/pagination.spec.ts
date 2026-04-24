import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { PaginationDto, PaginatedResponseDto, SortOrder } from './pagination.dto';

describe('PaginationDto', () => {
  it('accepts valid defaults', async () => {
    const dto = plainToInstance(PaginationDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects limit > 100', async () => {
    const dto = plainToInstance(PaginationDto, { limit: 101 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'limit')).toBe(true);
  });

  it('rejects page < 1', async () => {
    const dto = plainToInstance(PaginationDto, { page: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'page')).toBe(true);
  });

  it('rejects invalid sortOrder', async () => {
    const dto = plainToInstance(PaginationDto, { sortOrder: 'RANDOM' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'sortOrder')).toBe(true);
  });

  it('accepts valid sortOrder ASC', async () => {
    const dto = plainToInstance(PaginationDto, { sortOrder: 'ASC' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts limit = 100', async () => {
    const dto = plainToInstance(PaginationDto, { limit: 100 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('PaginatedResponseDto', () => {
  it('computes totalPages correctly', () => {
    const result = PaginatedResponseDto.of([1, 2, 3], 55, 2, 20);
    expect(result.meta.totalPages).toBe(3);
    expect(result.meta.total).toBe(55);
    expect(result.meta.page).toBe(2);
    expect(result.meta.limit).toBe(20);
    expect(result.data).toEqual([1, 2, 3]);
  });

  it('returns totalPages=1 when total <= limit', () => {
    const result = PaginatedResponseDto.of([], 5, 1, 20);
    expect(result.meta.totalPages).toBe(1);
  });
});
