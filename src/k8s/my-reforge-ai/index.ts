import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import {
  Namespace,
  NamespaceArgs,
  RbacPolicyRule,
} from '../common/components/namespace.js';
import { createKubeconfigProvider } from '../common/util/provider.js';

export type ReforgeAiNamespaceArgs = {
  kubeconfigPath: pulumi.Input<string>;
  gcpSecretKey: pulumi.Output<string>;
};

export type NamespaceOutputs = {
  outputs: ReforgeAiNamespaceOutputs;
};

export type ReforgeAiNamespaceOutputs = {
  pulumiAccountName: pulumi.Output<string>;
  gcpSecretKeyName: pulumi.Output<string>;
};

const PULUMI_RBAC_RULES: RbacPolicyRule[] = [
  {
    apiGroups: ['', 'apps', 'batch'],
    resources: ['*'],
    verbs: ['*'],
  },
];

export class ReforgeAiNamespace
  extends pulumi.ComponentResource
  implements NamespaceOutputs
{
  private readonly provider: k8s.Provider;
  public outputs: ReforgeAiNamespaceOutputs;

  constructor(args: ReforgeAiNamespaceArgs) {
    const name = 'my-reforge-ai';

    super('my-cloud-identity:k8s:ReforgeAiNamespace', name, {}, {});

    const provider = createKubeconfigProvider({
      name: `${name}-provider`,
      kubeconfigPath: args.kubeconfigPath,
      opts: { parent: this },
    });

    this.provider = provider;

    const namespaceArgs: NamespaceArgs = {
      name,
      serviceAccounts: [
        {
          name: 'pulumi',
          roleName: 'pulumi-role',
          rbacRules: PULUMI_RBAC_RULES,
        },
      ],
      provider,
    };

    const deployed = new Namespace(
      name,
      namespaceArgs,
      pulumi.mergeOptions({}, { parent: this })
    );

    const namespaceOutputs = deployed.outputs;
    const [pulumiAccountName] = namespaceOutputs.serviceAccounts;

    if (!pulumiAccountName) {
      throw new pulumi.RunError(
        'Expected at least one service account for the Reforge AI namespace.'
      );
    }

    const credentialsJson = pulumi
      .secret(args.gcpSecretKey)
      .apply((key) => Buffer.from(key, 'utf8').toString('base64'));

    const secret = new k8s.core.v1.Secret(
      name,
      {
        metadata: {
          name,
          namespace: namespaceOutputs.namespace,
        },
        data: {
          'credentials.json': credentialsJson,
        },
        type: 'Opaque',
      },
      { provider: this.provider, parent: this }
    );

    this.outputs = {
      pulumiAccountName: pulumiAccountName,
      gcpSecretKeyName: secret.metadata.name,
    };

    this.registerOutputs({
      namespace: namespaceOutputs.namespace,
    });
  }
}
