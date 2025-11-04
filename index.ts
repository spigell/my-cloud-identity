import * as gcp from './src/gcp/index.js';
import * as cloudflare from './src/cloudflare/index.js';
import * as k8s from './src/k8s/index.js';
import { KubeconfigPaths } from './src/k8s/config.js';
import * as pulumi from '@pulumi/pulumi';

export const infraProject = gcp.infraProject;
export const resumeProduction = gcp.resumeProduction;
export const resumeDev = gcp.resumeDev;

const config = new pulumi.Config();
const cfg = config.requireObject<cloudflare.CloudflareConfig>('cloudflare');

export const CFtokens = new cloudflare.Cloudflare(cfg).addTokens();

const kubeconfigPaths =
  config.requireSecretObject<KubeconfigPaths>('kubeconfigs');
const kubernetes = new k8s.Kubernetes({
  kubeconfigsPath: kubeconfigPaths,
  namespaceConfigs: {
    'my-reforge-ai': {
      gcpSecretKey: gcp.infraProject.reforgeAiServiceAccountKey,
    },
  },
});

const myReforgeAi = kubernetes.myReforgeAi;

export const outputs_to_reexport = {
  'my-reforge-ai': {
    'pulumi-account-name': myReforgeAi.outputs.pulumiAccountName,
    'gcp-secret-key-name': myReforgeAi.outputs.gcpSecretKeyName,
  },
};
