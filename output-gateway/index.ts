import * as pulumi from '@pulumi/pulumi';

type NamespacedOutputs = Record<string, pulumi.Input<unknown>>;
type OutputsToReexport = Record<string, NamespacedOutputs>;

const sourceStack = 'organization/my-cloud-identity/main';
const stackRef = new pulumi.StackReference(sourceStack);
const currentStack = pulumi.getStack();

const outputsToReexport = stackRef.getOutput(
  'outputsToReexport'
) as pulumi.Output<OutputsToReexport>;

export const outputs = outputsToReexport.apply(
  (namespaces: OutputsToReexport | undefined) => {
    if (!namespaces) {
      throw new pulumi.RunError('No outputsToReexport definition found.');
    }

    const namespacedOutputs = namespaces[currentStack];

    if (!namespacedOutputs) {
      throw new pulumi.RunError(
        `No outputsToReexport entry found for stack "${currentStack}".`
      );
    }

    return namespacedOutputs;
  }
);
