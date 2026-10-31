import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AdminReplayController, ReplayController } from './replay.controller';
import { ReplayService } from './replay.service';
import { SessionReplayChunk } from './session-replay-chunk.entity';

/** Rejeu des sessions : réception publique bornée, purge, et relecture admin. */
@Module({
  imports: [TypeOrmModule.forFeature([SessionReplayChunk])],
  controllers: [ReplayController, AdminReplayController],
  providers: [ReplayService],
})
export class ReplayModule {}
