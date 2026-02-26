import { generateKeyPairSync } from "node:crypto";
import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { bytesToHex, managedNonce, utf8ToBytes } from "@noble/ciphers/utils.js";
import { createHash } from "@better-auth/utils/hash";

const secret = process.env.INSTANCE_SECRET || process.env.BETTER_AUTH_SECRET;
if (!secret) {
  console.error("Error: Set INSTANCE_SECRET or BETTER_AUTH_SECRET environment variable.");
  console.error("Usage: INSTANCE_SECRET=<your-secret> node generateKeys.mjs");
  process.exit(1);
}

async function encryptPrivateKey(data, key) {
  const keyAsBytes = await createHash("SHA-256").digest(key);
  const dataAsBytes = utf8ToBytes(data);
  return bytesToHex(
    managedNonce(xchacha20poly1305)(new Uint8Array(keyAsBytes)).encrypt(dataAsBytes),
  );
}

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
});

const privateJwk = { use: "sig", alg: "RS256", kid: "static-0", ...privateKey.export({ format: "jwk" }) };
const publicJwk = { use: "sig", alg: "RS256", kid: "static-0", ...publicKey.export({ format: "jwk" }) };

const encryptedPrivateKey = await encryptPrivateKey(JSON.stringify(privateJwk), secret);

const jwksDocArray = JSON.stringify([{
  id: "static-0",
  publicKey: JSON.stringify(publicJwk),
  privateKey: JSON.stringify(encryptedPrivateKey),
  createdAt: Date.now(),
  alg: "RS256",
}]);

process.stdout.write(`JWKS=${jwksDocArray}`);
process.stdout.write("\n");
