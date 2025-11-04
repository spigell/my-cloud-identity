import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

interface CreatedServiceAccount {
  privateKey: pulumi.Output<string>;
  email: pulumi.Output<string>;
  namespace?: pulumi.Output<string>;
}

const name = 'spigell-infra';
const apis = ['container.googleapis.com', 'cloudkms.googleapis.com'];

export type BasicSA = {
  name: string;
  roles: string[];
};

const basicServiceAccounts: BasicSA[] = [
  {
    // It only sets up the project and manage the state
    name: 'pulumi-runner',
    roles: [],
  },
  {
    name: 'reforge-ai',
    roles: [],
  },
  {
    // Used in github repo to deploy talos clusters
    name: 'talos-runner',
    roles: [],
  },
  {
    // It deploys all resources in the project
    name: 'pulumi-deployer',
    roles: ['container.clusterAdmin'],
  },
];

// Project creates a project for personal long-term infrastructure
export class Project {
  name: string;
  kmsKeyPath: pulumi.Output<string>;
  pulumiServiceAccounts: CreatedServiceAccount[] = [];
  GkeServiceAccounts: CreatedServiceAccount[] = [];
  public reforgeAiServiceAccountKey!: pulumi.Output<string>;
  statesBucketName: pulumi.Output<string>;
  constructor(billingAccount: Promise<string>) {
    this.name = name;

    const project = new gcp.organizations.Project(name, {
      name: name,
      projectId: name,
      billingAccount: billingAccount,
    });

    const enabledApis: pulumi.Resource[] = [];
    apis.forEach((api) => {
      const enabled = new gcp.projects.Service(`${name}-${api}`, {
        service: api,
        project: project.name,
      });
      enabledApis.push(enabled);
    });

    // Create kms key to encrypt pulumi secrets
    const keyRing = new gcp.kms.KeyRing(
      `${name}-keyring`,
      {
        project: project.name,
        location: 'global',
        name: `${name}-keyring`,
      },
      { dependsOn: enabledApis }
    );

    const cryptoKey = new gcp.kms.CryptoKey(`${name}-pulumi-key`, {
      keyRing: keyRing.id,
      rotationPeriod: `${365 * 24 * 60 * 60}s`,
      name: `pulumi-key`,
      versionTemplate: {
        protectionLevel: 'SOFTWARE',
        algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
      },
    });

    const ReforgeAICryptoKey = new gcp.kms.CryptoKey(
      `${name}-my-reforge-ai-pulumi-key`,
      {
        keyRing: keyRing.id,
        rotationPeriod: `${365 * 24 * 60 * 60}s`,
        name: `${name}-my-reforge-ai-pulumi-key`,
        versionTemplate: {
          protectionLevel: 'SOFTWARE',
          algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
        },
      }
    );

    const TalosClusterCryptoKey = new gcp.kms.CryptoKey(
      `${name}-talos-pulumi-key`,
      {
        keyRing: keyRing.id,
        rotationPeriod: `${365 * 24 * 60 * 60}s`,
        name: `${name}-talos-pulumi-key`,
        versionTemplate: {
          protectionLevel: 'SOFTWARE',
          algorithm: 'GOOGLE_SYMMETRIC_ENCRYPTION',
        },
      }
    );

    this.kmsKeyPath = cryptoKey.id;

    const statesBucket = new gcp.storage.Bucket(`${name}-pulumi-state`, {
      name: `${name}-pulumi-states`,
      project: project.name,
      location: 'us-central1',
      storageClass: 'REGIONAL',
      publicAccessPrevention: 'enforced',
      softDeletePolicy: {
        retentionDurationSeconds: 0,
      },
      versioning: {
        enabled: true,
      },
    });
    this.statesBucketName = statesBucket.name;

    const PulumiTalosStateBucket = new gcp.storage.Bucket(
      `${name}-talos-pulumi-state`,
      {
        name: `${name}-talos-pulumi-states`,
        project: project.name,
        location: 'us-central1',
        storageClass: 'REGIONAL',
        publicAccessPrevention: 'enforced',
        softDeletePolicy: {
          retentionDurationSeconds: 0,
        },
        versioning: {
          enabled: false,
        },
      }
    );

    // Create a SA for my-infra project
    basicServiceAccounts.forEach((ac) => {
      const sa = new gcp.serviceaccount.Account(`${name}-${ac.name}`, {
        accountId: `${name}-${ac.name}`,
        displayName: `${name}-${ac.name}`,
        project: project.name,
      });

      const k = new gcp.serviceaccount.Key(`${name}-${ac.name}`, {
        serviceAccountId: sa.name,
      });

      ac.roles.forEach((role) => {
        new gcp.projects.IAMMember(
          `${name}-${ac.name}-${role}`,
          {
            member: pulumi.interpolate`serviceAccount:${sa.email}`,
            role: `roles/${role}`,
            project: project.name,
          },
          { dependsOn: enabledApis }
        );
      });

      const m: CreatedServiceAccount = {
        privateKey: k.privateKey.apply((key) =>
          Buffer.from(key, 'base64').toString('utf8')
        ),
        email: sa.email,
      };

      this.pulumiServiceAccounts.push(m);

      if (ac.name === 'reforge-ai') {
        this.reforgeAiServiceAccountKey = m.privateKey;
      }
    });

    this.pulumiServiceAccounts.forEach((ac) => {
      // Apply to only pulumi-runner.
      ac.email.apply((email: string) => {
        if (email.includes('pulumi-runner')) {
          new gcp.storage.BucketIAMMember(
            `${name}-pulumi-runner-state-access`,
            {
              member: `serviceAccount:${email}`,
              role: `roles/storage.objectAdmin`,
              bucket: statesBucket.name,
            },
            { deleteBeforeReplace: true }
          );
        }

        if (email.includes('reforge-ai-runner')) {
          new gcp.storage.BucketIAMMember(
            `${name}-reforge-ai-runner-state-access`,
            {
              member: `serviceAccount:${email}`,
              role: `roles/storage.objectAdmin`,
              bucket: statesBucket.name,
            },
            { deleteBeforeReplace: true }
          );

          new gcp.kms.CryptoKeyIAMBinding(
            `${name}-reforge-ai-runner-kms-encryptor`,
            {
              cryptoKeyId: ReforgeAICryptoKey.id,
              role: `roles/cloudkms.cryptoKeyEncrypter`,
              members: [pulumi.interpolate`serviceAccount:${email}`],
            }
          );
          new gcp.kms.CryptoKeyIAMBinding(
            `${name}-reforge-ai-runner-kms-decryptor`,
            {
              cryptoKeyId: ReforgeAICryptoKey.id,
              role: `roles/cloudkms.cryptoKeyDecrypter`,
              members: [pulumi.interpolate`serviceAccount:${email}`],
            }
          );

          if (email.includes('spigell-infra-talos-runner')) {
            new gcp.storage.BucketIAMMember(
              `${name}-pulumi-talos-runner-state-access`,
              {
                member: `serviceAccount:${email}`,
                role: `roles/storage.objectAdmin`,
                bucket: PulumiTalosStateBucket.name,
              },
              { deleteBeforeReplace: true }
            );

            new gcp.kms.CryptoKeyIAMBinding(
              `${name}-talos-pulumi-runner-kms-encryptor`,
              {
                cryptoKeyId: TalosClusterCryptoKey.id,
                role: `roles/cloudkms.cryptoKeyEncrypter`,
                members: [pulumi.interpolate`serviceAccount:${email}`],
              }
            );
            new gcp.kms.CryptoKeyIAMBinding(
              `${name}-talos-pulumi-runner-kms-decryptor`,
              {
                cryptoKeyId: TalosClusterCryptoKey.id,
                role: `roles/cloudkms.cryptoKeyDecrypter`,
                members: [pulumi.interpolate`serviceAccount:${email}`],
              }
            );
          }
        }
      });
    });
  }

