import { Controller, Global, Module, Sse } from '@nestjs/common';
import { FleetEventsService } from './fleet-events.service';
import { FleetEventsSubscriber } from './fleet-events.subscriber';

@Controller('events')
export class FleetEventsController {
  constructor(private readonly events: FleetEventsService) {}
  @Sse() stream() { return this.events.stream(); }
}

@Global()
@Module({controllers: [FleetEventsController], providers: [FleetEventsService, FleetEventsSubscriber], exports: [FleetEventsService]})
export class FleetEventsModule {}
