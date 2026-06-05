import type { AppDatabase } from "@/lib/db/client";
import type { LeadRow, LeadsFilter } from "@/lib/db/leads.repo";
import { makeLeadsRepo } from "@/lib/db/leads.repo";

// --- Narrow ISP port ----------------------------------------------------------

export interface LeadsExportLeadsRepo {
  exportMerged(filter: LeadsFilter): Promise<LeadRow[]>;
  exportRaw(runId: string): Promise<LeadRow[]>;
}

export interface LeadsExportServiceDeps {
  readonly leadsRepo: LeadsExportLeadsRepo;
}

// --- Service ------------------------------------------------------------------

export interface LeadsExportService {
  exportMerged(filter: LeadsFilter): Promise<LeadRow[]>;
  exportRaw(runId: string): Promise<LeadRow[]>;
}

export function createLeadsExportService({
  leadsRepo,
}: LeadsExportServiceDeps): LeadsExportService {
  return {
    exportMerged: (filter) => leadsRepo.exportMerged(filter),
    exportRaw: (runId) => leadsRepo.exportRaw(runId),
  };
}

// --- Convenience factory (route use this) ------------------------------------

export function makeLeadsExportService(db: AppDatabase): LeadsExportService {
  return createLeadsExportService({ leadsRepo: makeLeadsRepo(db) });
}
