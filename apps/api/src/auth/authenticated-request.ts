export interface AuthActor {
  userId: string;
  subject: string;
  email: string;
}

export interface AuthenticatedRequest {
  headers: { authorization?: string };
  params: Record<string, string>;
  actor?: AuthActor;
}
