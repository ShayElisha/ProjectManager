export const PRISMA = Symbol("PRISMA");

export interface PrismaConnectFacade {
  readonly enabled: boolean;
  connectHostedDb(): Promise<boolean>;
}
