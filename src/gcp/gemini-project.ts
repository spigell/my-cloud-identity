import * as pulumi from '@pulumi/pulumi';
import * as gcp from '@pulumi/gcp';

const apis = ['generativelanguage.googleapis.com'];

// Project creates a project for personal long-term infrastructure
export class FreeTierProject {
  constructor(name: string) {
    const project = new gcp.organizations.Project(name, {
      name: name,
      projectId: name,
    });

    const enabledApis: pulumi.Resource[] = [];
    apis.forEach((api) => {
      let enabled = new gcp.projects.Service(`${name}-${api}`, {
        service: api,
        project: project.name,
      });
      enabledApis.push(enabled);
    });
  }
}
