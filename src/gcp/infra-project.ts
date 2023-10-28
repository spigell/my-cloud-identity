import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

interface createdServiceAccount {
  [key: string]: pulumi.Output<string>;
}

const name = "spigell-infra";
const apis = ["container.googleapis.com", "cloudkms.googleapis.com"];

export type BasicSA = {
  name: string;
  roles: string[];
};

const basicServiceAccounts: BasicSA[] = [
  {
    // It only sets up the project and manage the state
    name: "pulumi-runner",
    roles: [],
  },
  {
    // Used in github repo to deploy hcloud infra
    name: "phkh-runner",
    roles: [],
  },
  {
    // It deploys all resources in the project
    name: "pulumi-deployer",
    roles: ["container.clusterAdmin"],
  },
];

// Project creates a project for personal long-term infrastructure
export class Project {
  name: string;
  kmsKeyPath: pulumi.Output<string>;
  pulumiServiceAccounts: createdServiceAccount[] = [];
  GkeServiceAccounts: createdServiceAccount[] = [];
  constructor(billingAccount: Promise<string>) {
    this.name = name;

    const project = new gcp.organizations.Project(name, {
      name: name,
      projectId: name,
      billingAccount: billingAccount,
    });

    const enabledApis: pulumi.Resource[] = [];
    apis.forEach((api) => {
      let enabled = new gcp.projects.Service(`${name}-${api}`, {
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
        location: "global",
        name: `${name}-keyring`,
      },
      { dependsOn: enabledApis }
    );

    const cryptoKey = new gcp.kms.CryptoKey(`${name}-pulumi-key`, {
      keyRing: keyRing.id,
      rotationPeriod: `${365 * 24 * 60 * 60}s`,
      name: `pulumi-key`,
      versionTemplate: {
        protectionLevel: "SOFTWARE",
        algorithm: "GOOGLE_SYMMETRIC_ENCRYPTION",
      },
    });

    const PHKHCryptoKey = new gcp.kms.CryptoKey(`${name}-phkh-pulumi-key`, {
      keyRing: keyRing.id,
      rotationPeriod: `${15 * 24 * 60 * 60}s`,
      name: `${name}-phkh-pulumi-key`,
      versionTemplate: {
        protectionLevel: "SOFTWARE",
        algorithm: "GOOGLE_SYMMETRIC_ENCRYPTION",
      },
    });

    this.kmsKeyPath = cryptoKey.id;

    const statesBucket = new gcp.storage.Bucket(`${name}-pulumi-state`, {
      name: `${name}-pulumi-states`,
      project: project.name,
      location: "us-central1",
      storageClass: "REGIONAL",
      publicAccessPrevention: "enforced",
      versioning: {
        enabled: true,
      },
    });

    const PHKHStateBucket = new gcp.storage.Bucket(`${name}-phkh-pulumi-state`, {
      name: `${name}-phkh-pulumi-states`,
      project: project.name,
      location: "us-central1",
      storageClass: "REGIONAL",
      publicAccessPrevention: "enforced",
      versioning: {
        enabled: true,
      },
    });

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

      const m: createdServiceAccount = {
        privateKey: k.privateKey.apply((key) =>
          Buffer.from(key, "base64").toString("utf8")
        ),
        email: sa.email,
      };

      this.pulumiServiceAccounts.push(m);
    });


    this.pulumiServiceAccounts.forEach((ac) => {
      // Apply to only pulumi-runner.
      ac.email.apply((email: string) => {
        if (email.includes("pulumi-runner")) {
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
        if (email.includes("phkh-runner")) {
          new gcp.storage.BucketIAMMember(
            `${name}-phkh-pulumi-runner-state-access`,
            {
              member: `serviceAccount:${email}`,
              role: `roles/storage.objectAdmin`,
              bucket: PHKHStateBucket.name,
            },
            { deleteBeforeReplace: true }
          );

          new gcp.kms.CryptoKeyIAMBinding(`${name}-phkh-pulumi-runner-kms-encryptor`, {
            cryptoKeyId: PHKHCryptoKey.id,
            role: `roles/cloudkms.cryptoKeyEncrypter`,
            members: [
              pulumi.interpolate`serviceAccount:${email}`,
            ],
          });
          new gcp.kms.CryptoKeyIAMBinding(`${name}-phkh-pulumi-runner-kms-decryptor`, {
            cryptoKeyId: PHKHCryptoKey.id,
            role: `roles/cloudkms.cryptoKeyDecrypter`,
            members: [
              pulumi.interpolate`serviceAccount:${email}`,
            ],
          });
        }
      });
    });
  }

  WithGKEServiceAccounts(list: string[]) {
    const members: pulumi.Output<string>[] = [];
    list.forEach((name) => {
      let ac = new gcp.serviceaccount.Account(`${this.name}-${name}-gke`, {
        accountId: `${name}-gke`,
        displayName: `${name}-gke`,
        project: this.name,
      });
      members.push(ac.email.apply((email) => `serviceAccount:${email}`));

      let k = new gcp.serviceaccount.Key(`${name}-gke-key`, {
        serviceAccountId: ac.name,
      });

      let m: createdServiceAccount = {
        privateKey: k.privateKey.apply((key) =>
          Buffer.from(key, "base64").toString("utf8")
        ),
        email: ac.email,
        namespace: pulumi.output(name),
      };

      this.GkeServiceAccounts.push(m);
    });

    // Controlling service accounts only here
    new gcp.projects.IAMBinding("gke-accounts", {
      members: members,
      project: this.name,
      role: "roles/container.clusterViewer",
    });

    return this;
  }
}
