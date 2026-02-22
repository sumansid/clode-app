export type PermissionMode = 'default' | 'acceptEdits' | 'bypassPermissions' | 'dontAsk';

export type ItemType = 'text' | 'thinking' | 'tool_call' | 'tool_result' | 'file_change' | 'command_output';

export interface TextItem { type: 'text'; text: string }
export interface ThinkingItem { type: 'thinking'; thinking: string }
export interface ToolCallItem { type: 'tool_call'; tool_use_id: string; name: string; input: unknown }
export interface ToolResultItem { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }
export type Item = TextItem | ThinkingItem | ToolCallItem | ToolResultItem;

export interface StoredItem { id: string; created_at: number; item: Item }

export type MessageRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string; // for user messages
  items?: StoredItem[]; // for assistant messages
  streamingText?: string; // accumulating text during streaming
  isStreaming?: boolean;
}

export type TurnStatus = 'active' | 'completed' | 'interrupted' | 'error';

export interface Turn {
  id: string;
  thread_id: string;
  status: TurnStatus;
  user_content: string;
  messages: ChatMessage[];
}

export interface Session {
  thread_id: string;
  created_at: number;
  cwd: string;
  permission_mode: PermissionMode;
  turns: Turn[];
  active_turn_id?: string;
  // display helpers
  messages: ChatMessage[]; // flat list for display
  lastBlockedContent?: string; // last user message that got blocked
  hasPermissionDenial?: boolean;
  permissionDenials?: PermissionDenial[]; // server reported permission denials
}

export interface PermissionDenial {
  tool_name: string;
  tool_use_id: string;
  tool_input?: Record<string, unknown>;
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';
