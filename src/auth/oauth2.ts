/**
 * APACHE 2.0 CLEAN ROOM IMPLEMENTATION
 * Shared OAuth2 infrastructure
 */

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
}

export interface AuthConfig {
  clientId: string;
  clientSecret?: string;
  authEndpoint: string;
  tokenEndpoint: string;
  redirectUri: string;
  scopes: string[];
}

export class OAuth2Handler {
  constructor(private config: AuthConfig) {}

  public getAuthUrl(state: string, extraParams: Record<string, string> = {}): string {
    const url = new URL(this.config.authEndpoint);
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("redirect_uri", this.config.redirectUri);
    url.searchParams.set("scope", this.config.scopes.join(" "));
    url.searchParams.set("state", state);

    Object.entries(extraParams).forEach(([k, v]) => url.searchParams.set(k, v));

    return url.toString();
  }

  public async exchangeCode(code: string, verifier?: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      client_id: this.config.clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: this.config.redirectUri,
    };

    if (this.config.clientSecret) body.client_secret = this.config.clientSecret;
    if (verifier) body.code_verifier = verifier;

    return this.postToTokenEndpoint(body);
  }

  public async refreshToken(refreshToken: string): Promise<TokenResponse> {
    const body: Record<string, string> = {
      client_id: this.config.clientId,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    };

    if (this.config.clientSecret) body.client_secret = this.config.clientSecret;

    return this.postToTokenEndpoint(body);
  }

  private async postToTokenEndpoint(body: Record<string, string>): Promise<TokenResponse> {
    const response = await fetch(this.config.tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OAuth2 error (${response.status}): ${errorText}`);
    }

    return await response.json();
  }
}
