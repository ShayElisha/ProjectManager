import { Injectable, NotFoundException } from "@nestjs/common";
import type { Organization } from "@nexus/shared";
import { DataStoreService } from "../database/data-store.service";

@Injectable()
export class OrganizationsService {
  constructor(private readonly db: DataStoreService) {}

  list(): Organization[] {
    return this.db.getOrganizations();
  }

  get(id: string): Organization {
    const org = this.db.getOrganization(id);
    if (!org) throw new NotFoundException(`Organization ${id} not found`);
    return org;
  }

  create(dto: { name: string; defaultLocale?: Organization["defaultLocale"]; defaultCurrency?: Organization["defaultCurrency"] }) {
    return this.db.createOrganization(dto);
  }

  update(id: string, patch: Partial<Pick<Organization, "name" | "defaultLocale" | "defaultCurrency">>) {
    const updated = this.db.updateOrganization(id, patch);
    if (!updated) throw new NotFoundException(`Organization ${id} not found`);
    return updated;
  }
}
