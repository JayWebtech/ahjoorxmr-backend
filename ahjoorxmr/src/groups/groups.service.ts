import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Group } from './entities/group.entity';

@Injectable()
export class GroupsService {
  constructor(
    @InjectRepository(Group)
    private readonly groupRepository: Repository<Group>,
  ) {}

  async deleteGroup(id: string): Promise<void> {
    const result = await this.groupRepository.delete(id);
    
    if (result.affected === 0) {
      throw new NotFoundException(`Group with ID ${id} not found`);
    }
  }
}
