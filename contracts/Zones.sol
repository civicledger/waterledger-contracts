// SPDX-License-Identifier: MIT

pragma solidity 0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";

contract Zones is Ownable {
    struct Zone {
        bytes16 id;
        bytes32 name;
        uint256 supply;
        uint256 min;
        uint256 max;
    }

    Zone[] private zones;
    address private _orderbook;

    mapping(uint8 => mapping(bytes32 => uint256)) private balances;

    struct IndexPosition {
        uint256 index;
        bool isValid;
    }

    mapping(bytes16 => IndexPosition) private _idToIndex;

    constructor(address orderbook) Ownable() {
        _orderbook = orderbook;
    }

    function addZone(
        bytes32 name,
        uint256 supply,
        uint256 min,
        uint256 max
    ) public onlyOwner {
        bytes16 id = createId(block.timestamp, name);
        uint8 zoneIndex = uint8(zones.length);
        _idToIndex[id] = IndexPosition(zoneIndex, true);
        zones.push(Zone(id, name, supply, min, max));
        emit ZoneAdded(id, zoneIndex);
    }

    function allocate(
        uint8 zoneIndex,
        bytes32 waterAccountId,
        uint256 quantity
    ) public onlyOwner {
        balances[zoneIndex][waterAccountId] = quantity;
        emit Allocation(zoneIndex, waterAccountId, quantity);
        emit BalanceUpdated(waterAccountId, balances[zoneIndex][waterAccountId]);
    }

    function allocateAll(bytes32[] memory waterAccountIds, uint256[] memory quantities) public {
        for (uint8 i = 0; i < waterAccountIds.length; i++) {
            if(waterAccountIds[i] != "") {
                balances[i][waterAccountIds[i]] = quantities[i];
                emit Allocation(i, waterAccountIds[i], quantities[i]);
                emit BalanceUpdated(waterAccountIds[i], balances[i][waterAccountIds[i]]);
            }
        }
    }

    function createId(uint256 timestamp, bytes32 name) private pure returns (bytes16) {
        return bytes16(keccak256(abi.encode(timestamp, name)));
    }

    function getZones() public view returns (Zone[] memory) {
        return zones;
    }

    function debit(
        uint8 zoneIndex,
        bytes32 waterAccountId,
        uint256 quantity
    ) public onlyOrderBook {
        bool isValid = isFromTransferValid(zoneIndex, quantity);

        require(isValid, "Debit transfer not valid");
        require(balances[zoneIndex][waterAccountId] > quantity, "Balance not available");

        zones[zoneIndex].supply -= quantity;
        balances[zoneIndex][waterAccountId] -= quantity;
        emit Debit(waterAccountId, zones[zoneIndex].id, quantity);
        emit BalanceUpdated(waterAccountId, balances[zoneIndex][waterAccountId]);
    }

    function credit(
        uint8 zoneIndex,
        bytes32 waterAccountId,
        uint256 quantity
    ) public onlyOrderBook {
        bool isValid = isToTransferValid(zoneIndex, quantity);

        require(isValid, "Credit transfer not valid");

        zones[zoneIndex].supply += quantity;
        balances[zoneIndex][waterAccountId] += quantity;
        emit Credit(waterAccountId, zones[zoneIndex].id, quantity);
        emit BalanceUpdated(waterAccountId, balances[zoneIndex][waterAccountId]);
    }

    function restoreSupply(uint8 zoneIndex, uint256 quantity) public onlyOrderBook {
        zones[zoneIndex].supply += quantity;
    }

    function isToTransferValid(uint8 zoneIndex, uint256 value) public view returns (bool) {
        Zone memory zone = zones[zoneIndex];
        return (zone.supply + value) <= zone.max;
    }

    function isFromTransferValid(uint8 zoneIndex, uint256 value) public view returns (bool) {
        Zone memory zone = zones[zoneIndex];
        return (zone.supply - value) >= zone.min;
    }

    function getBalanceForZone(bytes32 waterAccountId, uint8 zoneIndex) public view returns (uint256) {
        return balances[zoneIndex][waterAccountId];
    }

    modifier onlyOrderBook() {
        if (msg.sender != owner()) {
            require(address(_orderbook) != address(0), "Orderbook must be set to make this transfer");
            require(_orderbook == msg.sender, "Only the orderbook can make this transfer");
        }
        _;
    }

    event Credit(bytes32 waterAccountId, bytes16 zoneId, uint256 quantity);
    event Debit(bytes32 waterAccountId, bytes16 zoneId, uint256 quantity);
    event BalanceUpdated(bytes32 waterAccountId, uint256 balance);
    event Allocation(uint8 zoneIndex, bytes32 waterAccountId, uint256 quantity);
    event ZoneAdded(bytes16 id, uint8 zoneIndex);
}
