import * as pulumi from '@pulumi/pulumi';

export type KubeconfigPaths = {
  homelab: pulumi.Output<string>;
};
