const { ethers, waffle, network } = require("hardhat");

var chai = require("chai");
var chaiAsPromised = require("chai-as-promised");

chai.use(chaiAsPromised);
var expect = chai.expect;

describe("Lottery", function () {
  const oneEther = ethers.utils.parseEther("1.0");
  const fiveHundredEther = ethers.utils.parseEther("500.0");
  const provider = waffle.provider;

  describe("test constructor", function () {
    it("Correct usage", async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      await Lottery.deploy(1, 0);
    })
  });

  describe("test deposite", function () {
    let lottery;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
    });
    it("Successfully deposite", async function () {
      await lottery.deposite({
        value: oneEther
      });
      const addressBalance = await provider.getBalance(lottery.address);
      expect(addressBalance.eq(ethers.BigNumber.from("1000000000000000000"))).to.be.true;
    });
    it("Caller should be owner", async function () {
      const [owner, addr1] = await ethers.getSigners();
      tx = lottery.connect(addr1).deposite({
        value: oneEther
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'");
    });
  });

  describe("test withdraw", function () {
    let lottery;
    let owner;
    let addr1;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
      [owner, addr1] = await ethers.getSigners();
    });
    it("State should be 'Finished(2)'", async function () {
      expect(await lottery.getState()).to.equal(0);
      const tx = lottery.withdraw();
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });
    it("Successfully withdraw", async function () {
      await lottery.deposite({
        value: oneEther
      });
      // set state to 'Finished'.
      lottery.drawNumber();

      let ownerBalanceBefore = await provider.getBalance(owner.address);
      await lottery.withdraw();
      let ownerBalanceAfter = await provider.getBalance(owner.address);
      expect(ownerBalanceAfter.gt(ownerBalanceBefore)).to.be.true;
    });
    it("Caller should be owner", async function () {
      // set state to 'Finished'.
      lottery.drawNumber();
      tx = lottery.connect(addr1).withdraw();
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'");
    });
  });

  describe("test scheduleNextDraw", function () {
    let lottery;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
      // This change the contract state to 'Finished'.
      await lottery.drawNumber();
    });

    it("State should be 'Finished(2)' and changed to 'Opened(0)'", async function () {
      let tx;
      expect(await lottery.getState()).to.equal(2);
      tx = lottery.scheduleNextDraw(1, 0);
      await tx;
      // State will change to 'Opened(0)'.
      expect(await lottery.getState()).to.equal(0);
      tx = lottery.scheduleNextDraw(1, 0);
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });

    it("Caller should be owner", async function () {
      let tx
      let owner;
      let addr1;
      [owner, addr1] = await ethers.getSigners();
      tx = lottery.connect(addr1).scheduleNextDraw(1, 0);
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Ownable: caller is not the owner'");
    });

    it("Entry fee must be positive integer", async function () {
      let tx;
      tx = lottery.scheduleNextDraw(-1, 0);
      await expect(tx).eventually.to.rejectedWith(Error);

      tx = lottery.scheduleNextDraw(0, 0);
      await expect(tx).eventually.to.rejectedWith(Error);

      tx = lottery.scheduleNextDraw(1.5, 0);
      await expect(tx).eventually.to.rejectedWith(Error);
    })
  });

  describe("test submitNumber", function () {
    let lottery;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
      lottery.deposite({ value: oneEther });
    });

    it("State should be 'Opened(0)'", async function () {
      let tx;
      expect(await lottery.getState()).to.equal(0);
      tx = lottery.submitNumber(1, {
        value: 1
      });
      await tx;

      await lottery.drawNumber();
      expect(await lottery.getState()).to.equal(2);
      tx = lottery.submitNumber(1, {
        value: 1
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });

    it("Minimum entry fee required", async function () {
      let tx;
      tx = lottery.submitNumber(1);
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Minimum entry fee required'");

      tx = lottery.submitNumber(1, {
        value: 1
      });
      await tx;
    });

    it("Number should be in range 1-49", async function () {
      let tx;
      tx = lottery.submitNumber(0, {
        value: 1
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Number too small'");

      tx = lottery.submitNumber(50, {
        value: 1
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Number too large'");
    });

    it("Revert if contract has no enough balance", async function () {
      let tx;
      tx = lottery.submitNumber(1, {
        value: oneEther
      });
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Contract balance too low'");
    })
  });

  describe("test drawNumber", function () {
    let lottery;

    beforeEach(async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      lottery = await Lottery.deploy(1, 0);
      lottery.deposite({value: 100});
    });

    it("State should be 'Opened(0)' and changed to 'Finished(2)'", async function () {
      let tx;

      expect(await lottery.getState()).to.equal(0);

      tx = lottery.drawNumber();
      await tx;
      expect(await lottery.getState()).to.equal(2);

      tx = lottery.drawNumber();
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Invalid state for the action");
    });

    it("Block timestamp must be greater than draw time", async function () {
      let secondsSinceEpoch = Math.round(Date.now() / 1000);
      let Lottery2 = await ethers.getContractFactory("Lottery");
      let lottery2 = await Lottery2.deploy(1, secondsSinceEpoch + 1000);
      
      let tx;
      tx = lottery2.drawNumber();
      await expect(tx).eventually.to.rejectedWith(Error, "VM Exception while processing transaction: reverted with reason string 'Too early to draw'");
    });

    it("Winner get paid with the prize", async function () {
      const [owner, addr1] = await ethers.getSigners();

      for (let i = 1; i <= 49; i++) {
        await lottery.connect(addr1).submitNumber(i, {
          value: 1
        });
      }

      let addr1Balance = await provider.getBalance(addr1.address);
      const prize = ethers.BigNumber.from("40");
      await lottery.drawNumber();

      let addr1NewBalance = await provider.getBalance(addr1.address);
      let contractBalance = await provider.getBalance(lottery.address);
      expect(addr1Balance.add(prize).eq(addr1NewBalance)).to.be.true;
      expect(contractBalance.eq(ethers.BigNumber.from("109"))).to.be.true;
    });

    it("State is reset", async function () {
      [owner, addr1, addr2] = await ethers.getSigners();
      for (let i = 1; i <= 49; i++) {
        await lottery.connect(addr1).submitNumber(i, {
          value: 1
        });
      }
      for (let i = 1; i <= 49; i++) {
        await lottery.connect(addr2).submitNumber(i, {
          value: 1
        });
      }

      for (let i = 1; i <= 49; i++) {
        const entriesCount = await lottery.entriesCounts(i)
        expect(entriesCount.eq(ethers.BigNumber.from("2"))).to.be.true;
      }

      await lottery.drawNumber();
      // reset winning number      
      const winningNumber = await lottery.winningNumber()
      expect(winningNumber.eq(ethers.BigNumber.from("0"))).to.be.true;
      // reset entries counts
      for (let i = 1; i <= 49; i++) {
        const entriesCount = await lottery.entriesCounts(i)
        expect(entriesCount.eq(ethers.BigNumber.from("0"))).to.be.true;
      }
      // record is reset, otherwise addr1 and addr2 will be paid.
      let addr1Balance = await provider.getBalance(addr1.address);
      let addr2Balance = await provider.getBalance(addr2.address);
      await lottery.scheduleNextDraw(1, 0);
      lottery.deposite({
        value: oneEther
      });
      await lottery.drawNumber();
      let addr1NewBalance = await provider.getBalance(addr1.address);
      let addr2NewBalance = await provider.getBalance(addr2.address);
      expect(addr1Balance.eq(addr1NewBalance)).to.be.true;
      expect(addr2Balance.eq(addr2NewBalance)).to.be.true;
    })
  });

  describe("Integration test", function () {
    it("Test case 1", async function () {
      const Lottery = await ethers.getContractFactory("Lottery");
      const lottery = await Lottery.deploy(oneEther, 0);
      lottery.deposite({value: fiveHundredEther});

      [owner, addr1, addr2] = await ethers.getSigners();
      await lottery.connect(addr1).submitNumber(1, {
        value: oneEther
      });
      await lottery.connect(addr1).submitNumber(49, {
        value: oneEther
      });

      await lottery.connect(addr2).submitNumber(1, {
        value: oneEther
      });
      await lottery.connect(addr2).submitNumber(40, {
        value: oneEther
      });

      await lottery.connect(addr1).drawNumber();

      await lottery.scheduleNextDraw(oneEther, 0);
      await lottery.connect(addr1).submitNumber(1, {
        value: oneEther
      });
      await lottery.connect(addr2).submitNumber(1, {
        value: oneEther
      });

      await lottery.connect(addr2).drawNumber();

      await lottery.scheduleNextDraw(oneEther, 0);
      await lottery.drawNumber();
    })
  })
});
