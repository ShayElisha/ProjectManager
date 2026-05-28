import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import type { AuthTokens, UserAccount } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";
import { generateTotpSecret, totpProvisioningUri, verifyTotp } from "./totp.util";

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

  async login(email: string, password: string, totpCode?: string): Promise<AuthTokens> {
    const user = this.db.getUserByEmail(email);
    if (!user) throw new UnauthorizedException("INVALID_CREDENTIALS");
    const record = this.db.getUserRecord(user.id);
    if (!record || !(await bcrypt.compare(password, record.passwordHash))) {
      throw new UnauthorizedException("INVALID_CREDENTIALS");
    }
    const totp = this.db.getUserTotp(user.id);
    if (totp.enabled) {
      if (!totpCode) {
        return { accessToken: "", user, requiresTotp: true };
      }
      if (!totp.secret || !verifyTotp(totp.secret, totpCode)) {
        throw new UnauthorizedException("INVALID_TOTP");
      }
    }
    return this.tokensFor(user);
  }

  setup2fa(userId: string): { secret: string; uri: string } {
    const user = this.db.getUserById(userId);
    if (!user) throw new UnauthorizedException();
    const secret = generateTotpSecret();
    this.db.setUserTotp(userId, secret, false);
    return {
      secret,
      uri: totpProvisioningUri(secret, user.email),
    };
  }

  enable2fa(userId: string, code: string): { enabled: boolean } {
    const totp = this.db.getUserTotp(userId);
    if (!totp.secret || !verifyTotp(totp.secret, code)) {
      throw new BadRequestException("INVALID_TOTP");
    }
    this.db.setUserTotp(userId, totp.secret, true);
    return { enabled: true };
  }

  disable2fa(userId: string, code: string): { enabled: boolean } {
    const totp = this.db.getUserTotp(userId);
    if (!totp.secret || !verifyTotp(totp.secret, code)) {
      throw new BadRequestException("INVALID_TOTP");
    }
    this.db.setUserTotp(userId, "", false);
    return { enabled: false };
  }

  samlMetadata() {
    return {
      enabled: !!process.env.SAML_ENTRY_POINT,
      entryPoint: process.env.SAML_ENTRY_POINT ?? null,
      issuer: process.env.SAML_ISSUER ?? "nexus-project",
      hint: "Set SAML_ENTRY_POINT, SAML_ISSUER, SAML_CERT for production IdP",
    };
  }

  async samlAcs(email: string): Promise<AuthTokens> {
    const allowDevAcs =
      process.env.NODE_ENV !== "production" && process.env.SAML_DEV_ACS === "1";
    if (!allowDevAcs) {
      throw new UnauthorizedException("SAML_NOT_CONFIGURED");
    }
    const normalized = email.trim().toLowerCase();
    const user = this.db.getUserByEmail(normalized);
    if (!user) throw new UnauthorizedException("SSO_USER_NOT_FOUND");
    return this.tokensFor(user);
  }

  private tokensFor(user: UserAccount): AuthTokens {
    const accessToken = this.jwt.sign({
      sub: user.id,
      email: user.email,
      organizationId: user.organizationId,
      role: user.role,
    });
    return { accessToken, user };
  }
}
