// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockNFT {
    string public name = "Mock NFT";
    string public symbol = "mNFT";
    uint256 public nextId;
    mapping(uint256 => address) public ownerOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    function mint(address to) external returns (uint256 id) {
        id = nextId++;
        ownerOf[id] = to;
    }
    function approve(address to, uint256 id) external {
        getApproved[id] = to;
    }
    function setApprovalForAll(address op, bool ok) external {
        isApprovedForAll[msg.sender][op] = ok;
    }
    function safeTransferFrom(address from, address to, uint256 id) public {
        require(ownerOf[id] == from, "not owner");
        require(msg.sender == from || getApproved[id] == msg.sender || isApprovedForAll[from][msg.sender], "not allowed");
        ownerOf[id] = to;
        getApproved[id] = address(0);
    }
    function transferFrom(address from, address to, uint256 id) external {
        safeTransferFrom(from, to, id);
    }
}
