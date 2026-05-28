import { Body, Controller, Get, Post, Req, UseGuards } from "@nestjs/common";
import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";
import type { UserAccount } from "@nexus/shared";
import { AuthService } from "./auth.service";
import { Public } from "./public.decorator";
import { JwtAuthGuard } from "./jwt-auth.guard";

class RegisterDto {
  @IsString()
  name!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsString()
  organizationId?: string;
}

class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;

  @IsOptional()
  @IsString()
  totpCode?: string;
}

class TotpCodeDto {
  @IsString()
  code!: string;
}

class SamlAcsDto {
  @IsEmail()
  email!: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("register")
  register(@Body() body: RegisterDto) {
    return this.auth.register(body);
  }

  @Public()
  @Post("login")
  login(@Body() body: LoginDto) {
    return this.auth.login(body.email, body.password, body.totpCode);
  }

  @UseGuards(JwtAuthGuard)
  @Get("me")
  me(@Req() req: { user: UserAccount }) {
    return req.user;
  }

  @Public()
  @Get("sso/saml/metadata")
  samlMetadata() {
    return this.auth.samlMetadata();
  }

  @Public()
  @Post("sso/saml/acs")
  samlAcs(@Body() body: SamlAcsDto) {
    return this.auth.samlAcs(body.email);
  }

  @Post("2fa/setup")
  setup2fa(@Req() req: { user: UserAccount }) {
    return this.auth.setup2fa(req.user.id);
  }

  @Post("2fa/enable")
  enable2fa(@Req() req: { user: UserAccount }, @Body() body: TotpCodeDto) {
    return this.auth.enable2fa(req.user.id, body.code);
  }

  @Post("2fa/disable")
  disable2fa(@Req() req: { user: UserAccount }, @Body() body: TotpCodeDto) {
    return this.auth.disable2fa(req.user.id, body.code);
  }
}
