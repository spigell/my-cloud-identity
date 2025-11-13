# My Cloud Identity

This repository contains infrastructure-as-code (IaC) for managing my projects in Google Cloud Platform (GCP), cloudflare tokens, Hetzner, etc.

## Project Overview

The goal of this project is to provide an example for automated and scalable solution for managing my project in cloud services.

### Project Structure

The repository is organized as follows:

- src - contains the source code for the project
  - gcp - contains the source code for the GCP;
  - cloudflare - contains the source code for the cloudflare CDN;
  - more...

### Deploy

All made via Pulumi but deployed manually. Secret backend is [passphrase](https://www.pulumi.com/docs/intro/concepts/secrets/), state storage - GCS.

```bash
export PULUMI_CONFIG_PASSPHRASE=xxxx
export CLOUDFLARE_API_KEY=xxxx
pulumi up
```

### Kubernetes Flow

The Kubernetes (k8s) management within this project is structured around reusable components and specific service configurations.

#### Kubernetes Management Component (`src/k8s/namespace.ts`)

Reusable Kubernetes bootstrap logic lives in the `Namespace` component. It provisions a namespace, service account, role, and binding; callers now hand in a pre-built Kubernetes provider. This component is designed for modularity, allowing different services to define their Kubernetes access with custom configurations.

#### Reforge AI Namespace (`src/k8s/my-reforge-ai.ts`)

The `ReforgeAiNamespace` component specifically sets up the Kubernetes environment for the "my-reforge-ai" service.

- It utilizes a hardcoded kubeconfig path: `/home/spigell/.kube/static-kubeconfigs/homelab-ext.config`.
- It defines a set of RBAC rules that grant broad permissions (`*` on `apiGroups: ['', 'apps', 'batch']`, `resources: ['*']`, `verbs: ['*']`) to the service account within its namespace.
- It instantiates the generic `Namespace` component with these specific configurations, creating a dedicated namespace, service account, role, and role binding for "my-reforge-ai".

## License

This project is licensed under the MIT License. You are free to use, modify, and distribute it in accordance with the terms of the license.

## Contributions

Contributions to this project are welcome! If you encounter any issues or have suggestions for improvements, please open an issue or submit a pull request.
