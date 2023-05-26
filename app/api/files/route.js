import { ListObjectsCommand } from '@aws-sdk/client-s3';
import { JsonRpcProvider, Interface, Contract, verifyMessage } from 'ethers';
import { NextResponse } from 'next/server';

import { s3Client } from '../../config';

const bucketParams = { Bucket: 'raidguild' };

export async function POST(req) {
  let request = await req.json();

  const address = verifyMessage(
    'gm raidguild member',
    request.signature.toString()
  );

  const abi = new Interface([
    'function members(address account) view returns (address, uint256, uint256, bool, uint256, uint256)'
  ]);
  const contract = new Contract(
    '0xfe1084bc16427e5eb7f13fc19bcd4e641f7d571f',
    abi,
    new JsonRpcProvider('https://rpc.ankr.com/gnosis')
  );

  const member = await contract.members(address);

  if (member[3]) {
    const data = await s3Client.send(new ListObjectsCommand(bucketParams));
    return NextResponse.json({ response: data.Contents });
  }
}
