import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { UserRole, UserAccount } from "@nexus/shared";
import { roleAtLeast } from "@nexus/shared";
import { ROLES_KEY } from "./roles.decorator";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required?.length) return true;

    const req = context.switchToHttp().getRequest<{ user?: UserAccount }>();
    const user = req.user;
    if (!user) throw new ForbiddenException("AUTH_REQUIRED");

    const ok = required.some((min) => roleAtLeast(user.role, min));
    if (!ok) throw new ForbiddenException("INSUFFICIENT_ROLE");
    return true;
  }
}
