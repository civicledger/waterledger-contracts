pragma solidity >=0.4.25 <0.7.0;
pragma experimental ABIEncoderV2;

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

    mapping(uint256 => mapping(address => uint256)) private balances;

    struct IndexPosition {
        uint256 index;
        bool isValid;
    }

    mapping(bytes16 => IndexPosition) private _idToIndex;

    constructor(address orderbook) public Ownable() {
        _orderbook = orderbook;
    }

    function addZone(
        bytes32 name,
        uint256 supply,
        uint256 min,
        uint256 max
    ) public onlyOwner {
        bytes16 id = createId(block.timestamp, name);
        uint256 zoneIndex = zones.length;
        _idToIndex[id] = IndexPosition(zoneIndex, true);
        zones.push(Zone(id, name, supply, min, max));
        emit ZoneAdded(id, zoneIndex);
    }

    function allocate(
        uint256 zoneIndex,
        address to,
        uint256 quantity
    ) public onlyOwner {
        balances[zoneIndex][to] = quantity;
        emit Allocation(zoneIndex, to, quantity);
    }

    function createId(uint256 timestamp, bytes32 name) private pure returns (bytes16) {
        return bytes16(keccak256(abi.encode(timestamp, name)));
    }

    function getZones() public view returns (Zone[] memory) {
        return zones;
    }

    function debit(
        uint256 zoneIndex,
        address from,
        uint256 quantity
    ) public onlyOrderBook {
        bool isValid = isFromTransferValid(zoneIndex, quantity);

        require(isValid, "Debit transfer not valid");
        require(balances[zoneIndex][from] > quantity, "Balance not available");

        zones[zoneIndex].supply -= quantity;
        balances[zoneIndex][from] -= quantity;
        emit Debit(from, zones[zoneIndex].id, quantity);
    }

    function credit(
        uint256 zoneIndex,
        address to,
        uint256 quantity
    ) public onlyOrderBook {
        bool isValid = isToTransferValid(zoneIndex, quantity);

        require(isValid, "Credit transfer not valid");

        zones[zoneIndex].supply += quantity;
        balances[zoneIndex][to] += quantity;
        emit Credit(to, zones[zoneIndex].id, quantity);
    }

    function restoreSupply(uint8 zoneIndex, uint256 quantity) public onlyOrderBook {
        zones[zoneIndex].supply += quantity;
    }

    function isToTransferValid(uint256 zoneIndex, uint256 value) public view returns (bool) {
        Zone memory zone = zones[zoneIndex];
        return (zone.supply + value) <= zone.max;
    }

    function isFromTransferValid(uint256 zoneIndex, uint256 value) public view returns (bool) {
        Zone memory zone = zones[zoneIndex];
        return (zone.supply - value) >= zone.min;
    }

    function getBalances(address licence) public view returns (uint256[] memory) {
        uint256 numberOfZones = zones.length;
        uint256[] memory zoneBalances = new uint256[](numberOfZones);
        for (uint256 i = 0; i < zones.length; i++) {
            zoneBalances[i] = balances[i][licence];
        }
        return zoneBalances;
    }

    function getBalanceForZone(address licence, uint8 zoneIndex) public view returns (uint256) {
        return balances[zoneIndex][licence];
    }

    modifier onlyOrderBook() {
        if (msg.sender != owner()) {
            require(address(_orderbook) != address(0), "Orderbook must be set to make this transfer");
            require(_orderbook == msg.sender, "Only the orderbook can make this transfer");
        }
        _;
    }

    event Credit(address to, bytes16 zoneId, uint256 quantity);
    event Debit(address from, bytes16 zoneId, uint256 quantity);
    event Allocation(uint256 zoneIndex, address to, uint256 quantity);
    event Transfer(uint256 fromZoneIndex, uint256 toZoneIndex, address from, address to, uint256 value);
    event ZoneAdded(bytes16 id, uint256 zoneIndex);
}
