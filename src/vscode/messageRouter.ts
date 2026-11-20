import type { BoardService } from '../application/boardService';
import type { BoardSnapshot } from '../shared/board';
import {
  createErrorResponse,
  createSuccessResponse,
  MUTATION_TYPES,
  parseProtocolRequest,
  type ProtocolRequest,
  type ProtocolResponse,
} from '../shared/protocol';
import { toProtocolError } from './errorMapper';

export type RouterService = Pick<
  BoardService,
  | 'loadBoard'
  | 'initializeBoard'
  | 'validateBoard'
  | 'createColumn'
  | 'updateColumn'
  | 'deleteColumn'
  | 'reorderColumns'
  | 'createTask'
  | 'updateTask'
  | 'deleteTask'
  | 'moveTask'
  | 'loadTaskPage'
  | 'createChecklist'
  | 'updateChecklist'
  | 'deleteChecklist'
  | 'createChecklistItem'
  | 'updateChecklistItem'
  | 'deleteChecklistItem'
  | 'toggleChecklistItem'
>;

export interface RouterHost {
  post(message: ProtocolResponse): void | Promise<void>;
  openFile(uri: string, range?: ProtocolFileRange): Promise<void>;
  publishSnapshot(snapshot: BoardSnapshot): void;
  canMutate?(): boolean;
  log?(message: string, error?: unknown): void;
}

export interface ProtocolFileRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export class MessageRouter {
  private readonly inFlight = new Set<string>();

  constructor(
    private readonly service: RouterService,
    private readonly host: RouterHost,
  ) {}

  async handle(raw: unknown): Promise<void> {
    const response = await this.handleRequest(raw);
    await this.host.post(response);
  }

  async handleRequest(raw: unknown): Promise<ProtocolResponse> {
    const parsed = parseProtocolRequest(raw);
    if (!parsed.ok) {
      return createErrorResponse(
        parsed.requestId ?? 'unknown',
        'InvalidRequest',
        parsed.message || 'The message is not a valid iKanban request.',
      );
    }

    const request = parsed.request;
    if (this.inFlight.has(request.requestId)) {
      return createErrorResponse(
        request.requestId,
        'DuplicateRequest',
        'This request is already being processed.',
      );
    }

    if (MUTATION_TYPES.has(request.type) && this.host.canMutate?.() === false) {
      return createErrorResponse(
        request.requestId,
        'WorkspaceNotTrusted',
        'iKanban requires a trusted workspace to modify board files.',
      );
    }

    this.inFlight.add(request.requestId);
    try {
      const data = await this.dispatch(request);
      if (isSnapshot(data)) {
        this.host.publishSnapshot(data);
      }
      return createSuccessResponse(request.requestId, data);
    } catch (error) {
      this.host.log?.(`Request ${request.type} failed`, error);
      const mapped = toProtocolError(error);
      return createErrorResponse(request.requestId, mapped.code, mapped.message);
    } finally {
      this.inFlight.delete(request.requestId);
    }
  }

  private async dispatch(request: ProtocolRequest): Promise<unknown> {
    switch (request.type) {
      case 'board/load':
        return this.service.loadBoard();
      case 'board/initialize':
        return this.service.initializeBoard();
      case 'board/validate':
        return this.service.validateBoard();
      case 'column/create':
        return this.service.createColumn(request.payload);
      case 'column/update':
        return this.service.updateColumn(request.payload);
      case 'column/delete':
        return this.service.deleteColumn(request.payload);
      case 'column/reorder':
        return this.service.reorderColumns(request.payload);
      case 'task/create':
        return this.service.createTask(request.payload);
      case 'task/update':
        return this.service.updateTask(request.payload);
      case 'task/delete':
        await this.service.deleteTask(request.payload);
        return { taskId: request.payload.taskId };
      case 'task/move':
        return this.service.moveTask(request.payload);
      case 'task/page':
        return this.service.loadTaskPage(request.payload);
      case 'checklist/create':
        return this.service.createChecklist(request.payload);
      case 'checklist/update':
        return this.service.updateChecklist(request.payload);
      case 'checklist/delete':
        return this.service.deleteChecklist(request.payload);
      case 'checklistItem/create':
        return this.service.createChecklistItem(request.payload);
      case 'checklistItem/update':
        return this.service.updateChecklistItem(request.payload);
      case 'checklistItem/delete':
        return this.service.deleteChecklistItem(request.payload);
      case 'checklistItem/toggle':
        return this.service.toggleChecklistItem(request.payload);
      case 'file/open':
        await this.host.openFile(request.payload.uri, request.payload.range);
        return { opened: true };
    }
  }
}

function isSnapshot(value: unknown): value is BoardSnapshot {
  return (
    typeof value === 'object' &&
    value !== null &&
    'workspaceName' in value &&
    'issues' in value &&
    'columns' in value
  );
}
