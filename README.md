# cross-chain-resolver-example

## Installation

Install example deps

```shell
pnpm install
```

Install [foundry](https://book.getfoundry.sh/getting-started/installation)

```shell
curl -L https://foundry.paradigm.xyz | bash
```

Install contract deps

```shell
forge install
```

## Running

To run tests you need to provide fork urls for Ethereum and Bsc

```shell
SRC_CHAIN_RPC=ETH_FORK_URL DST_CHAIN_RPC=BNB_FORK_URL pnpm test
```

### Public rpc

| Chain    | Url                          |
|----------|------------------------------|
| Ethereum | https://eth.merkle.io        |
| BSC      | wss://bsc-rpc.publicnode.com |

## Test accounts

### Available Accounts

```
(1) 0x38c4aadf07a344bd5f5baedc7b43f11a9b863cdd16242f3b94a53541ad19fedc: "0x39619C9fe2AF793f847D112123F62c01df0A0025" User
(2) 0x1d02f466767e86d82b6c647fc7be69dc1bc98931a99ac9666d8b591bb0cc1e66: "0x4207ebd97F999F142fFD3696dD76A61193b23e89" Resolver
```

###  sui cmd
 'export PATH="/root/.local/bin:$PATH"' >> ~/.bashrc
 source ~/.bashrc

