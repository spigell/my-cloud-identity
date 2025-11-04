# Repository Guidelines

## Project Overview

This project manages cloud infrastructure as code (IaC) using Pulumi and TypeScript. It defines and configures resources across Google Cloud Platform (GCP), Cloudflare, and Kubernetes. The primary purpose is to automate the setup and management of projects, accounts, and services in a consistent and repeatable way.

The project is structured to handle multiple environments and services, including:

- **GCP:** Manages projects, billing accounts, and service accounts. It includes specific setups for "resume", "gemini", and general "infra" projects.
- **Cloudflare:** Manages DNS zones and API tokens.
- **Kubernetes (k8s):** Configures namespace access, service accounts, roles, and role bindings, with support for different clusters via kubeconfigs.

A `facade` component is used to export outputs from different Pulumi stacks, allowing for cross-stack dependencies.

## Building and Running

This is a Pulumi project written in TypeScript.

### Installation

Install dependencies using yarn:

```bash
yarn install
```

### Running

This project is intended to run via Pulumi only on human local machine, so the hardcoded path for kubeconfig is acceptable. AI agents should never try to run the project.

### Development

## Development Conventions

- **Language:** TypeScript
- **Package Manager:** yarn
- **IaC Framework:** Pulumi
- **Code Style:** Prettier is used for code formatting, enforced by a pre-commit hook managed by Husky. Refer to the "Scripts" section for formatting commands.
- **Modularity:** The code is organized by service (GCP, Cloudflare, k8s) in the `src` directory. Reusable components, like `Namespace` for Kubernetes, are encouraged.
- **Secrets Management:** Pulumi's built-in secrets management is used for sensitive data like API keys and credentials. The state is stored in a Google Cloud Storage (GCS) bucket.

### Scripts

- **Install Dependencies:**
  ```bash
  yarn install
  ```
- **Format Code:**
  ```bash
  npx prettier --write .
  ```
- **Build Project:**
  ```bash
  ./node_modules/.bin/tsc --build
  ```
- **Prepare (Husky hooks):**
  ```bash
  yarn prepare
  ```

AI agents should never try to commit the changes.
