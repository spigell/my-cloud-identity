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

## License

This project is licensed under the MIT License. You are free to use, modify, and distribute it in accordance with the terms of the license.

## Contributions

Contributions to this project are welcome! If you encounter any issues or have suggestions for improvements, please open an issue or submit a pull request.
