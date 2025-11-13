import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';
import {
  ClusterRbacPolicyRule,
  Namespace,
  NamespaceArgs,
  RbacPolicyRule,
  ServiceAccountArgs,
} from '../common/components/namespace.js';
import { createKubeconfigProvider } from '../common/util/provider.js';

export const NAMESPACE_NAME = 'my-reforge-ai';

const CORE_READ_ONLY_RULES: RbacPolicyRule[] = [
  {
    apiGroups: ['', 'apps', 'batch'],
    resources: [
      'pods',
      'services',
      'endpoints',
      'configmaps',
      'deployments',
      'jobs',
    ],
    verbs: ['get', 'list', 'watch'],
  },
];

const VICTORIA_METRICS_RULES: RbacPolicyRule[] = [
  {
    apiGroups: ['operator.victoriametrics.com'],
    resources: ['vmpodscrapes'],
    verbs: ['get', 'list', 'watch', 'update', 'patch', 'create', 'delete'],
  },
];

const DEPLOYMENT_MANAGEMENT_RULES: RbacPolicyRule[] = [
  {
    apiGroups: ['apps'],
    resources: ['deployments', 'replicasets'],
    verbs: ['get', 'list', 'watch', 'update', 'patch'],
  },
  {
    apiGroups: ['batch'],
    resources: ['jobs', 'cronjobs'],
    verbs: ['get', 'list', 'watch', 'create', 'update', 'patch', 'delete'],
  },
];

const PERSISTENT_VOLUME_CLUSTER_RULES: ClusterRbacPolicyRule[] = [
  {
    apiGroups: [''],
    resources: ['persistentvolumes', 'persistentvolumeclaims'],
    verbs: ['get', 'list', 'watch'],
  },
];

const PULUMI_MCP_SERVICE_ACCOUNT: ServiceAccountArgs = {
  name: 'pulumi-mcp',
  namespaceRbacRules: [
    ...CORE_READ_ONLY_RULES,
    ...VICTORIA_METRICS_RULES,
    ...DEPLOYMENT_MANAGEMENT_RULES,
  ],
  clusterRbacRules: [...PERSISTENT_VOLUME_CLUSTER_RULES],
};

const SERVICE_ACCOUNTS: ServiceAccountArgs[] = [PULUMI_MCP_SERVICE_ACCOUNT];

export type ReforgeAiNamespaceArgs = {
  kubeconfigPath: pulumi.Input<string>;
  gcpSecretKey: pulumi.Output<string>;
};

export type NamespaceOutputs = {
  outputs: ReforgeAiNamespaceOutputs;
};

export type ReforgeAiNamespaceOutputs = {
  pulumiAccountName: pulumi.Output<string>;
  pulumiGCPSecretKeyName: pulumi.Output<string>;
  namespaceName: pulumi.Output<string>;
};

export class ReforgeAiNamespace
  extends pulumi.ComponentResource
  implements NamespaceOutputs
{
  private readonly provider: k8s.Provider;
  public outputs: ReforgeAiNamespaceOutputs;

  constructor(args: ReforgeAiNamespaceArgs) {
    super('my-cloud-identity:k8s:ReforgeAiNamespace', NAMESPACE_NAME, {}, {});

    const provider = createKubeconfigProvider({
      name: `${NAMESPACE_NAME}-ns`,
      kubeconfigPath: args.kubeconfigPath,
      opts: { parent: this },
    });

    this.provider = provider;

    const namespaceArgs: NamespaceArgs = {
      name: NAMESPACE_NAME,
      serviceAccounts: SERVICE_ACCOUNTS,
      provider,
    };

    const deployed = new Namespace(
      NAMESPACE_NAME,
      namespaceArgs,
      pulumi.mergeOptions({}, { parent: this })
    );

    const namespaceOutputs = deployed.outputs;
    const pulumiAccountName = namespaceOutputs.serviceAccounts['pulumi-mcp'];

    if (!pulumiAccountName) {
      throw new pulumi.RunError(
        "Expected a service account configuration named 'pulumi-mcp'."
      );
    }

    const credentialsJson = pulumi
      .secret(args.gcpSecretKey)
      .apply((key) => Buffer.from(key, 'utf8').toString('base64'));

    const gcpPulumiSecretKey = new k8s.core.v1.Secret(
      'gcp-pulumi-runner-key',
      {
        metadata: {
          name: 'gcp-pulumi-runner-key',
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
      pulumiGCPSecretKeyName: pulumi.secret(gcpPulumiSecretKey.metadata.name),
      namespaceName: namespaceOutputs.namespace,
    };

    this.registerOutputs({
      namespace: namespaceOutputs.namespace,
      pulumiAccountName: pulumiAccountName,
      gcpSecretKeyName: gcpPulumiSecretKey.metadata.name,
    });
  }
}
