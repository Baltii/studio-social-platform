import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { users } from "@studio/database";
import { eq } from "drizzle-orm";

import { DatabaseService } from "../database.service";
import type { AuthenticatedRequest } from "./authenticated-request";
import { OidcTokenVerifier } from "./oidc-token-verifier";
import { PUBLIC_ROUTE_KEY } from "./public.decorator";

@Injectable()
export class OidcAuthGuard implements CanActivate {
  @Inject(Reflector)
  private readonly reflector!: Reflector;

  @Inject(DatabaseService)
  private readonly database!: DatabaseService;

  private readonly issuer = process.env.OIDC_ISSUER_URL?.replace(/\/+$/, "");
  private readonly audience = process.env.OIDC_API_AUDIENCE;
  private readonly allowedClientId = process.env.OIDC_ALLOWED_CLIENT_ID;
  private readonly verifier =
    this.issuer && this.audience && this.allowedClientId
      ? new OidcTokenVerifier({
          issuer: this.issuer,
          audience: this.audience,
          allowedClientId: this.allowedClientId,
          jwksUrl: process.env.OIDC_JWKS_URL ?? `${this.issuer}/protocol/openid-connect/certs`,
        })
      : null;

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.reflector.getAllAndOverride<boolean>(PUBLIC_ROUTE_KEY, [context.getHandler(), context.getClass()])) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;
    if (!authorization?.startsWith("Bearer ") || authorization.length > 8200) {
      throw new UnauthorizedException("Bearer token required");
    }
    if (!this.verifier) {
      throw new ServiceUnavailableException("OIDC is not configured");
    }

    const token = authorization.slice(7);
    const identity = await this.verifier.verify(token);
    const [created] = await this.database.db
      .insert(users)
      .values({ oidcSubject: identity.subject, email: identity.email, displayName: identity.displayName })
      .onConflictDoNothing()
      .returning({ id: users.id });
    const userId =
      created?.id ??
      (
        await this.database.db
          .select({ id: users.id })
          .from(users)
          .where(eq(users.oidcSubject, identity.subject))
          .limit(1)
      )[0]?.id;
    if (!userId) {
      throw new ServiceUnavailableException("User identity could not be resolved");
    }
    request.actor = { userId, subject: identity.subject, email: identity.email };
    return true;
  }
}
