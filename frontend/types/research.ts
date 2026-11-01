export type SourceStatus =
  | "queued"
  | "processing"
  | "indexed"
  | "partially_indexed"
  | "failed"
  | "deleted";

export interface ResearchCollection {
  id: string;
  name: string;
  visibility: "private";
  source_count: number;
  created_at: string;
  updated_at: string;
}

export interface ResearchSource {
  id: string;
  collection_id: string;
  source_type: "file" | "url";
  title: string;
  original_uri: string | null;
  canonical_uri: string | null;
  status: SourceStatus;
  error_message: string | null;
  chunk_count: number;
  last_fetched_at: string | null;
  created_at: string;
}

export interface ResearchCitation {
  id: string;
  source_id: string;
  source_type: "file" | "url";
  title: string;
  url: string | null;
  page_number: number | null;
  section_path: string | null;
  excerpt: string;
}

export interface ResearchMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations: ResearchCitation[];
  created_at: string;
}

export interface ResearchConversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ResearchConversationDetail extends ResearchConversation {
  messages: ResearchMessage[];
}

export interface ResearchAnswer {
  run_id: string;
  conversation_id: string;
  message_id: string;
  answer: string;
  citations: ResearchCitation[];
  evidence_sufficient: boolean;
  provider: string;
  created_at: string;
}
