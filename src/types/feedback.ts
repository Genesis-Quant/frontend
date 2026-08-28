export type FeedbackSource = "web" | "mcp";

export type Feedback = {
  id: number;
  content: string;
  source: FeedbackSource;
  created_at: string;
};
