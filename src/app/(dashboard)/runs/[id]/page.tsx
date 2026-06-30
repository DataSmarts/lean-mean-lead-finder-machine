import { notFound } from "next/navigation";

import { getDb } from "@/lib/db/client";
import { makeRunReadService } from "@/lib/services/run-read";

import styles from "./run-detail.module.css";
import { RunDetailLive } from "./run-detail-live";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function RunDetailPage({ params }: PageProps) {
  const { id } = await params;
  const view = await makeRunReadService(getDb()).getDetail(id);
  if (!view) notFound();

  return (
    <div className={styles.page}>
      <div className={styles.glow} aria-hidden />
      <div className={styles.content}>
        <RunDetailLive initial={view} runId={id} />
      </div>
    </div>
  );
}
