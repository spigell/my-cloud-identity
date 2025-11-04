import * as gcp from './src/gcp/index.js';
import * as cloudflare from './src/cloudflare/index.js';
import * as pulumi from '@pulumi/pulumi';

export const infraProject = gcp.infraProject;
export const resumeProduction = gcp.resumeProduction;
export const resumeDev = gcp.resumeDev;

const config = new pulumi.Config();
const cfg = config.requireObject<cloudflare.CloudflareConfig>('cloudflare');

export const CFtokens = new cloudflare.Cloudflare(cfg).addTokens();
