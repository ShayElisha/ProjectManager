import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import { IsOptional, IsString } from "class-validator";
import type { UserAccount } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { assertProjectAccess } from "../common/org-access";
import { JwtAuthGuard } from "../auth/jwt-auth.guard";
import { diskStorage } from "multer";
import { join } from "path";
import { existsSync, mkdirSync } from "fs";
import { v4 as uuid } from "uuid";

const UPLOAD_DIR = join(process.cwd(), "uploads");

function ensureUploadDir() {
  if (!existsSync(UPLOAD_DIR)) mkdirSync(UPLOAD_DIR, { recursive: true });
}

class CommentDto {
  @IsString()
  body!: string;
}

class TimerStartDto {
  @IsOptional()
  @IsString()
  taskId?: string;
}

@Controller("projects/:projectId/tasks/:taskId")
export class TaskCollaborationController {
  constructor(private readonly db: DataStoreService) {}

  @Get("comments")
  comments(@Param("projectId") projectId: string, @Param("taskId") taskId: string) {
    return this.db.getTaskComments(projectId, taskId);
  }

  @Post("comments")
  addComment(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Body() body: CommentDto,
    @Req() req: { user?: UserAccount },
  ) {
    const user = req.user ?? { id: "anonymous", name: "User", email: "", role: "team_member" as const };
    return this.db.addTaskComment({
      projectId,
      taskId,
      userId: user.id,
      userName: user.name,
      body: body.body.trim(),
    });
  }

  @Get("attachments")
  attachments(@Param("projectId") projectId: string, @Param("taskId") taskId: string) {
    return this.db.getTaskAttachments(projectId, taskId);
  }

  @Post("attachments")
  @UseInterceptors(
    FileInterceptor("file", {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          ensureUploadDir();
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          cb(null, `${uuid()}-${file.originalname.replace(/[^\w.\-() ]/g, "_")}`);
        },
      }),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  uploadAttachment(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user?: UserAccount },
  ) {
    if (!file) return { ok: false };
    const user = req.user;
    return this.db.addTaskAttachment({
      projectId,
      taskId,
      fileName: file.originalname,
      mimeType: file.mimetype,
      sizeBytes: file.size,
      storagePath: file.filename,
      uploadedBy: user?.id,
    });
  }

  @Delete("attachments/:attachmentId")
  removeAttachment(
    @Param("projectId") projectId: string,
    @Param("taskId") taskId: string,
    @Param("attachmentId") attachmentId: string,
  ) {
    return this.db.deleteTaskAttachment(projectId, taskId, attachmentId);
  }
}

@Controller("attachments")
@UseGuards(JwtAuthGuard)
export class AttachmentsDownloadController {
  constructor(private readonly db: DataStoreService) {}

  @Get(":attachmentId/download")
  download(
    @Req() req: { user: UserAccount },
    @Param("attachmentId") id: string,
    @Res() res: Response,
  ) {
    const meta = this.db.getAttachmentById(id);
    if (!meta) {
      res.status(404).send("Not found");
      return;
    }
    try {
      assertProjectAccess(this.db, req.user, meta.projectId);
    } catch {
      res.status(403).send("Forbidden");
      return;
    }
    const path = join(UPLOAD_DIR, meta.storagePath!);
    if (!existsSync(path)) {
      res.status(404).send("File missing");
      return;
    }
    res.download(path, meta.fileName);
  }
}
