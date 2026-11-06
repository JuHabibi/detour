export type LegalPublisher = {
  name: string;
  email: string;
};

export const legalPublisher: LegalPublisher = {
  name: "Julien Habibi",
  email: "detour.orleans@gmail.com",
};

export function isLegalPublisherReady(
  publisher: LegalPublisher | null = legalPublisher,
): boolean {
  if (!publisher) return false;
  return publisher.name.trim().length > 0 && publisher.email.trim().length > 0;
}

