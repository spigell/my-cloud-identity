import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

export type RbacPolicyRule = k8s.types.input.rbac.v1.PolicyRule;
export type ClusterRbacPolicyRule = k8s.types.input.rbac.v1.PolicyRule;

export type ServiceAccountArgs = {
  /** The name of the ServiceAccount */
  name: string;

  /** Rules for a namespace-scoped Role that will be bound to this ServiceAccount */
  namespaceRbacRules?: RbacPolicyRule[];

  /** Rules for a cluster-scoped ClusterRole that will be bound to this ServiceAccount */
  clusterRbacRules?: ClusterRbacPolicyRule[];
};

export type NamespaceArgs = {
  name: string;
  serviceAccounts: ServiceAccountArgs[];
  provider?: k8s.Provider;
};

export type NamespaceOutputs = {
  namespace: pulumi.Output<string>;
  serviceAccounts: Record<string, pulumi.Output<string>>;
};

type NormalizedNamespaceArgs = {
  namespaceName: string;
  serviceAccounts: Required<ServiceAccountArgs>[];
  provider?: k8s.Provider;
};

const defaultRules: RbacPolicyRule[] = [
  {
    // The '' apiGroup is for core Kubernetes resources
    apiGroups: [''],
    // List of resources the service account can access
    resources: ['pods', 'services', 'endpoints', 'configmaps', 'secrets'],
    // Verbs define the allowed actions (read-only)
    verbs: ['get', 'list', 'watch'],
  },
];

export class Namespace extends pulumi.ComponentResource {
  // This implementation is for the public outputs
  public readonly outputs: NamespaceOutputs; // This will hold the actual outputs
  // Renamed internal resource properties to avoid conflict with NamespaceOutputs
  private readonly _namespaceResource: k8s.core.v1.Namespace;
  private readonly provider?: k8s.Provider;

  constructor(
    name: string,
    args: NamespaceArgs,
    opts: pulumi.ComponentResourceOptions = {}
  ) {
    super('my-cloud-identity:k8s:Namespace', name, args, opts);

    const defaultedArgs = this.withDefaults(args);
    this.provider = defaultedArgs.provider;

    const resourceOptions = pulumi.mergeOptions(
      opts,
      this.provider
        ? { parent: this, provider: this.provider }
        : { parent: this }
    );

    this._namespaceResource = new k8s.core.v1.Namespace(
      defaultedArgs.namespaceName,
      {
        metadata: {
          name: defaultedArgs.namespaceName,
        },
      },
      resourceOptions
    );

    const namespaceName = this._namespaceResource.metadata.name;
    const serviceAccountOutputs: Record<string, pulumi.Output<string>> = {};
    for (const serviceAccountArgs of defaultedArgs.serviceAccounts) {
      const serviceAccountResource = new k8s.core.v1.ServiceAccount(
        serviceAccountArgs.name,
        {
          metadata: {
            name: serviceAccountArgs.name,
            namespace: namespaceName,
          },
        },
        resourceOptions
      );

      if (serviceAccountArgs.namespaceRbacRules.length) {
        const roleName = serviceAccountArgs.name;
        const roleResource = new k8s.rbac.v1.Role(
          roleName,
          {
            metadata: {
              name: roleName,
              namespace: namespaceName,
            },
            rules: serviceAccountArgs.namespaceRbacRules,
          },
          resourceOptions
        );

        const RoleBindingName = `${roleName}2${serviceAccountArgs.name}`;
        new k8s.rbac.v1.RoleBinding(
          RoleBindingName,
          {
            metadata: {
              name: RoleBindingName,
              namespace: namespaceName,
            },
            subjects: [
              {
                kind: 'ServiceAccount',
                name: serviceAccountResource.metadata.name,
                namespace: namespaceName,
              },
            ],
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind: 'Role',
              name: roleResource.metadata.name,
            },
          },
          resourceOptions
        );
      }

      if (serviceAccountArgs.clusterRbacRules.length) {
        const clusterRoleName = serviceAccountArgs.name;
        const clusterRoleResource = new k8s.rbac.v1.ClusterRole(
          clusterRoleName,
          {
            metadata: {
              name: clusterRoleName,
            },
            rules: serviceAccountArgs.clusterRbacRules,
          },
          resourceOptions
        );

        const ClusterRoleBindingName = `${clusterRoleName}2${serviceAccountArgs.name}`;
        new k8s.rbac.v1.ClusterRoleBinding(
          ClusterRoleBindingName,
          {
            metadata: {
              name: ClusterRoleBindingName,
            },
            subjects: [
              {
                kind: 'ServiceAccount',
                name: serviceAccountResource.metadata.name,
                namespace: namespaceName,
              },
            ],
            roleRef: {
              apiGroup: 'rbac.authorization.k8s.io',
              kind: 'ClusterRole',
              name: clusterRoleResource.metadata.name,
            },
          },
          resourceOptions
        );
      }

      serviceAccountOutputs[serviceAccountArgs.name] =
        serviceAccountResource.metadata.name;
    }

    this.outputs = {
      namespace: namespaceName,
      serviceAccounts: serviceAccountOutputs,
    };

    this.registerOutputs(this.outputs);
  }

  private withDefaults(args: NamespaceArgs): NormalizedNamespaceArgs {
    const provider = args.provider;

    return {
      namespaceName: args.name,
      serviceAccounts: args.serviceAccounts.map((serviceAccount) => ({
        name: serviceAccount.name,
        namespaceRbacRules: serviceAccount.namespaceRbacRules ?? defaultRules,
        clusterRbacRules: serviceAccount.clusterRbacRules ?? [],
      })),
      provider,
    };
  }
}
