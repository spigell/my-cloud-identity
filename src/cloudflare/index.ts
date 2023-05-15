import * as tokens from "./tokens";

export type CloudflareConfig = {
  zones: Zone[];
};

export type Zone = {
  id: string;
  name: string;
};

export class Cloudflare {
  cfg: CloudflareConfig;

  constructor(cfg: CloudflareConfig) {
    this.cfg = cfg;
  }

  public addTokens() {
    return new tokens.Tokens(this.cfg.zones);
  }
}
