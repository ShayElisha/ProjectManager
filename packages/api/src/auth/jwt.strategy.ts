import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import type { UserAccount } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId?: string;
  role?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly db: DataStoreService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "nexus-dev-secret-change-in-production",
    });
  }

  validate(payload: JwtPayload): UserAccount {
    if (process.env.VERCEL) {
      return {
        id: payload.sub,
        email: payload.email,
        name: payload.email.includes("@") ? payload.email.split("@")[0] : payload.email,
        role: (payload.role ?? "team_member") as UserAccount["role"],
        organizationId: payload.organizationId,
      };
    }
    const user = this.db.getUserById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return user;
  }
}
