pragma solidity ^0.6.2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract Zone is ERC20, Ownable {
    using SafeMath for uint256;

    string public _name = "";
    string public _symbol = "CLW";
    uint8 public _decimals = 12;

    uint256 public _min = 0;
    uint256 public _max = 0;

    address private _orderBook;

    constructor(
        uint256 supply,
        string memory name,
        address orderBook,
        uint256 min,
        uint256 max
    ) public ERC20(name, "CLW") {
        _mint(owner(), supply);
        _name = name;
        _orderBook = orderBook;
        _min = min;
        _max = max;
    }

    function isToTransferValid(uint256 value) public view returns (bool) {
        return totalSupply().add(value) <= _max;
    }

    function isFromTransferValid(uint256 value) public view returns (bool) {
        return totalSupply().sub(value) >= _min;
    }

    function getTransferLimits() external view returns (uint256, uint256) {
        return (_min, _max);
    }

    function allocate(address to, uint256 value) external onlyOwner() {
        _mint(to, value);
        emit Allocation(to, value);
    }

    // WIP: assumed that credit ammounts during deletion of sellLimitOrder do not need to be validated (as it is within initially allocated limit). May need some other checking around this. Should this be a separate function or contained within orderBookCredit()? More thinking required on this
    function orderBookReCredit(address to, uint256 value) external onlyOrderBook() returns (bool) {
        _mint(to, value);
        emit Transfer(owner(), to, value);
        return true;
    }

    function orderBookCredit(address to, uint256 value) external onlyOrderBook() returns (bool) {
        if (isToTransferValid(value)) {
            _mint(to, value);
            emit Transfer(owner(), to, value);
            return true;
        }
        return false;
    }

    function orderBookDebit(address from, uint256 value) external onlyOrderBook() returns (bool) {
        if (isFromTransferValid(value)) {
            _burn(from, value);
            emit Transfer(from, owner(), value);
            return true;
        }
        return false;
    }

    modifier onlyOrderBook() {
        require(address(_orderBook) != address(0), "Orderbook must be set to make this transfer");
        require(_orderBook == msg.sender, "Only the orderbook can make this transfer");
        _;
    }

    event Allocation(address indexed to, uint256 value);
    event Approval(address indexed to, address indexed spender, uint256 value);
    event Transfer(address indexed from, address indexed to, uint256 value);
}
