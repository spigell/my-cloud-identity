import * as pulumi from '@pulumi/pulumi';
import { ReforgeAiNamespace } from './my-reforge-ai.js';
import { KubeconfigPaths } from './config.js';

type NamespaceConfig = Record<string, pulumi.Output<string>>;

export type KubernetesArgs = {
  kubeconfigsPath: KubeconfigPaths;
  namespaceConfigs: Record<string, NamespaceConfig>;
};

export class Kubernetes {
  public readonly myReforgeAi: ReforgeAiNamespace;

  constructor(args: KubernetesArgs) {
    const namespaceConfig = args.namespaceConfigs['my-reforge-ai'];
    if (!namespaceConfig?.gcpSecretKey) {
      throw new pulumi.RunError(
        'my-reforge-ai namespace requires gcpSecretKey'
      );
    }

    this.myReforgeAi = new ReforgeAiNamespace({
      kubeconfigPath: args.kubeconfigsPath.homelab,
      gcpSecretKey: namespaceConfig.gcpSecretKey,
    });
  }
}
