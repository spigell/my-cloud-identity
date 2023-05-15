import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";

// Create storage bucket as storage for pulumi states
const name = "pulumi-states";

export function DeployStateProject(
  billingAccount: Promise<string>,
  members: pulumi.Output<string>[]
) {
  const project = new gcp.organizations.Project(name, {
    name: name,
    projectId: name,
    billingAccount: billingAccount,
  });

  const bucket = new gcp.storage.Bucket("pulumi-state", {
    name: "spigell-pulumi-states",
    project: project.name,
    location: "us-central1",
    storageClass: "REGIONAL",
    publicAccessPrevention: "enforced",
    versioning: {
      enabled: true,
    },
  });
  members.forEach((member, idx) => {
    new gcp.storage.BucketIAMMember(
      `pulumi-state-member-${idx}`,
      {
        member: member.apply((m) => `serviceAccount:${m}`),
        role: `roles/storage.objectAdmin`,
        bucket: bucket.name,
      },
      { deleteBeforeReplace: true }
    );
  });
}
