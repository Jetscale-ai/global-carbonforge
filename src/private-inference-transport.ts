import { isIP } from "node:net";

export type PrivateInferenceTransport = {
  accepterVpcCidr: string;
  accepterVpcId: string;
  peeringConnectionId: string;
  requesterRegion: string;
  requesterVpcCidr: string;
  requesterVpcId: string;
  status: string;
};

function isPrivateIpv4Slash16(cidr: string): boolean {
  const [address, prefix, extra] = cidr.split("/");
  if (extra !== undefined || prefix !== "16" || isIP(address) !== 4) {
    return false;
  }

  const [first, second, third, fourth] = address
    .split(".")
    .map((octet) => Number(octet));
  const isPrivate =
    first === 10 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168);
  return isPrivate && third === 0 && fourth === 0;
}

export function validatePrivateInferenceTransport(
  transport: PrivateInferenceTransport,
  expectedAccepterVpcId: string,
  expectedRequesterRegion = "us-east-1",
): PrivateInferenceTransport {
  if (transport.status !== "active") {
    throw new Error(
      `Private inference transport must be active, received ${transport.status}.`,
    );
  }
  if (transport.accepterVpcId !== expectedAccepterVpcId) {
    throw new Error(
      `Private inference transport targets VPC ${transport.accepterVpcId}, not ${expectedAccepterVpcId}.`,
    );
  }
  if (transport.requesterRegion !== expectedRequesterRegion) {
    throw new Error(
      `Private inference transport originates in ${transport.requesterRegion}, not ${expectedRequesterRegion}.`,
    );
  }
  if (!transport.peeringConnectionId.startsWith("pcx-")) {
    throw new Error("Private inference transport has an invalid peering ID.");
  }
  if (!transport.requesterVpcId.startsWith("vpc-")) {
    throw new Error(
      "Private inference transport has an invalid requester VPC ID.",
    );
  }
  if (!isPrivateIpv4Slash16(transport.requesterVpcCidr)) {
    throw new Error(
      "Private inference requester CIDR must be a private RFC1918 /16 network.",
    );
  }

  return transport;
}
