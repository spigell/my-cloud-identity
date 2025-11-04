import { Config, StackReference, runtime } from '@pulumi/pulumi';

type TargetConfig = {
  stack: string;
  outputs?: string[];
};

type TargetsConfig = Record<string, TargetConfig>;

const config = new Config();
const targets = config.getObject<TargetsConfig>('targets') ?? {};

Object.entries(targets).forEach(([namespace, target]) => {
  const stackRef = new StackReference(target.stack);
  const outputs = target.outputs ?? [];

  if (outputs.length > 0) {
    outputs.forEach((outputName) => {
      const exportName = `${namespace}:${outputName}`;
      runtime.export(exportName, stackRef.getOutput(outputName));
    });
    return;
  }

  stackRef.outputs.apply((allOutputs) => {
    if (!allOutputs) {
      return;
    }

    Object.entries(allOutputs).forEach(([outputName, value]) => {
      const exportName = `${namespace}:${outputName}`;
      runtime.export(exportName, value);
    });
  });
});
