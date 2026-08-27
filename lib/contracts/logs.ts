const MAX_BLOCK_RANGE = 10_000n;

export async function getContractEventsChunked(client: any, params: any) {
  const latestBlock = await client.getBlockNumber();
  const allLogs: any[] = [];
  let fromBlock = params.fromBlock ?? 0n;
  const toBlock = params.toBlock ?? latestBlock;

  while (fromBlock <= toBlock) {
    const chunkToBlock = fromBlock + MAX_BLOCK_RANGE - 1n < toBlock
      ? fromBlock + MAX_BLOCK_RANGE - 1n
      : toBlock;

    const logs = await client.getContractEvents({
      ...params,
      fromBlock,
      toBlock: chunkToBlock,
    });
    allLogs.push(...logs);

    fromBlock = chunkToBlock + 1n;
  }

  return allLogs;
}
