import { ConflictException, Injectable, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthTokens, UserAccount, UserRole } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DataStoreService,
    private readonly jwt: JwtService,
  ) {}

  async register(input: {
    name: string;
    email: string;
    password: string;
    organizationId?: string;
  }): Promise<AuthTokens> {
    const existing = this.db.getUserByEmail(input.email);
    if (existing) throw new ConflictException("EMAIL_EXISTS");
    const orgId = input.organizationId ?? (await this.db.ensureDefaultOrganizationId());
    const user = await this.db.createUser({
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      passwordHash: await bcrypt.hash(input.password, 10),
      role: "team_member",
      organizationId: orgId,
    });
    return this.tokensFor(user);
  }

  async login(email: string, password: string): Promise<AuthTokens> {
    const user = this.db.getUserByEmail(email);
    if (!user) throw new UnauthorizedException("INVALID_CREDENTIALS");
    const record = this.db.getUserRecord(user.id);
    if (!record || !(await bcrypt.compare(password, record.passwordHash))) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    return this.tokensFor(user);
  }

  private tokensFor(user: UserAccount): AuthTokens {
    const accessToken = this.jwt.sign({ sub: user.id, email: user.email });
    return { accessToken, user };
  }
}
