import * as cloudflare from '@pulumi/cloudflare';
import * as pulumi from '@pulumi/pulumi';
import { Zone } from './index.js';

const permissionGroups = cloudflare.getApiTokenPermissionGroups({});

type token = {
  zoneName: string;
  tokens: Map<string, pulumi.Input<pulumi.Input<string>[]>>;
};

const myTokens: token[] = [
  {
    zoneName: 'sergeichukh.cloud',
    tokens: new Map([
      [
        'sergeichukhCloudMainToken',
        [
          permissionGroups.then((all) => all.permissions['DNS Read']),
          permissionGroups.then((all) => all.permissions['DNS Write']),
          permissionGroups.then((all) => all.permissions['Page Rules Read']),
          permissionGroups.then((all) => all.permissions['Page Rules Write']),
        ],
      ],
    ]),
  },
  {
    zoneName: 'sergeichukh.cloud',
    tokens: new Map([
      [
        'sergeiChukhCloudPurgeCacheToken',
        [permissionGroups.then((all) => all.permissions['Cache Purge'])],
      ],
    ]),
  },
];

export type createdToken = {
  value: pulumi.Output<string>;
  name: string;
};

// Configure my tokens
export class Tokens {
  tokens: createdToken[] = [];

  constructor(zones: Zone[]) {
    zones.forEach((zone) => {
      myTokens.forEach((token) => {
        if (token.zoneName == zone.name) {
          token.tokens.forEach((value, key) => {
            const name = key;

            const token = new cloudflare.ApiToken(name, {
              name: name,
              policies: [
                {
                  effect: 'allow',
                  resources: {
                    [`com.cloudflare.api.account.zone.${zone.id}`]: '*',
                  },
                  permissionGroups: value,
                },
              ],
            });
            this.tokens.push({ name: name, value: token.value });
          });
        }
      });
    });
  }
}
