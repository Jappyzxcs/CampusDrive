import { useLocation, useNavigate } from 'react-router-dom';
import { VerificationResultCard } from '../../components/scanner/VerificationResultCard';
import { EmptyState } from '../../components/common/EmptyState';
import { ROUTES } from '../../constants/routes';

/**
 * The live capture flow in ScannerPage shows its result inline (no
 * navigation, so a guard can scan the next vehicle in one tap). This
 * route is for opening a specific scan as a standalone screen — e.g.
 * tapping a row in Scan History — via `navigate(..., { state: { result } })`.
 */
export default function VerificationResultPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const result = location.state?.result;

  if (!result) {
    return (
      <div className="mx-auto max-w-lg">
        <EmptyState
          title="No scan selected"
          description="Open a scan from history, or start a new one."
          action={
            <button onClick={() => navigate(ROUTES.GUARD_SCANNER)} className="btn-primary">
              Go to Scanner
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5">
      <VerificationResultCard result={result} />
      <button onClick={() => navigate(ROUTES.GUARD_SCAN_HISTORY)} className="btn-secondary justify-center">
        Back to History
      </button>
    </div>
  );
}
