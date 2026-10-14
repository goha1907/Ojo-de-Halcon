import type { PrismaClient } from "@ojo/db";
import type { FeedbackInput } from "@ojo/shared";

export function createFeedbackService(deps: { prisma: PrismaClient }) {
  const { prisma } = deps;

  /**
   * Stores a message from the contact form (the admin area reads them). A filled honeypot is
   * dropped silently: the sender is a bot and gets the same answer as everyone.
   */
  async function submit(
    input: FeedbackInput,
    context: { userId: string | null; locale: string },
  ): Promise<void> {
    if (input.website) return;
    await prisma.feedbackMessage.create({
      data: {
        topic: input.topic,
        name: input.name,
        email: input.email,
        message: input.message,
        locale: context.locale,
        userId: context.userId,
      },
    });
  }

  return { submit };
}

export type FeedbackService = ReturnType<typeof createFeedbackService>;
