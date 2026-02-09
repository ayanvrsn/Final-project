# Crowdfund Rewards

Simple crowdfunding dApp where contributors receive ERC-20 reward tokens when a campaign succeeds.

## Tech Stack

- Solidity `0.8.20`
- Hardhat `2.x` + `@nomicfoundation/hardhat-toolbox`
- OpenZeppelin Contracts `5.x`
- Ethers.js `v6`
- Vanilla JavaScript + HTML + CSS frontend
- MetaMask for wallet interaction

## Project Structure

```text
.
├─ contracts/
│  ├─ Crowdfunding.sol
│  └─ RewardToken.sol
├─ scripts/
│  └─ deploy.js
├─ frontend/
│  ├─ abi.js
│  ├─ app.js
│  ├─ config.js
│  ├─ index.html
│  └─ style.css
├─ hardhat.config.js
├─ package.json
└─ README.md
```

## Architecture Overview

The app is split into three layers:

1. Smart contracts (`RewardToken` + `Crowdfunding`) on EVM.
2. Deployment layer (Hardhat script) that wires contract dependencies.
3. Frontend layer (vanilla JS + ethers) that connects MetaMask users and sends transactions.

### Contract Relationship

- `RewardToken` is an ERC-20 token with a dedicated `minter`.
- `Crowdfunding` holds campaign state and contribution balances.
- After deployment, `Crowdfunding` is set as the only minter in `RewardToken`.
- On successful campaigns, contributors can claim rewards through `Crowdfunding.finalize(...)`, which internally mints tokens.

## Design and Implementation Decisions

- Separate reward token from business logic:
  - Keeps token behavior standard and reusable.
  - Keeps crowdfunding state logic isolated.
- One-time minter assignment (`setMinter` can only be called once):
  - Reduces accidental privilege changes.
- Pull-based refunds:
  - Failed campaigns do not loop over all contributors.
  - Each user withdraws their own refund (`refund`), avoiding gas-heavy mass payouts.
- Finalize + claim in one endpoint:
  - `finalize(id)` finalizes campaign status and also allows eligible users to claim rewards.
  - Fewer write methods in frontend and cleaner user flow.
- Custom errors instead of revert strings:
  - Lower gas and clearer on-chain failure reasons.

## Smart Contract Logic

### `RewardToken.sol`

- Inherits `ERC20` and `Ownable`.
- Stores `minter` address.
- `setMinter(address)`:
  - only owner
  - zero address not allowed
  - can be set only once
- `mint(address,uint256)`:
  - callable only by `minter`

### `Crowdfunding.sol`

### Data model

- `Campaign` struct:
  - `creator`, `title`, `goalWei`, `deadline`, `raisedWei`, `finalized`, `successful`
- `campaigns[]`: all campaigns
- `contributions[id][user]`: per-user contribution tracking
- `rewardClaimed[id][user]`: prevents double claiming
- `REWARD_PER_ETH = 1000 * 1e18`

### Main flows

- `createCampaign(title, goalWei, deadlineTimestamp)`:
  - validates title, goal > 0, deadline > now + 60s
  - creates campaign
- `contribute(id)`:
  - campaign must exist and still be active
  - contribution must be > 0
  - stores contribution and updates `raisedWei`
- `finalize(id)`:
  - if not finalized and deadline passed: marks success/failure
  - if successful, forwards raised ETH to creator
  - if caller contributed to successful campaign, mints reward once
- `refund(id)`:
  - available only for finalized failed campaigns
  - user withdraws their own contributed ETH

### Reward formula

```text
reward = contributionETH * 1000 tokens
```

In code units:

```text
reward = (contribWei * REWARD_PER_ETH) / 1e18
```

## Frontend to Blockchain Interaction

`frontend/app.js` uses ethers v6 and MetaMask (`window.ethereum`):

- Connect flow:
  - `BrowserProvider` + signer are created after wallet connection.
  - Chain ID is validated against `APP.ALLOWED_CHAIN_IDS`.
- Contract instances:
  - write-enabled `Crowdfunding` contract with signer
  - read-only ERC-20 contract for balance/symbol/decimals
- Read operations:
  - fetch ETH balance, token balance
  - fetch campaign count + campaign details + user contribution
- Write operations:
  - `createCampaign(...)`
  - `contribute(id, { value })`
  - `finalize(id)` (also used for claiming rewards)
  - `refund(id)`
- UX details:
  - validates deadline format `dd/mm/yy hh:mm[:ss]`
  - shows pending/confirmed transaction status
  - disables actions when wallet/network/config is invalid

## Deployment and Execution Instructions

### Prerequisites

- Node.js 18+ (Node 24 also works in this repo)
- npm
- MetaMask extension

### Install dependencies

```bash
npm install
```

### Compile contracts

```bash
npm run compile
```

### Start local blockchain

```bash
npm run node
```

Keep this terminal running.

### Deploy contracts (new terminal)

```bash
npx hardhat run scripts/deploy.js --network localhost
```

Copy printed addresses into `frontend/config.js`:

- `APP.TOKEN_ADDRESS`
- `APP.CROWDFUND_ADDRESS`

### Configure MetaMask for local Hardhat chain

- Network Name: `Hardhat Local`
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`
- Currency Symbol: `ETH`

### Serve frontend

From project root:

```bash
python3 -m http.server 5500 --directory frontend
```

Open:

- `http://127.0.0.1:5500`

### Important current repo notes

- `frontend/index.html` currently has the app module import commented out.
  - Uncomment this line before running the UI:
  - `<script type="module" src="./app.js"></script>`
- `frontend/app.js` imports `EXPLORERS` from `frontend/config.js`.
  - Add and export an `EXPLORERS` object in `frontend/config.js` (or remove that import usage) to avoid runtime import errors.

## Process for Obtaining Test ETH

For this local setup, you do not need public faucets:

1. Run `npm run node`.
2. Hardhat prints pre-funded test accounts and private keys (each account starts with large test ETH balance).
3. Import one private key into MetaMask.
4. Connect MetaMask to local network (`31337`).
5. Use that account to create campaigns and contribute with local test ETH.

If you later deploy to a public testnet, you must use special Faucets for obtaining test ETH

```ETH Faucets
Phantom
Ethereum Sepolia Faucet
Drips 0.1 ETH every 24 hrs

Arbitrum Sepolia Faucet
Drips 0.1 ETH every 24 hrs

Optimism Sepolia Faucet
Drips 0.1 ETH every 24 hrs

Base Sepolia Faucet
Drips 0.1 ETH every 24 hrs

Starknet Sepolia Faucet
Drips 0.1 ETH every 24 hrs

ZKsync Sepolia Faucet
Drips 0.1 ETH every 24 hrs
```
[(c) from Alchemy](https://www.alchemy.com/faucets)
