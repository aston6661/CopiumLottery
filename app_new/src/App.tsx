// @ts-nocheck
import { useState } from 'react';
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import {
    ConnectionProvider,
    useAnchorWallet,
    WalletProvider,
} from "@solana/wallet-adapter-react";
import {
    WalletModalProvider,
    WalletMultiButton,
} from "@solana/wallet-adapter-react-ui";
import {
    GlowWalletAdapter,
    PhantomWalletAdapter,
    SlopeWalletAdapter,
    SolflareWalletAdapter,
    TorusWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import * as anchor from "@project-serum/anchor"
import { Program, AnchorProvider, web3, BN } from "@project-serum/anchor";
import { clusterApiUrl, Connection } from "@solana/web3.js";
import React, { FC, ReactNode, useMemo } from "react";
import idl from "./copium_lottery.json";
import { SystemProgram, PublicKey } from "@solana/web3.js";
import { assert } from "console";
import {
    TOKEN_PROGRAM_ID,
    getAssociatedTokenAddressSync,
    getOrCreateAssociatedTokenAccount
} from "@solana/spl-token";

console.log(idl);

require("./App.css");
require("@solana/wallet-adapter-react-ui/styles.css");

const App: FC = () => {
    return (
        <Context>
            <Content />
        </Context>
    );
};
export default App;

const Context: FC<{ children: ReactNode }> = ({ children }) => {
    // The network can be set to 'devnet', 'testnet', or 'mainnet-beta'.
    const network = WalletAdapterNetwork.Devnet;

    // You can also provide a custom RPC endpoint.
    const endpoint = useMemo(() => clusterApiUrl(network), [network]);

    // @solana/wallet-adapter-wallets includes all the adapters but supports tree shaking and lazy loading --
    // Only the wallets you configure here will be compiled into your application, and only the dependencies
    // of wallets that your users connect to will be loaded.
    const wallets = useMemo(
        () => [
            new PhantomWalletAdapter(),
            new GlowWalletAdapter(),
            new SlopeWalletAdapter(),
            new SolflareWalletAdapter({ network }),
            new TorusWalletAdapter(),
        ],
        [network]
    );

    return (
        <ConnectionProvider endpoint={endpoint}>
            <WalletProvider wallets={wallets} autoConnect>
                <WalletModalProvider>{children}</WalletModalProvider>
            </WalletProvider>
        </ConnectionProvider>
    );
};

const Content: FC = () => {
    const wallet = useAnchorWallet();
    const baseAccount = web3.Keypair.generate();

    const [solPrice, setSolPrice] = useState('1000000000');
    const [copPrice, setCopPrice] = useState('10000000000');
    const [numLotteries, setNumLotteries] = useState(0);
    const [existingLotteries, setExistingLotteries] = useState([]);

    const handleInputChange2 = (e: { target: { value: any; }; }) => setSolPrice(e.target.value);
    const handleInputChange3 = (e: { target: { value: any; }; }) => setCopPrice(e.target.value);

    const handleSubmit = (e: { preventDefault: () => void; }) => {
        e.preventDefault(); // Prevents form submission from reloading the page
        console.log(solPrice, copPrice); // Log input values or handle them as needed
    };

    function getProvider() {
        if (!wallet) {
            return null;
        }

        const network = "https://api.devnet.solana.com";
        //const network = WalletAdapterNetwork.Devnet;
        const connection = new Connection(network, "processed");

        const provider = new AnchorProvider(connection, wallet, {
            preflightCommitment: "processed",
        });

        console.log("Connection", provider.connection.rpcEndpoint)

        return provider;
    }

    async function refreshLottery() {
        const provider = getProvider();

        if (!provider) {
            console.log("Provider is null, make sure wallet is connected.");
            return;
        }

        if (!wallet) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        anchor.setProvider(provider);

        const a = JSON.stringify(idl);
        const b = JSON.parse(a);

        //const payer = provider.wallet as anchor.Wallet;
        const payer = wallet as anchor.Wallet;

        //assert(payer!=undefined)
        if (!payer) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        const program = new Program(b, idl.metadata.address, provider);
        const lottery_master = PublicKey.findProgramAddressSync(
            [Buffer.from("LotteryMASter", "utf8")],
            program.programId
        )[0];

        const lottery_master_state = await program.account.lotteryMaSter.fetch(lottery_master);
        const curr_id = lottery_master_state.lotteryCount;
        console.log(curr_id);

        setNumLotteries(curr_id);

        let lotteries = [];

        for (let i = 0; i < curr_id; i++) {
            const solotery = PublicKey.findProgramAddressSync(
                [Buffer.from("SOLotery", "utf8"), new anchor.BN(i).toArrayLike(Buffer, "le", 8)],
                program.programId
            )[0];
            try {
                const solotery_state = await program.account.soLotery.fetch(solotery);
                const new_item = {
                    "winnerSelected": solotery_state.winnerSelected,
                    "winnerPubkey": solotery_state.winnerPubkey,
                    "ticketsSold": solotery_state.ticketsSold.toNumber(),
                    "ticketPriceCop": solotery_state.ticketPriceCop.toNumber(),
                    "ticketPriceSol": solotery_state.ticketPriceSol.toNumber(),
                    "players": solotery_state.players,
                    "numPlayers": solotery_state.numPlayers.toNumber(),
                    "id": i
                }
                lotteries.push(new_item);
            }
            catch (err) {
                console.log("Transcation error: ", err);
            }

        }
        console.log(lotteries);
        setExistingLotteries(lotteries);
    }

    async function createCounter() {
        const provider = getProvider();

        if (!provider) {
            console.log("Provider is null, make sure wallet is connected.");
            return;
        }

        if (!wallet) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        anchor.setProvider(provider);

        const a = JSON.stringify(idl);
        const b = JSON.parse(a);

        //const payer = provider.wallet as anchor.Wallet;
        const payer = wallet as anchor.Wallet;

        //assert(payer!=undefined)
        if (!payer) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        const program = new Program(b, idl.metadata.address, provider);
        const lottery_master = PublicKey.findProgramAddressSync(
            [Buffer.from("LotteryMASter", "utf8")],
            program.programId
        )[0];
        try {
            // await program.rpc.createLotteryMaster({
            //     accounts: {
            //         lotteryMaster: lottery_master,
            //         user: provider.wallet.publicKey,
            //         systemProgram: web3.SystemProgram.programId,
            //     },
            //     signers: [wallet.signers]
            // });
            // await program.methods.createLotteryMaster()
            //     .accounts({
            //         lotteryMaster: lottery_master,
            //         user: provider.wallet.publicKey,
            //         systemProgram: web3.SystemProgram.programId,
            //         signer: provider.wallet.publicKey,
            //     }).signers([payer]).rpc()

            const tx = program.transaction.createLotteryMaster(
                {
                    accounts: {
                        lotteryMaster: lottery_master,
                        user: provider.wallet.publicKey,
                        systemProgram: web3.SystemProgram.programId,
                    },
                    signers: [],
                }
            )

            tx.feePayer = wallet.publicKey
            tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
            const signedTx = await wallet.signTransaction(tx)
            const txId = await provider.connection.sendRawTransaction(signedTx.serialize())
            await provider.connection.confirmTransaction(txId)

            console.log(txId)

            const account = await program.account.lotteryMaSter.fetch(lottery_master);
            console.log('account: ', account);
        }
        catch (err) {
            console.log("Transcation error: ", err);
        }
    }

    async function increment() {
        const provider = getProvider();

        if (!provider) {
            console.log("Provider is null, make sure wallet is connected.");
            return;
        }

        if (!wallet) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        anchor.setProvider(provider);

        const a = JSON.stringify(idl);
        const b = JSON.parse(a);

        //const payer = provider.wallet as anchor.Wallet;
        const payer = wallet as anchor.Wallet;

        //assert(payer!=undefined)
        if (!payer) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        const program = new Program(b, idl.metadata.address, provider);
        const lottery_master = PublicKey.findProgramAddressSync(
            [Buffer.from("LotteryMASter", "utf8")],
            program.programId
        )[0];
        try {
            // await program.rpc.createLotteryMaster({
            //     accounts: {
            //         lotteryMaster: lottery_master,
            //         user: provider.wallet.publicKey,
            //         systemProgram: web3.SystemProgram.programId,
            //     },
            //     signers: [wallet.signers]
            // });
            // await program.methods.createLotteryMaster()
            //     .accounts({
            //         lotteryMaster: lottery_master,
            //         user: provider.wallet.publicKey,
            //         systemProgram: web3.SystemProgram.programId,
            //         signer: provider.wallet.publicKey,
            //     }).signers([payer]).rpc()
            const lottery_master_state = await program.account.lotteryMaSter.fetch(lottery_master);
            const curr_id = lottery_master_state.lotteryCount;
            console.log(curr_id);
            const solotery = PublicKey.findProgramAddressSync(
                [Buffer.from("SOLotery", "utf8"), new anchor.BN(curr_id).toArrayLike(Buffer, "le", 8)],
                program.programId
            )[0];
            // let sol_price = new anchor.BN(1000000000);
            // let cop_price = new anchor.BN(100 * 100000000);
            let sol_price = new anchor.BN(solPrice);
            let cop_price = new anchor.BN(copPrice);
            let num_players = new anchor.BN(5);
            const tx = program.transaction.startLottery(
                sol_price, cop_price, num_players,
                {
                    accounts: {
                        solotery: solotery,
                        systemProgram: web3.SystemProgram.programId,
                        lotteryMaster: lottery_master,
                        user: provider.wallet.publicKey,
                    },
                    signers: [],
                }
            )

            tx.feePayer = wallet.publicKey
            tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
            const signedTx = await wallet.signTransaction(tx)
            const txId = await provider.connection.sendRawTransaction(signedTx.serialize())
            await provider.connection.confirmTransaction(txId)

            const account = await program.account.lotteryMaSter.fetch(lottery_master);
            console.log('account: ', account);
        }
        catch (err) {
            console.log("Transcation error: ", err);
        }
    }
    async function decrement(id: number) {
        const provider = getProvider();

        if (!provider) {
            console.log("Provider is null, make sure wallet is connected.");
            return;
        }

        if (!wallet) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        anchor.setProvider(provider);

        const a = JSON.stringify(idl);
        const b = JSON.parse(a);

        //const payer = provider.wallet as anchor.Wallet;
        const payer = wallet as anchor.Wallet;

        //assert(payer!=undefined)
        if (!payer) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        const program = new Program(b, idl.metadata.address, provider);
        const lottery_master = PublicKey.findProgramAddressSync(
            [Buffer.from("LotteryMASter", "utf8")],
            program.programId
        )[0];

        const account = await program.account.lotteryMaSter.fetch(lottery_master);
        console.log('account: ', account);

        const solotery = PublicKey.findProgramAddressSync(
            [Buffer.from("SOLotery", "utf8"), new anchor.BN(id).toArrayLike(Buffer, "le", 8)],
            program.programId
        )[0];

        let lottery_id = new anchor.BN(id);

        const solotery_state = await program.account.soLotery.fetch(solotery)

        let winnerPublickey = SystemProgram.programId;
        if (solotery_state.winnerSelected) {
            winnerPublickey = solotery_state.winnerPubkey;
        }
        let mintSC = new PublicKey("AGwX3cncR17emhABwHEWchxeUCKZf6fQEuVXyZJkrGFn");
        let person1ATA = getAssociatedTokenAddressSync(
            mintSC,
            provider.wallet.publicKey
        );
        try {
            const tx = program.transaction.enterLottery(
                lottery_id,
                {
                    accounts: {
                        solotery: solotery,
                        from: provider.wallet.publicKey,
                        stake: solotery,
                        winnerPublickey: winnerPublickey,
                        systemProgram: web3.SystemProgram.programId,
                        tokenProgram: TOKEN_PROGRAM_ID,
                        mint: mintSC,
                        tokenAccount: person1ATA,
                        authority: provider.wallet.publicKey,
                    },
                    signers: [],
                }
            )

            tx.feePayer = wallet.publicKey
            tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
            const signedTx = await wallet.signTransaction(tx)
            const txId = await provider.connection.sendRawTransaction(signedTx.serialize())
            await provider.connection.confirmTransaction(txId)

            console.log(txId)

            const account = await program.account.soLotery.fetch(solotery);
            console.log('account: ', account);
        }
        catch (err) {
            console.log("Transcation error: ", err);
        }
    }



    async function claim_prize(id: number) {
        const provider = getProvider();

        if (!provider) {
            console.log("Provider is null, make sure wallet is connected.");
            return;
        }

        if (!wallet) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        anchor.setProvider(provider);

        const a = JSON.stringify(idl);
        const b = JSON.parse(a);

        //const payer = provider.wallet as anchor.Wallet;
        const payer = wallet as anchor.Wallet;

        //assert(payer!=undefined)
        if (!payer) {
            console.log("Wallet is null, make sure wallet is connected.");
            return;
        }

        const program = new Program(b, idl.metadata.address, provider);
        const lottery_master = PublicKey.findProgramAddressSync(
            [Buffer.from("LotteryMASter", "utf8")],
            program.programId
        )[0];

        const account = await program.account.lotteryMaSter.fetch(lottery_master);
        console.log('account: ', account);

        const solotery = PublicKey.findProgramAddressSync(
            [Buffer.from("SOLotery", "utf8"), new anchor.BN(id).toArrayLike(Buffer, "le", 8)],
            program.programId
        )[0];

        let lottery_id = new anchor.BN(id);

        const solotery_state = await program.account.soLotery.fetch(solotery)

        let winnerPublickey = SystemProgram.programId;
        if (solotery_state.winnerSelected) {
            winnerPublickey = solotery_state.winnerPubkey;
        }
        let mintSC = new PublicKey("AGwX3cncR17emhABwHEWchxeUCKZf6fQEuVXyZJkrGFn");
        let person1ATA = getAssociatedTokenAddressSync(
            mintSC,
            provider.wallet.publicKey
        );
        try {
            const tx = program.transaction.claimPrize(
                lottery_id,
                {
                    accounts: {
                        solotery: solotery,
                        stake: solotery,
                        winnerPublickey: winnerPublickey,
                        systemProgram: web3.SystemProgram.programId,
                        stakeLottMaster: lottery_master,
                    },
                    signers: [],
                }
            )

            tx.feePayer = wallet.publicKey
            tx.recentBlockhash = (await provider.connection.getLatestBlockhash()).blockhash
            const signedTx = await wallet.signTransaction(tx)
            const txId = await provider.connection.sendRawTransaction(signedTx.serialize())
            await provider.connection.confirmTransaction(txId)

            console.log(txId)

            const account = await program.account.soLotery.fetch(solotery);
            console.log('account: ', account);
        }
        catch (err) {
            console.log("Transcation error: ", err);
        }
    }

    return (
        <div className="App">
            <button onClick={createCounter}>Create Lottery Master</button>
            <button onClick={refreshLottery}>Refresh Lottery</button>
            <form onSubmit={handleSubmit}>
                <input
                    type="text"
                    value={solPrice}
                    onChange={handleInputChange2}
                    placeholder="Input 1"
                />
                <input
                    type="text"
                    value={copPrice}
                    onChange={handleInputChange3}
                    placeholder="Input 2"
                />
                <button onClick={increment}>Create Lottery</button>
            </form>
            <ul>
                {existingLotteries.map((lottery) => (
                    <li key={lottery.id}>
                        Winner: {lottery.winnerPubkey.toString()}
                        hasWinner: {lottery.winnerSelected.toString()}
                        SOL Price: {lottery.ticketPriceSol}
                        COPIUM Price: {lottery.ticketPriceCop}
                        Ticket Sold: {lottery.ticketsSold}
                        Max Player: {lottery.numPlayers}
                        <button onClick={() => {decrement(lottery.id)}}>Enter Lottery</button>
                        <button onClick={() => {claim_prize(lottery.id)}}>Claim Prize</button>
                    </li>
                ))}
            </ul>
            
            <WalletMultiButton />
        </div>
    );
};
