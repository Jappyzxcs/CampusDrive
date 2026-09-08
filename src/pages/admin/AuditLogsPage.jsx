import { useMemo } from 'react';
import { useAsyncData } from '../../hooks/useAsyncData';
import { mockDataService } from '../../services/mockDataService';
import { DataTable } from '../../components/tables/DataTable';
import { DashboardCard } from '../../components/cards/DashboardCard';
import { StatusBadge } from '../../components/common/StatusBadge';

/**
 * The thesis doesn't define a separate audit-log data entity — this page
 * builds one from actions already tracked on applications (who
 * approved/rejected, when) and stickers (who assigned, when), which is
 * exactly what an audit trail needs. Once the backend exists this
 * becomes a real `getAuditLogs()` call instead of a client-side merge.
 */
export default function AuditLogsPage() {
  const { data: applications, isLoading: appsLoading } = useAsyncData(() => mockDataService.getApplications(), []);
  const { data: stickers, isLoading: stickersLoading } = useAsyncData(() => mockDataService.getStickers(), []);

  const isLoading = appsLoading || stickersLoading;

  const entries = useMemo(() => {
    if (isLoading) return [];
    const appEntries = applications
      .filter((a) => a.reviewedBy)
      .map((a) => ({
        id: `audit_app_${a.id}`,
        timestamp: a.reviewedDate,
        actor: a.reviewedBy,
        action: a.status === 'approved' ? 'Approved application' : 'Rejected application',
        target: `${a.applicantName} · ${a.type}`,
        result: a.status,
      }));

    const stickerEntries = stickers
      .filter((s) => s.assignedBy)
      .map((s) => ({
        id: `audit_stk_${s.id}`,
        timestamp: s.assignedDate,
        actor: s.assignedBy,
        action: 'Assigned sticker serial',
        target: `${s.serial} → ${s.plateNumber || 'unassigned'}`,
        result: 'active',
      }));

    return [...appEntries, ...stickerEntries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [applications, stickers, isLoading]);

  const columns = [
    { key: 'timestamp', header: 'Date', sortable: true },
    { key: 'actor', header: 'Actor', sortable: true },
    { key: 'action', header: 'Action' },
    { key: 'target', header: 'Target' },
    { key: 'result', header: 'Outcome', render: (row) => <StatusBadge status={row.result} /> },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold text-primary-900">Audit Logs</h2>
        <p className="text-sm text-slate-500">Every approval, rejection, and sticker assignment, with who did it and when.</p>
      </div>

      <DashboardCard>
        <DataTable columns={columns} rows={entries} isLoading={isLoading} />
      </DashboardCard>
    </div>
  );
}
