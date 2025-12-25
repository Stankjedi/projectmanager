import type {
  ProjectSnapshot,
  SnapshotDiff,
  VibeReportConfig,
  VibeReportState,
} from '../../models/types.js';
import { OperationCancelledError, WorkspaceScanError } from '../../models/errors.js';
import type {
  CancellationTokenLike,
  UpdateReportsWorkflowDeps,
  WorkflowProgress,
} from '../updateReportsWorkflow.js';

function throwIfCancelled(cancellationToken?: CancellationTokenLike): void {
  if (!cancellationToken?.isCancellationRequested) {
    return;
  }

  throw new OperationCancelledError('Workspace scan cancelled');
}

export async function performWorkspaceScan(args: {
  rootPath: string;
  config: VibeReportConfig;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
  cancellationToken?: CancellationTokenLike;
}): Promise<{ snapshot: ProjectSnapshot; state: VibeReportState; diff: SnapshotDiff }> {
  const { rootPath, config, reportProgress, deps, cancellationToken } = args;

  reportProgress('프로젝트 구조 스캔 중...', 20);
  let snapshot: ProjectSnapshot;
  try {
    throwIfCancelled(cancellationToken);
    snapshot = await deps.workspaceScanner.scan(
      rootPath,
      config,
      reportProgress,
      cancellationToken
    );
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    throw new WorkspaceScanError(
      '프로젝트 구조 스캔 실패',
      error instanceof Error ? error.message : String(error)
    );
  }

  reportProgress('상태 분석 중...', 40);
  let state: VibeReportState;
  try {
    throwIfCancelled(cancellationToken);
    const loadedState = await deps.snapshotService.loadState(rootPath, config);
    state = loadedState ?? deps.snapshotService.createInitialState();
  } catch (error) {
    deps.log(`이전 상태 로드 실패, 초기 상태로 시작: ${error}`);
    state = deps.snapshotService.createInitialState();
  }

  let diff: SnapshotDiff;
  try {
    throwIfCancelled(cancellationToken);
    diff = await deps.snapshotService.compareSnapshots(
      state.lastSnapshot,
      snapshot,
      rootPath,
      config
    );
  } catch (error) {
    if (error instanceof OperationCancelledError) {
      throw error;
    }
    throw new WorkspaceScanError(
      '스냅샷 비교 실패',
      error instanceof Error ? error.message : String(error)
    );
  }

  return { snapshot, state, diff };
}
