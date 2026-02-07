// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./RewardToken.sol";

contract Crowdfunding {
    struct Campaign {
        address creator;
        string title;
        uint256 goalWei;
        uint256 deadline;
        uint256 raisedWei;
        bool successful;
    }

    RewardToken public immutable rewardToken;

    uint256 public constant REWARD_PER_ETH = 1000 * 1e18;

    Campaign[] private campaigns;
    mapping(uint256 => mapping(address => uint256)) private contributions;
    mapping(uint256 => mapping(address => bool)) private rewardClaimed;

    event CampaignCreated(uint256 indexed id, address indexed creator, string title, uint256 goalWei, uint256 deadline);
    event Contributed(uint256 indexed id, address indexed contributor, uint256 amountWei, uint256 rewardMinted);
    event Finalized(uint256 indexed id, bool successful);
    event Refunded(uint256 indexed id, address indexed contributor, uint256 amountWei);
    event RewardClaimed(uint256 indexed id, address indexed contributor, uint256 rewardAmount);

    error InvalidId();
    error EmptyTitle();
    error InvalidGoal();
    error InvalidDeadline();
    error DeadlinePassed();
    error NotActive();
    error NotFinalized();
    error AlreadyFinalized();
    error NoContribution();
    error TransferFailed();
    error RewardAlreadyClaimed();

    constructor(address rewardTokenAddress) {
        rewardToken = RewardToken(rewardTokenAddress);
    }

    function campaignCount() external view returns (uint256) {
        return campaigns.length;
    }

    function getCampaign(uint256 id) external view returns (Campaign memory) {
        if (id >= campaigns.length) revert InvalidId();
        return campaigns[id];
    }

    function createCampaign(string calldata title, uint256 goalWei, uint256 deadlineTimestamp) external returns (uint256 id) {
        if (bytes(title).length == 0) revert EmptyTitle();
        if (goalWei == 0) revert InvalidGoal();
        if (deadlineTimestamp <= block.timestamp + 60) revert InvalidDeadline(); // минимум 1 минута

        campaigns.push(
            Campaign({
                creator: msg.sender,
                title: title,
                goalWei: goalWei,
                deadline: deadlineTimestamp,
                raisedWei: 0,
                successful: false
            })
        );

        id = campaigns.length - 1;
        emit CampaignCreated(id, msg.sender, title, goalWei, deadlineTimestamp);
    }

    function contribute(uint256 id) external payable {
        if (id >= campaigns.length) revert InvalidId();
        Campaign storage c = campaigns[id];
        if (block.timestamp >= c.deadline) revert DeadlinePassed();
        if (msg.value == 0) revert NoContribution();

        contributions[id][msg.sender] += msg.value;
        c.raisedWei += msg.value;

        emit Contributed(id, msg.sender, msg.value, 0);
    }
}
