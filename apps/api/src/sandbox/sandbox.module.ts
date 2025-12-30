import { Module } from '@nestjs/common';
import { SandboxService } from './sandbox.service';
import { SandboxController } from './sandbox.controller';
import { GoogleWorkspaceModule } from '../google-workspace/google-workspace.module';

@Module({
  imports: [GoogleWorkspaceModule],
  providers: [SandboxService],
  controllers: [SandboxController],
  exports: [SandboxService],
})
export class SandboxModule {}
