// backend/src/types/domain.ts
export interface Entry {
  entryId: string;
  userId: string;
  text: string;
  media?: { audioUrl?: string; imageUrl?: string };
  createdAt: FirebaseFirestore.Timestamp;
  processed: boolean;
  language?: string;
}

export interface Insight {
  insightId: string;
  entryId: string;
  userId: string;
  emotions: { label: string; score: number }[];
  sentiment: { compound: number };
  topics: string[];
  risk: { suicidal: number; self_harm: number; violence?: number };
  confidence: number;
  guidance?: { word: string; suggestion: string; cta?: { label: string; route: string }; safety: 'ok'|'caution'|'high-risk' };
  createdAt: FirebaseFirestore.Timestamp;
}

export interface Capsule {
  capsuleId: string;
  userId: string;
  insightId: string;
  type: 'story' | 'breathing' | 'playlist' | 'art';
  payload: any;
  fallbackUsed: boolean;
  createdAt: FirebaseFirestore.Timestamp;
}

export interface PeerPost {
  postId: string;
  userId: string;
  content: string;
  insightTag?: string;
  status: 'pending' | 'approved' | 'rejected' | 'flagged';
  moderation: {
    rulesFailed: string[];
    modelScores?: Record<string, number>;
    finalDecision?: string;
  };
  createdAt: FirebaseFirestore.Timestamp;
  publishedAt?: FirebaseFirestore.Timestamp | null;
}