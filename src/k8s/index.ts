import * as pulumi from '@pulumi/pulumi';
import {
  NAMESPACE_NAME as REFORGE_NAMESPACE_NAME,
  ReforgeAiNamespace,
} from './my-reforge-ai/index.js';
import { KubeconfigPaths } from './config.js';

type NamespaceConfig = Record<string, pulumi.Output<string>>;

export type KubernetesArgs = {
  kubeconfigsPath: KubeconfigPaths;
  namespaceConfigs: Record<string, NamespaceConfig>;
};

export class Kubernetes {
  public readonly myReforgeAi: ReforgeAiNamespace;

  constructor(args: KubernetesArgs) {
    const namespaceConfig = args.namespaceConfigs[REFORGE_NAMESPACE_NAME];
    if (!namespaceConfig.gcpSecretKey) {
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
