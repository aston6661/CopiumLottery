import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CopiumLottery } from "../target/types/copium_lottery";
import { SystemProgram, PublicKey } from "@solana/web3.js";

describe("Register a business", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.CopiumLottery as Program<CopiumLottery>;
  const programId = program.programId;

  it("Is initialized!", async () => {
    const lottery_master = PublicKey.findProgramAddressSync(
      [Buffer.from("LotteryMASter", "utf8")],
      programId
    )[0];

    console.log("lottery master key", lottery_master);

    let tx = await program.methods
      .createLotteryMaster()
      .accounts({
        lotteryMaster: lottery_master,
        signer: payer.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log("Transaction signature create lott", tx);
    const lottery_master_state = await program.account.lotteryMaSter.fetch(lottery_master);
    console.log(lottery_master_state);
    const curr_id = lottery_master_state.lotteryCount;
    console.log(curr_id);
    const solotery = PublicKey.findProgramAddressSync(
      [Buffer.from("SOLotery", "utf8"), new anchor.BN(curr_id).toArrayLike(Buffer, "le", 8)],
      programId
    )[0];

    console.log("solotery key", solotery);
    let sol_price = new anchor.BN(1000000000);
    let cop_price = new anchor.BN(1000);
    let num_players = new anchor.BN(20);
    tx = await program.methods
      .startLottery(sol_price, cop_price, num_players)
      .accounts({
        solotery: solotery,
        signer: payer.publicKey,
        systemProgram: SystemProgram.programId,
        lotteryMaster: lottery_master,
      })
      .rpc();
    console.log("Transaction signature", tx);
  });
});
