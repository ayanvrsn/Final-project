export const CROWDFUND_ABI = [
  "function campaignCount() view returns (uint256)",
  "function getCampaign(uint256) view returns (tuple(address creator,string title,uint256 goalWei,uint256 deadline,uint256 raisedWei,bool finalized,bool successful))",
  "function getContribution(uint256,address) view returns (uint256)",
  "function createCampaign(string title,uint256 goalWei,uint256 deadlineTimestamp) returns (uint256)",
  "function contribute(uint256 id) payable",
  "function finalize(uint256 id)",
];

export const ERC20_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)"
];
