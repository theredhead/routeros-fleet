import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Job } from '../entities/job.entity';

@Injectable()
export class JobsService {
  constructor(@InjectRepository(Job) private repo: Repository<Job>) {}

  findOne(id: string): Promise<Job> {
    const j = this.repo.findOne({ where: { id } });
    return j.then((x) => (x ? x : Promise.reject(new NotFoundException('Job not found'))));
  }

  forDevice(deviceId: string): Promise<Job[]> {
    return this.repo.find({ where: { deviceId }, order: { createdAt: 'DESC' }, take: 50 });
  }
}
