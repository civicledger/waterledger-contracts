pragma solidity ^0.4.24;

import "./ERC20.sol";
import "./Ownable.sol";
import "./SafeMath.sol";

contract AUD is ERC20, Ownable  {
    using SafeMath for uint;

    string public _name = "Water Ledger AUD";
    string public _symbol = "AUD";
    uint256 public _decimals = 2; //cents

    address public _orderBook;

    constructor(uint256 supply) public {
        _totalSupply = supply;
        _balances[msg.sender] = supply;
    }

    function mint(uint256 value) public onlyOwner returns(bool) {
        return mintTo(value, owner());
    }

    function mintTo(uint256 value, address to) public onlyOwner returns(bool) {
        require(value > 0, "Amount must be greater than zero");

        _balances[to] = _balances[to].add(value);
        _totalSupply = _totalSupply.add(value);

        emit Minted(value);
        emit MintedTo(to, value);

        return true;
    }

    function burn(uint256 value) public onlyOwner returns (bool) {
        require(value > 0, "Amount must be greater than zero");
        require(_totalSupply >= value, "Cannot burn more than you have");
        require(_balances[owner()] >= value, "Cannot burn more than owner's balance");

        _balances[owner()] = _balances[owner()].sub(value);
        _totalSupply = _totalSupply.sub(value);

        emit Burned(value);

        return true;
    }

    function setOrderBook(address orderBook) public onlyOwner {
        _orderBook = orderBook;
    }

    function orderBookCredit(address to, uint256 value) external onlyOrderBook() returns (bool) {
        _balances[owner()] = _balances[owner()].sub(value);
        _balances[to] = _balances[to].add(value);

        emit Transfer(owner(), to, value);
        return true;
    }

    function orderBookDebit(address from, uint256 value) external onlyOrderBook() returns (bool) {
        _balances[from] = _balances[from].sub(value);
        _balances[owner()] = _balances[owner()].add(value);

        emit Transfer(from, owner(), value);
        return true;
    }

    modifier onlyOrderBook() {
        require(address(_orderBook) != address(0), "Orderbook must be set to make this transfer");
        require(_orderBook == msg.sender, "Only the orderbook can make this transfer");
        _;
    }

    event Minted(uint256 value);
    event MintedTo(address indexed to, uint256 value);
    event Burned(uint256 value);

    event Transfer(
        address indexed from,
        address indexed to,
        uint256 value
    );

    event Approval(
        address indexed owner,
        address indexed spender,
        uint256 value
    );
}