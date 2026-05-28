import { ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthGuard } from "@nestjs/passport";
import { IS_PUBLIC_KEY } from "./public.decorator";

@Injectable()
export class JwtAuthGuard extends AuthGuard("jwt") {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    const authDisabled =
      process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production";
    if (authDisabled) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error | null, user: T): T {
    const authDisabled =
      process.env.AUTH_DISABLED === "1" && process.env.NODE_ENV !== "production";
    if (authDisabled) return user as T;
    if (err || !user) throw err ?? new Error("Unauthorized");
    return user;
  }
}
