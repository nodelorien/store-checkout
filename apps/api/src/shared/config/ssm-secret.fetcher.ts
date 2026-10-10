import { GetParametersCommand, SSMClient } from '@aws-sdk/client-ssm';
import { SecretFetcher } from './app-config';

/** Reads SecureString parameters (decrypted). Missing parameters are simply absent from the map. */
export function createSsmSecretFetcher(client: SSMClient): SecretFetcher {
  return async (parameterNames) => {
    const output = await client.send(
      new GetParametersCommand({ Names: parameterNames, WithDecryption: true }),
    );
    const values: Record<string, string> = {};
    for (const parameter of output.Parameters ?? []) {
      if (parameter.Name && parameter.Value) {
        values[parameter.Name] = parameter.Value;
      }
    }
    return values;
  };
}
