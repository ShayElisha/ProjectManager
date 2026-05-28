import { Body, Controller, Headers, Param, Post, UnauthorizedException } from "@nestjs/common";
import { Public } from "../auth/public.decorator";
import { IntegrationsService } from "./integrations.service";

@Public()
@Controller("public")
export class IntegrationsPublicController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Post("zapier/:token")
  zapier(@Param("token") token: string, @Body() body: Record<string, unknown>) {
    return this.integrations.zapierAction(token, body as Parameters<IntegrationsService["zapierAction"]>[1]);
  }

  @Post("inbound-email/:projectId")
  inboundEmail(
    @Param("projectId") projectId: string,
    @Headers("x-inbound-secret") secret: string | undefined,
    @Body() body: { subject?: string; body?: string; from?: string },
  ) {
    if (!secret) throw new UnauthorizedException("Missing X-Inbound-Secret header");
    return this.integrations.inboundEmail(projectId, secret, body);
  }
}