  WithGKEServiceAccounts(list: string[]) {
    const members: pulumi.Output<string>[] = [];
    list.forEach((name) => {
      const ac = new gcp.serviceaccount.Account(`${this.name}-${name}-gke`, {
        accountId: `${name}-gke`,
        displayName: `${name}-gke`,
        project: this.name,
      });
      members.push(ac.email.apply((email) => `serviceAccount:${email}`));

      const k = new gcp.serviceaccount.Key(`${name}-gke-key`, {
        serviceAccountId: ac.name,
      });

      const m: CreatedServiceAccount = {
        privateKey: k.privateKey.apply((key) =>
          Buffer.from(key, 'base64').toString('utf8')
        ),
        email: ac.email,
        namespace: pulumi.output(name),
      };

      this.GkeServiceAccounts.push(m);
    });

    // Controlling service accounts only here
    new gcp.projects.IAMBinding('gke-accounts', {
      members: members,
      project: this.name,
      role: 'roles/container.clusterViewer',
    });

    return this;
  }

  allowWriteToStateBucket(email: string) {
    new gcp.storage.BucketIAMMember(
      `pulumi-state-member-${email.split('.')[0]}`,
      {
        member: `serviceAccount:${email}`,
        role: `roles/storage.objectAdmin`,
        bucket: this.statesBucketName,
      },
      { deleteBeforeReplace: true }
    );
  }
}
