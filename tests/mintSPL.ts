import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { CopiumLottery } from "../target/types/copium_lottery";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from "@solana/spl-token";

import {
  createMint,
  createAccount,
  getAccount,
  getOrCreateAssociatedTokenAccount,
  transfer,
  mintTo,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import * as splToken from '@solana/spl-token';

describe("Register a business", () => {
  const LAMPORTS_PER_SOL = 1000000000;   
  const mintAuthSC = anchor.web3.Keypair.generate(); 
  const mintKeypairSC = anchor.web3.Keypair.generate(); 
  const anotherPerson = anchor.web3.Keypair.generate(); 

  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  // const payer = provider.wallet as anchor.Wallet;
  const program = anchor.workspace.CopiumLottery as Program<CopiumLottery>;
  const programId = program.programId;

  const PaYeR = anchor.web3.Keypair.generate();
  let mintSC: PublicKey;           
  let person1ATA;  

  before(async () => {
    // SOL Top-ups for all accounts used
    {        
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                PaYeR.publicKey,
                200 * LAMPORTS_PER_SOL
            )
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
                mintAuthSC.publicKey,
                200 * LAMPORTS_PER_SOL
            )
        );
        await provider.connection.confirmTransaction(
            await provider.connection.requestAirdrop(
              anotherPerson.publicKey,
                200 * LAMPORTS_PER_SOL
            )
        );  
    }

    // Stablecoin mint
    mintSC = await createMint(
        provider.connection,
        PaYeR,
        mintAuthSC.publicKey,
        mintAuthSC.publicKey,
        10,
        mintKeypairSC,
        undefined,
        TOKEN_PROGRAM_ID
    ); 
    
    // Initialise ATA
    person1ATA = await getOrCreateAssociatedTokenAccount(
        provider.connection,
        PaYeR,
        mintSC,
        anotherPerson.publicKey
    ); 
    
    // Top up test account with SPL
    await mintTo(
        provider.connection,
        PaYeR,
        mintSC,
        person1ATA.address,
        mintAuthSC,
        10000000000,
        [],
        undefined,
        TOKEN_PROGRAM_ID
    );

    console.log("Created mint!")
});

  it("Is initialized!", async () => {
    const solotery = PublicKey.findProgramAddressSync(
      [Buffer.from("SOLotery", "utf8"), new anchor.BN(0).toArrayLike(Buffer, "le", 8)],
      programId
    )[0];
    
    for (let i=0; i<20; i++) {
      const solotery_state = await program.account.soLotery.fetch(solotery)

      let winnerPublickey = SystemProgram.programId;
      if (solotery_state.winnerSelected) {
        winnerPublickey = solotery_state.winnerPubkey;
      }
  
      console.log(solotery_state);
  
      let lottery_id = new anchor.BN(0);
  
      const tx = await program.methods
        .enterLottery(lottery_id)
        .accounts({
          solotery: solotery,
          from: anotherPerson.publicKey,
          signer: anotherPerson.publicKey,
          stake: solotery,
          winnerPublickey: winnerPublickey,
          systemProgram: SystemProgram.programId,
          tokenProgram: TOKEN_PROGRAM_ID,
          mint: mintSC,
          tokenAccount: person1ATA.address,
          authority: anotherPerson.publicKey,
        })
        .signers([anotherPerson])
        .rpc();
      console.log("Transaction signature", tx);
    }
    let lottery_id = new anchor.BN(0);

    const lottery_master = PublicKey.findProgramAddressSync(
      [Buffer.from("LotteryMASter", "utf8")],
      programId
    )[0];
    const tx = await program.methods
        .claimPrize(lottery_id)
        .accounts({
          solotery: solotery,
          signer: anotherPerson.publicKey,
          stake: solotery,
          winnerPublickey: anotherPerson.publicKey,
          systemProgram: SystemProgram.programId,
          stakeLottMaster: lottery_master,
        })
        .signers([anotherPerson])
        .rpc();
      console.log("Transaction signature", tx);
  });
});
