// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @title Arka threshold escrow
/// @notice Holds Sepolia test ETH until a target is met or contributors can refund.
/// @dev One contract represents one Arka. There are no admin keys or upgrade hooks.
contract ArkaEscrow {
    error AlreadyCancelled();
    error AlreadyReleased();
    error DeadlineNotReached();
    error DepositExceedsRemaining();
    error EmptyCode();
    error EmptyName();
    error EscrowClosed();
    error InvalidDeadline();
    error InvalidHost();
    error InvalidTarget();
    error CodeTooLong();
    error NameTooLong();
    error NoContribution();
    error NotHost();
    error ReentrantCall();
    error TransferFailed();

    event Cancelled(uint256 cancelledAt);
    event Deposited(address indexed contributor, uint256 amount, uint256 totalDeposited);
    event Refunded(address indexed contributor, uint256 amount);
    event Released(address indexed host, uint256 amount, uint256 releasedAt);

    address payable public immutable host;
    uint64 public immutable deadline;
    uint256 public immutable targetAmount;
    string public arkaName;
    string public joinCode;

    uint256 public totalDeposited;
    uint256 public totalRefunded;
    uint64 public releasedAt;
    bool public cancelled;

    mapping(address contributor => uint256 amount) public contributions;

    uint256 private unlocked = 1;

    modifier onlyHost() {
        if (msg.sender != host) revert NotHost();
        _;
    }

    modifier nonReentrant() {
        if (unlocked != 1) revert ReentrantCall();
        unlocked = 2;
        _;
        unlocked = 1;
    }

    constructor(
        address payable host_,
        uint64 deadline_,
        uint256 targetAmount_,
        string memory arkaName_,
        string memory joinCode_
    ) {
        if (host_ == address(0)) revert InvalidHost();
        if (deadline_ <= block.timestamp) revert InvalidDeadline();
        if (targetAmount_ == 0) revert InvalidTarget();
        if (bytes(arkaName_).length == 0) revert EmptyName();
        if (bytes(joinCode_).length == 0) revert EmptyCode();
        if (bytes(arkaName_).length > 80) revert NameTooLong();
        if (bytes(joinCode_).length > 16) revert CodeTooLong();

        host = host_;
        deadline = deadline_;
        targetAmount = targetAmount_;
        arkaName = arkaName_;
        joinCode = joinCode_;
    }

    receive() external payable {
        deposit();
    }

    function deposit() public payable nonReentrant {
        if (cancelled || releasedAt != 0 || block.timestamp >= deadline) revert EscrowClosed();
        if (msg.value == 0 || msg.value > remainingAmount()) revert DepositExceedsRemaining();

        contributions[msg.sender] += msg.value;
        totalDeposited += msg.value;
        emit Deposited(msg.sender, msg.value, totalDeposited);

        if (totalDeposited == targetAmount) {
            releasedAt = uint64(block.timestamp);
            emit Released(host, targetAmount, block.timestamp);
            (bool success, ) = host.call{value: targetAmount}("");
            if (!success) revert TransferFailed();
        }
    }

    function cancel() external onlyHost {
        if (cancelled) revert AlreadyCancelled();
        if (releasedAt != 0) revert AlreadyReleased();
        cancelled = true;
        emit Cancelled(block.timestamp);
    }

    function refund() external nonReentrant {
        if (releasedAt != 0) revert AlreadyReleased();
        if (!cancelled && block.timestamp < deadline) revert DeadlineNotReached();

        uint256 amount = contributions[msg.sender];
        if (amount == 0) revert NoContribution();

        contributions[msg.sender] = 0;
        totalRefunded += amount;
        emit Refunded(msg.sender, amount);

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    function remainingAmount() public view returns (uint256) {
        return targetAmount - totalDeposited;
    }

    function refundableNow() external view returns (bool) {
        return releasedAt == 0 && (cancelled || block.timestamp >= deadline);
    }
}
