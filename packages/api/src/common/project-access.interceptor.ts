import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserAccount } from "@nexus/shared";
import { IS_PUBLIC_KEY } from "../auth/public.decorator";
import { DataStoreService } from "../database/data-store.service";
import { assertOrgAccess, assertProjectAccess } from "./org-access";

/** Enforces org/project tenancy on routes with :projectId or :orgId params. */
@Injectable()
export class ProjectAccessInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly db: DataStoreService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return next.handle();

    if (process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production") {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<{
      user?: UserAccount;
      params?: Record<string, string>;
    }>();
    const user = req.user;
    if (!user) return next.handle();

    const projectId = req.params?.projectId;
    if (projectId) {
      assertProjectAccess(this.db, user, projectId);
    }

    const orgId = req.params?.orgId;
    if (orgId) {
      assertOrgAccess(user, orgId);
    }

    return next.handle();
  }
}
