import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

const registryName = "resume-images";

type DeployedProject = {
  runnerPrivateKey: pulumi.Output<string>;
  runnerEmail: pulumi.Output<string>;
  kmsKeyPath: pulumi.Output<string>;
  projectID: pulumi.Output<string>;
};

const customRole = {
  name: "custom.pulumi.runner",
  permissions: ["compute.regionOperations.get"],
};

const apis = [
  "iam.googleapis.com",
  "compute.googleapis.com",
  "dns.googleapis.com",
  "run.googleapis.com",
  "cloudkms.googleapis.com",
  "artifactregistry.googleapis.com",
  "certificatemanager.googleapis.com",
  "firestore.googleapis.com",
];

const roles = [
  "dns.admin",
  "storage.admin",
  "compute.loadBalancerAdmin",
  "run.admin",
  "iam.serviceAccountTokenCreator",
  "artifactregistry.writer",
  "certificatemanager.owner",
  "datastore.owner",
];

export function ResumeProject(billingAccount: Promise<string>, name: string) {
  // Create
  const project = new gcp.organizations.Project(name, {
    name: name,
    projectId: name,
    billingAccount: billingAccount,
  });

  // Enable apis
  const enabledApis: pulumi.Resource[] = [];
  apis.forEach((api) => {
    let enabled = new gcp.projects.Service(`${name}-${api}`, {
      service: api,
      project: project.name,
    });
    enabledApis.push(enabled);
  });

  // Create iam account for specific project
  const gcpAccount = new gcp.serviceaccount.Account(`${name}-pulumi-runner`, {
    accountId: "pulumi-runner",
    displayName: "Pulumi Runner",
    project: project.name,
  });

  // Create kms key for the SA
  const keyring = new gcp.kms.KeyRing(
    `${name}-keyring`,
    {
      name: "pulumi-runner-keyring",
      project: project.name,
      location: "global",
    },
    { dependsOn: enabledApis }
  );

  const key = new gcp.kms.CryptoKey(`${name}-key`, {
    name: "pulumi-runner-key",
    keyRing: keyring.id,
    rotationPeriod: "15552000s",
    versionTemplate: {
      protectionLevel: "SOFTWARE",
      algorithm: "GOOGLE_SYMMETRIC_ENCRYPTION",
    },
  });

  const cr = new gcp.projects.IAMCustomRole(
    `${name}-pulumi-runner`,
    {
      title: "Custom role for pulumi runner",
      roleId: customRole.name,
      permissions: customRole.permissions,
      project: project.name,
    },
    { dependsOn: enabledApis }
  );

  // Add custom role to SA
  new gcp.projects.IAMBinding(
    `${name}-pulumi-runner-role`,
    {
      members: [gcpAccount.email.apply((email) => `serviceAccount:${email}`)],
      role: cr.name,
      project: project.name,
    },
    { dependsOn: enabledApis }
  );

  roles.forEach((role) => {
    new gcp.projects.IAMBinding(
      `${name}-${role}`,
      {
        members: [gcpAccount.email.apply((email) => `serviceAccount:${email}`)],
        role: `roles/${role}`,
        project: project.name,
      },
      { dependsOn: enabledApis }
    );
  });

  // Allow SA make deploy to cloud run
  new gcp.serviceaccount.IAMBinding(`${name}-cloudrun-deployer`, {
    serviceAccountId: pulumi.interpolate`projects/${project.name}/serviceAccounts/${project.number}-compute@developer.gserviceaccount.com`,
    members: [gcpAccount.email.apply((email) => `serviceAccount:${email}`)],
    role: "roles/iam.serviceAccountUser",
  });

  // Create repo in artifact registry
  new gcp.artifactregistry.Repository(
    `${name}-${registryName}`,
    {
      location: "us-central1",
      repositoryId: registryName,
      project: project.name,
      format: "DOCKER",
      description: "Resume images",
    },
    { dependsOn: enabledApis }
  );

  // Allow sa to decrypt data with key
  new gcp.kms.CryptoKeyIAMMember(`${name}-key-decrypter`, {
    cryptoKeyId: key.id,
    role: "roles/cloudkms.cryptoKeyDecrypter",
    member: gcpAccount.email.apply((email) => `serviceAccount:${email}`),
  });

  // Create account key
  const gcpKey = new gcp.serviceaccount.Key(`${name}-key`, {
    serviceAccountId: gcpAccount.name,
  });

  // export the private key as decoded base64 string
  const deployed: DeployedProject = {
    runnerPrivateKey: gcpKey.privateKey.apply((key) =>
      Buffer.from(key, "base64").toString("utf8")
    ),
    runnerEmail: gcpAccount.email,
    kmsKeyPath: key.id,
    projectID: project.number,
  };

  return deployed;
}

export function AddRegistryPermissions(
  projectID: pulumi.Output<string>,
  project: string
) {
  new gcp.projects.IAMMember(`reader-for-${project}`, {
    project: project,
    member: pulumi.interpolate`email:${projectID}-compute@developer.gserviceaccount.com`,
    role: "roles/artifactregistry.reader",
  });
}
