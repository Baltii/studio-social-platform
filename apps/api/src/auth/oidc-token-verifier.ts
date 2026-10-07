import { UnauthorizedException } from "@nestjs/common";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { z } from "zod";

export interface OidcIdentity {
  subject: string;
  email: string;
  displayName: string | null;
}

export interface OidcConfig {
  issuer: string;
  audience: string;
  allowedClientId: string;
  jwksUrl: string;
}

export class OidcTokenVerifier {
  private readonly jwks;

  constructor(private readonly config: OidcConfig) {
    this.jwks = jwksClient({
      jwksUri: config.jwksUrl,
      cache: true,
      rateLimit: true,
      jwksRequestsPerMinute: 10,
      timeout: 5000,
    });
  }

  async verify(token: string): Promise<OidcIdentity> {
    const unverified = jwt.decode(token, { complete: true });
    if (!unverified || typeof unverified === "string" || unverified.header.alg !== "RS256") {
      throw new UnauthorizedException("Invalid access token");
    }
    const keyId = unverified.header.kid;
    if (!keyId || keyId.length > 200) {
      throw new UnauthorizedException("Invalid access token");
    }

    let claims: string | jwt.JwtPayload;
    try {
      const key = await this.jwks.getSigningKey(keyId);
      claims = jwt.verify(token, key.getPublicKey(), {
        algorithms: ["RS256"],
        issuer: this.config.issuer,
        audience: this.config.audience,
        clockTolerance: 5,
      });
    } catch {
      throw new UnauthorizedException("Invalid access token");
    }

    if (
      typeof claims === "string" ||
      typeof claims.sub !== "string" ||
      typeof claims.exp !== "number" ||
      claims.azp !== this.config.allowedClientId
    ) {
      throw new UnauthorizedException("Invalid access token claims");
    }
    const email = z.email().max(320).safeParse(claims.email);
    if (!email.success) {
      throw new UnauthorizedException("Access token requires an email claim");
    }
    return {
      subject: claims.sub,
      email: email.data,
      displayName: typeof claims.name === "string" ? claims.name.slice(0, 160) : null,
    };
  }
}
