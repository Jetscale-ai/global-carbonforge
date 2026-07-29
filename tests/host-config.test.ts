import assert from "node:assert/strict";
import test from "node:test";

import { validateHostConfig, type HostConfig } from "../src/host-config";

const validConfig: HostConfig = {
  instanceType: "p5.4xlarge",
  gpuCount: 1,
  rootVolumeSizeGiB: 150,
  baseAmiFamily: "Deep Learning Base OSS Nvidia Driver GPU AMI (Ubuntu 22.04)",
  publicIpv4Enabled: false,
  sshIngressEnabled: false,
};

test("accepts the private single-H100 host baseline", () => {
  assert.deepEqual(validateHostConfig(validConfig), validConfig);
});

test("rejects a different instance shape", () => {
  assert.throws(
    () => validateHostConfig({ ...validConfig, instanceType: "p5.48xlarge" }),
    /instanceType must be p5\.4xlarge/,
  );
});

test("rejects undersized root storage", () => {
  assert.throws(
    () => validateHostConfig({ ...validConfig, rootVolumeSizeGiB: 149 }),
    /rootVolumeSizeGiB/,
  );
});

test("rejects public IPv4", () => {
  assert.throws(
    () => validateHostConfig({ ...validConfig, publicIpv4Enabled: true }),
    /publicIpv4Enabled must remain false/,
  );
});

test("rejects SSH ingress", () => {
  assert.throws(
    () => validateHostConfig({ ...validConfig, sshIngressEnabled: true }),
    /sshIngressEnabled must remain false/,
  );
});
