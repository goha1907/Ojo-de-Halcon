import { z } from "zod";
import { emailSchema } from "./profile";

/** Topics of the contact form: a first list, to be trimmed to what people really write about. */
export const FEEDBACK_TOPICS = ["tracking", "technical", "subscription", "suggestion", "partnership", "other"] as const;
export type FeedbackTopic = (typeof FEEDBACK_TOPICS)[number];

/** Limits of a feedback message. */
export const FEEDBACK_LIMITS = { messageMin: 10, messageMax: 2000 } as const;

const msg = (key: string) => ({ message: key });

/** The "write to us" form of the landing page. `website` is a honeypot: humans leave it empty. */
export const feedbackSchema = z.object({
  topic: z.enum(FEEDBACK_TOPICS),
  /** Optional: a first name is enough. */
  name: z
    .string()
    .trim()
    .max(60, msg("validation.nameTooLong"))
    .optional()
    .transform((value) => (value ? value : null)),
  email: emailSchema,
  message: z
    .string()
    .trim()
    .min(FEEDBACK_LIMITS.messageMin, msg("validation.messageTooShort"))
    .max(FEEDBACK_LIMITS.messageMax, msg("validation.messageTooLong")),
  website: z.string().max(200).optional().default(""),
});
export type FeedbackInput = z.infer<typeof feedbackSchema>;
