import * as gcp from "@pulumi/gcp";
import * as resume from "./resume-project";
import * as state from "./state-project";
import * as infra from "./infra-project";

// Default name for my billing account
const billingAccount = gcp.organizations.getBillingAccount({
  displayName: "My Billing Account",
});
const billingAccountId = billingAccount.then((a) => a.id);

export const infraProject = new infra.Project(
  billingAccountId
).WithGKEServiceAccounts(["spigell-resume-dev", "spigell-resume-production", "hetzner-pulumi-runner"]);

export const resumeProduction = resume.ResumeProject(
  billingAccountId,
  "spigell-resume-production"
);

export const resumeDev = resume.ResumeProject(
  billingAccountId,
  "spigell-resume-dev"
);

// Add permissions pulling images from all resumes project registries
// It doesn't work. Need to debug!
// resume.AddRegistryPermissions(resumeProduction.projectID, 'spigel-resume-dev');
// resume.AddRegistryPermissions(resumeDev.projectID, 'spigel-resume-production');

state.DeployStateProject(billingAccountId, [
  resumeProduction.runnerEmail,
  resumeDev.runnerEmail,
]);
