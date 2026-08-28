import { client } from "@/assets/lib/request";
import type { Feedback } from "@/types/feedback";

export function submitFeedback(content: string) {
  return client.post<Feedback>("/feedback", { content });
}
