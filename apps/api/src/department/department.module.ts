import { Module } from '@nestjs/common';
import { DepartmentService } from './department.service';
import { DepartmentController } from './department.controller';
import { EditRequestService } from './edit-request.service';
import { EditRequestController } from './edit-request.controller';
import { RolloverService } from './rollover.service';
import { RolloverController } from './rollover.controller';
import { GoogleWorkspaceModule } from '../google-workspace/google-workspace.module';

@Module({
  imports: [GoogleWorkspaceModule],
  providers: [DepartmentService, EditRequestService, RolloverService],
  controllers: [DepartmentController, EditRequestController, RolloverController],
  exports: [DepartmentService, EditRequestService, RolloverService],
})
export class DepartmentModule {}
