import { Module } from "@nestjs/common";
import { RejectionsController } from "./rejections.controller";
import { RejectionsService } from "./rejections.service";

@Module({
  controllers: [RejectionsController],
  providers: [RejectionsService],
  exports: [RejectionsService],
})
export class RejectionsModule {}
