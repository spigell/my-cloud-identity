import fs from 'node:fs';
import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

export interface KubeconfigProviderArgs {
  name: string;
  kubeconfigPath: pulumi.Input<string>;
  opts?: pulumi.ResourceOptions;
}

export function createKubeconfigProvider({
  name,
  kubeconfigPath,
  opts,
}: KubeconfigProviderArgs): k8s.Provider {
  const kubeconfig = pulumi.output(kubeconfigPath).apply((path) => {
    if (!path) {
      throw new pulumi.RunError('Kubeconfig path is empty.');
    }

    const normalizedPath = path.trim();

    if (!fs.existsSync(normalizedPath)) {
      throw new pulumi.RunError(`Kubeconfig not found at ${normalizedPath}.`);
    }

    return fs.readFileSync(normalizedPath, 'utf8');
  });

  return new k8s.Provider(name, { kubeconfig }, opts);
}
