import type { ProjectSnapshot, VibeReportConfig } from '../../models/types.js';
import { FileOperationError, OperationCancelledError } from '../../models/errors.js';
import type {
  CancellationTokenLike,
  UpdateReportsWorkflowDeps,
  WorkflowProgress,
} from '../updateReportsWorkflow.js';

function throwIfCancelled(cancellationToken?: CancellationTokenLike): void {
  if (!cancellationToken?.isCancellationRequested) {
    return;
  }

  throw new OperationCancelledError('Report template preparation cancelled');
}

export async function prepareReportTemplates(args: {
  rootPath: string;
  config: VibeReportConfig;
  snapshot: ProjectSnapshot;
  isFirstRun: boolean;
  reportProgress: WorkflowProgress;
  deps: UpdateReportsWorkflowDeps;
  cancellationToken?: CancellationTokenLike;
}): Promise<void> {
  const { rootPath, config, snapshot, isFirstRun, reportProgress, deps, cancellationToken } =
    args;
  reportProgress('보고서 준비 중...', 60);

  try {
    throwIfCancelled(cancellationToken);
    await deps.reportService.ensureReportDirectory(rootPath, config);
  } catch {
    throw new FileOperationError('보고서 디렉토리 생성 실패', `${rootPath}/${config.reportDirectory}`);
  }

  if (!isFirstRun) return;

  const paths = deps.reportService.getReportPaths(rootPath, config);

  try {
    throwIfCancelled(cancellationToken);
    const evalTemplate = deps.reportService.createEvaluationTemplate(snapshot, config.language);
    await deps.fs.writeFile(paths.evaluation, evalTemplate, 'utf-8');
  } catch {
    throw new FileOperationError('평가 보고서 템플릿 생성 실패', paths.evaluation);
  }

  try {
    throwIfCancelled(cancellationToken);
    const improvTemplate = deps.reportService.createImprovementTemplate(snapshot, config.language);
    await deps.fs.writeFile(paths.improvement, improvTemplate, 'utf-8');
  } catch {
    throw new FileOperationError('개선 보고서 템플릿 생성 실패', paths.improvement);
  }
}
