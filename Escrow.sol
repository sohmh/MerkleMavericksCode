// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Escrow {
    address public buyer;
    address public seller;
    address public arbiter;

    enum State { AWAITING_PAYMENT, AWAITING_DELIVERY, COMPLETE, REFUNDED }
    State public currentState;

    constructor(address _seller, address _arbiter) {
        buyer = msg.sender;
        seller = _seller;
        arbiter = _arbiter;
        currentState = State.AWAITING_PAYMENT;
    }

    modifier onlyBuyer() {
        require(msg.sender == buyer, "Only buyer allowed");
        _;
    }

    modifier onlyArbiter() {
        require(msg.sender == arbiter, "Only arbiter allowed");
        _;
    }

    function deposit() external payable onlyBuyer {
        require(currentState == State.AWAITING_PAYMENT, "Already paid");
        require(msg.value > 0, "Send ETH");

        currentState = State.AWAITING_DELIVERY;
    }

    function confirmDelivery() external onlyBuyer {
        require(currentState == State.AWAITING_DELIVERY, "Not ready");

        payable(seller).transfer(address(this).balance);
        currentState = State.COMPLETE;
    }

    function refund() external onlyArbiter {
        require(currentState == State.AWAITING_DELIVERY, "Cannot refund");

        payable(buyer).transfer(address(this).balance);
        currentState = State.REFUNDED;
    }
}