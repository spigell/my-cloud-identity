import * as pulumi from '@pulumi/pulumi';
import * as k8s from '@pulumi/kubernetes';

export type RbacPolicyRule = k8s.types.input.rbac.v1.PolicyRule;

export type NamespaceArgs = {
  name: string;
  serviceAccounts: NamespaceServiceAccountArgs[];
  provider?: k8s.Provider;
};

export type NamespaceServiceAccountArgs = {
  name: string;
  roleName: string;
  rbacRules?: RbacPolicyRule[];
};

export type NamespaceOutputs = {
  namespace: pulumi.Output<string>;
  serviceAccounts: pulumi.Output<string>[];
};

type NormalizedNamespaceArgs = {
  namespaceName: string;
  serviceAccounts: {
    name: string;
    roleName: string;
    rbacRules: RbacPolicyRule[];
  }[];
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
  private readonly serviceAccountResources: k8s.core.v1.ServiceAccount[];
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

    this.serviceAccountResources = [];
    for (const serviceAccountArgs of defaultedArgs.serviceAccounts) {
      const serviceAccountResource = new k8s.core.v1.ServiceAccount(
        serviceAccountArgs.name,
        {
          metadata: {
            name: serviceAccountArgs.name,
            namespace: this._namespaceResource.metadata.name,
          },
        },
        resourceOptions
      );

      const roleResource = new k8s.rbac.v1.Role(
        serviceAccountArgs.roleName,
        {
          metadata: {
            name: serviceAccountArgs.roleName,
            namespace: this._namespaceResource.metadata.name,
          },
          rules: serviceAccountArgs.rbacRules,
        },
        resourceOptions
      );

      new k8s.rbac.v1.RoleBinding(
        `${serviceAccountArgs.roleName}2${serviceAccountArgs.name}`,
        {
          metadata: {
            name: `${serviceAccountArgs.roleName}-${serviceAccountArgs.name}`,
            namespace: this._namespaceResource.metadata.name,
          },
          subjects: [
            {
              kind: 'ServiceAccount',
              name: serviceAccountResource.metadata.name,
              namespace: this._namespaceResource.metadata.name,
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

      this.serviceAccountResources.push(serviceAccountResource);
    }

    // Assign the public properties to satisfy the interface
    const namespace = this._namespaceResource.metadata.name;
    const serviceAccounts = this.serviceAccountResources.map(
      (serviceAccount) => serviceAccount.metadata.name
    );

    this.outputs = {
      namespace: namespace, // Reference the public property
      serviceAccounts: serviceAccounts,
    };

    this.registerOutputs({
      namespace: namespace, // Reference the public property
      serviceAccounts: serviceAccounts,
    });
  }

  private withDefaults(args: NamespaceArgs): NormalizedNamespaceArgs {
    const provider = args.provider;

    return {
      namespaceName: args.name,
      serviceAccounts: args.serviceAccounts.map((serviceAccount) => ({
        name: serviceAccount.name,
        roleName: serviceAccount.roleName,
        rbacRules: serviceAccount.rbacRules ?? defaultRules,
      })),
      provider,
    };
  }
}
