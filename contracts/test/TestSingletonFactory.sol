// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ArkaEscrow} from "../ArkaEscrow.sol";

/// @dev Test-only implementation of the EIP-2470 deploy(bytes,bytes32) interface.
contract TestSingletonFactory {
    error DeploymentFailed();

    function deploy(bytes memory initCode, bytes32 salt) external returns (address createdContract) {
        assembly {
            createdContract := create2(0, add(initCode, 0x20), mload(initCode), salt)
        }
        if (createdContract == address(0)) revert DeploymentFailed();
    }

    function buildArkaInitCode(
        address payable host,
        uint64 deadline,
        uint256 targetAmount,
        string memory arkaName,
        string memory joinCode
    ) external pure returns (bytes memory) {
        return abi.encodePacked(
            type(ArkaEscrow).creationCode,
            abi.encode(host, deadline, targetAmount, arkaName, joinCode)
        );
    }
}
