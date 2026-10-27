import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer } from '../entities/customer.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Injectable()
export class CustomersService {
  constructor(@InjectRepository(Customer) private repo: Repository<Customer>) {}

  create(dto: CreateCustomerDto): Promise<Customer> { return this.repo.save(this.repo.create(dto)); }
  findAll(): Promise<Customer[]> { return this.repo.find({ order: { createdAt: 'DESC' } }); }
  async findOne(id: string): Promise<Customer> {
    const c = await this.repo.findOne({ where: { id }, relations: { devices: true } });
    if (!c) throw new NotFoundException('Customer not found');
    return c;
  }
  async update(id: string, dto: UpdateCustomerDto): Promise<Customer> {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }
  async remove(id: string): Promise<void> {
    const c = await this.findOne(id);
    await this.repo.remove(c);
  }
}
