import type { AppDatabase } from "@/lib/db/client";
import type { Preset } from "@/lib/db/presets.repo";
import { makePresetsRepo } from "@/lib/db/presets.repo";

export interface PresetsReadRepo {
  findAll(): Promise<Preset[]>;
}

export interface PresetsReadService {
  list(): Promise<Preset[]>;
}

export function createPresetsReadService(repo: PresetsReadRepo): PresetsReadService {
  return {
    list: () => repo.findAll(),
  };
}

export function makePresetsReadService(db: AppDatabase): PresetsReadService {
  return createPresetsReadService(makePresetsRepo(db));
}
