import * as pulumi from '@pulumi/pulumi';

type NamespacedOutputs = Record<string, unknown>;
type OutputsToReexport = Record<string, NamespacedOutputs>;

const sourceStack = 'organization/my-cloud-identity/main';
const stackRef = new pulumi.StackReference(sourceStack);
const currentStack = pulumi.getStack();

const outputsToReexport = stackRef.requireOutput(
  'outputsToReexport'
) as pulumi.Output<OutputsToReexport>;

outputsToReexport.apply((namespaces) => {
  const namespacedOutputs = namespaces?.[currentStack];

  if (!namespaces || !namespacedOutputs) {
    throw new pulumi.RunError(
      `No outputsToReexport entry found for stack "${currentStack}".`
    );
  }

  const exportOutput = (
    pulumi.runtime as unknown as {
      export(name: string, value: pulumi.Input<unknown>): void;
    }
  ).export;

  Object.entries(namespacedOutputs).forEach(([outputName, value]) => {
    exportOutput(outputName, value as pulumi.Input<unknown>);
  });
});
