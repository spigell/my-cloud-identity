import * as gcp from '@pulumi/gcp';
import * as resume from './resume-project.js';
import * as gemini from './gemini-project.js';
import * as infra from './infra-project.js';
import * as pulumi from '@pulumi/pulumi';

// Default name for my billing account
const billingAccount = gcp.organizations.getBillingAccount({
  displayName: 'Main',
});
const billingAccountId = billingAccount.then((a) => a.id);

export const HHResponderGeminiProject = new gemini.FreeTierProject(
  'hh-responder-gemini'
);

export const infraProject = new infra.Project(
  billingAccountId
).WithGKEServiceAccounts(['spigell-resume-dev', 'spigell-resume-production']);

export const resumeProduction = resume.ResumeProject(
  billingAccountId,
  'spigell-resume-production'
);

export const resumeDev = resume.ResumeProject(
  billingAccountId,
  'spigell-resume-dev'
);

// Add permissions pulling images from all resumes project registries
// It doesn't work. Need to debug!
// resume.AddRegistryPermissions(resumeProduction.projectID, 'spigel-resume-dev');
// resume.AddRegistryPermissions(resumeDev.projectID, 'spigel-resume-production');

pulumi
  .all([resumeProduction.runnerEmail, resumeDev.runnerEmail])
  .apply((args: string[]) => {
    args.forEach((v: string) => {
      infraProject.allowWriteToStateBucket(v);
    });
  });

//state.DeployStateProject(billingAccountId, [
//  resumeProduction.runnerEmail,
//  resumeDev.runnerEmail,
//]);
