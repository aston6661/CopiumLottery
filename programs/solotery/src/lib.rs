use anchor_lang::{
    prelude::*,
    solana_program::{
        clock::Clock, program::invoke, pubkey::Pubkey, system_instruction::transfer
    },
    system_program,
};
use anchor_spl::token::{self, Burn, Token, Mint};
use oorandom::Rand64;
use std::convert::TryFrom;
use std::str::FromStr;

// mod constants;
// mod error;

// This is your program's public key and it will update
// automatically when you build the project.
declare_id!("J3GAQ7bG9LyddhPDFH9hNQeko9JWhddNx66cRJmDqhKT");

pub const SOLOTERY: &[u8; 8] = b"SOLotery";
pub const LOTERYMASTER: &[u8; 13] = b"LotteryMASter";
// pub const TICKET_PRICE: u64 = 1000000000;
// pub const TICKET_PRICE_COP: u64 = 100;
pub const MAX_PLAYERS: usize = 20;
pub const ANCHOR_BUFFER: usize = 8;
pub const COPIUM: &str = "AGwX3cncR17emhABwHEWchxeUCKZf6fQEuVXyZJkrGFn"; // TODO: Change to actural mint address

#[program]
pub mod copium_lottery {
    use super::*;

    pub fn create_lottery_master(ctx: Context<LotteryMaster>) -> Result<()> {
        let lottery_master: &mut Account<LotteryMASter> = &mut ctx.accounts.lottery_master;
        let manager: Pubkey = ctx.accounts.user.key();
        let (_stake_pda, bump): (Pubkey, u8) =
            Pubkey::find_program_address(&[LOTERYMASTER], ctx.program_id);
        // set Lottery Master init variables
        lottery_master.set_bump_original(bump);
        lottery_master.init_lottery_created();
        lottery_master.set_manager(manager);
        Ok(())
    }

    pub fn start_lottery(ctx: Context<StartLottery>, ticket_price_sol: u64, ticket_price_cop: u64, num_players: u64) -> Result<()> {
        let lottery_master: &mut Account<LotteryMASter> = &mut ctx.accounts.lottery_master;
        let solotery: &mut Account<SoLotery> = &mut ctx.accounts.solotery;
        let declared_manager: Pubkey = ctx.accounts.user.key();
        require_keys_eq!(declared_manager, lottery_master.manager);
        let (_stake_pda, bump): (Pubkey, u8) =
            Pubkey::find_program_address(&[SOLOTERY, &lottery_master.lottery_count.to_le_bytes()], ctx.program_id);
        // set SOLotery init variables
        solotery.set_bump_original(bump);
        solotery.reset_players();
        solotery.reset_winner_selected();
        solotery.init_ticket_sold();
        solotery.reset_winner_pubkey();
        solotery.init_ticket_price(ticket_price_sol, ticket_price_cop);
        solotery.init_num_players(num_players);
        lottery_master.add_lottery_created();
        Ok(())
    }

    pub fn enter_lottery(ctx: Context<EnterLottery>, lottery_id: u64) -> Result<()> {
        // useful variables
        let stake_account: Pubkey = ctx.accounts.stake.key();
        let winner_pass_as_arg: Pubkey = ctx.accounts.winner_publickey.key();
        let real_winner: Pubkey = ctx.accounts.solotery.winner_pubkey.key();
        let lamport_from_account: u64 = ctx.accounts.from.to_account_info().lamports();
        let correct_pda = ctx.accounts.solotery.key();
        // validations
        require_keys_eq!(stake_account, correct_pda);
        require_keys_eq!(winner_pass_as_arg, real_winner);
        let solotery: &mut Account<SoLotery> = &mut ctx.accounts.solotery;
        require_eq!(solotery.winner_selected, false);
        // check lamports, transfer SOL & give a ticket
        require_gte!(lamport_from_account, solotery.ticket_price_sol);
        let from_account: Pubkey = ctx.accounts.from.key();
        let solotery_account: Pubkey = solotery.key();
        invoke(
            &transfer(&from_account, &solotery_account, solotery.ticket_price_sol),
            &[
                ctx.accounts.from.to_account_info(),
                ctx.accounts.stake.to_account_info().clone(),
            ],
        ).expect("Error tranfering SOL from user to stake account");
        let mint_key: Pubkey = ctx.accounts.mint.key();
        msg!(&mint_key.to_string());
        require_keys_eq!(mint_key, Pubkey::from_str(COPIUM).unwrap());
        let cpi_accounts = Burn {
            mint: ctx.accounts.mint.to_account_info(),
            from: ctx.accounts.token_account.to_account_info(),
            authority: ctx.accounts.authority.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        // Create the CpiContext we need for the request
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        // Execute anchor's helper function to burn tokens
        token::burn(cpi_ctx, solotery.ticket_price_cop)?;

        // update state of lotery
        solotery.add_tickets_sold();
        solotery.players.push(from_account);
        if solotery.players.len() == solotery.num_players.try_into().unwrap() {
            solotery
                .select_winner()
                .expect("Error selecting SOL to winner");
        }
        Ok(())
    }

    pub fn claim_prize(ctx: Context<ClaimPrize>, lottery_id: u64) -> Result<()> {
        // useful variables
        let stake_account: Pubkey = ctx.accounts.stake.key();
        let winner_pass_as_arg: Pubkey = ctx.accounts.winner_publickey.key();
        let real_winner: Pubkey = ctx.accounts.solotery.winner_pubkey.key();
        let correct_pda = ctx.accounts.solotery.key();
        let solotery_ctx: AccountInfo = ctx.accounts.stake.clone();
        let lottery_master_ctx: AccountInfo = ctx.accounts.stake_lott_master.clone();
        let winner_ctx: &mut AccountInfo = &mut ctx.accounts.winner_publickey.clone();
        // validations
        require_keys_eq!(stake_account, correct_pda);
        require_keys_eq!(winner_pass_as_arg, real_winner);
        let solotery: &mut Account<SoLotery> = &mut ctx.accounts.solotery;
        require_eq!(solotery.winner_selected, true);
        if solotery.winner_selected {
            msg!("Winner decided, allocating to winner");
            let amount_players: u64 = solotery.players.len() as u64;
            let total_amount: u64 = amount_players * solotery.ticket_price_sol;
            let amount: u64 = amount_players * solotery.ticket_price_sol / 40 * 39;
            let amount_fee: u64 = total_amount - amount;
            **solotery_ctx.to_account_info().try_borrow_mut_lamports()? -= amount;
            msg!("Debitted");
            **winner_ctx.to_account_info().lamports.borrow_mut() += amount;

            **solotery_ctx.to_account_info().try_borrow_mut_lamports()? -= amount_fee;
            **lottery_master_ctx.to_account_info().lamports.borrow_mut() += amount_fee;
            solotery
                .reset_game()
                .expect("Error transfering SOL to winner");
        }
        Ok(())
    }
}
#[derive(Accounts)]
#[instruction(num_players: u64)]
pub struct StartLottery<'info> {
    #[account(init, seeds = [SOLOTERY, &lottery_master.lottery_count.to_le_bytes()], bump, payer = user, space = SoLotery::SIZE)]
    pub solotery: Account<'info, SoLotery>,
    #[account(mut, seeds = [LOTERYMASTER], bump = lottery_master.bump_original)]
    pub lottery_master: Account<'info, LotteryMASter>,
    #[account(mut, signer)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct LotteryMaster<'info> {
    #[account(init, seeds = [LOTERYMASTER], bump, payer = user, space = LotteryMASter::SIZE)]
    pub lottery_master: Account<'info, LotteryMASter>,
    #[account(mut)] // TODO: confirm signer
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lottery_id: u64)]
pub struct EnterLottery<'info> {
    #[account(mut, seeds = [SOLOTERY, &lottery_id.to_le_bytes()], bump = solotery.bump_original)]
    pub solotery: Account<'info, SoLotery>,
    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub from: AccountInfo<'info>,
    /// CHECK: This is not dangerous
    #[account(mut)]
    pub stake: AccountInfo<'info>,
    /// CHECK: This is not dangerous
    // #[account(mut)]
    pub winner_publickey: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
    pub token_program: Program<'info, Token>,
    /// CHECK: This is the token that we want to mint
    #[account(mut)]
    pub mint: Account<'info, Mint>,
    /// CHECK: This is the token account that we want to mint tokens to
    #[account(mut)]
    pub token_account: AccountInfo<'info>,
    /// CHECK: the authority of the mint account
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(lottery_id: u64)]
pub struct ClaimPrize<'info> {
    #[account(mut, seeds = [SOLOTERY, &lottery_id.to_le_bytes()], bump = solotery.bump_original)]
    pub solotery: Account<'info, SoLotery>,
    // #[account(mut, seeds = [LOTERYMASTER], bump = lottery_master.bump_original)]
    // pub lottery_master: Account<'info, LotteryMASter>,
    /// CHECK: This is not dangerous
    #[account(mut, signer)]
    pub winner_publickey: AccountInfo<'info>,
    /// CHECK: This is not dangerous
    #[account(mut)]
    pub stake: AccountInfo<'info>,
    /// CHECK: This is not dangerous
    #[account(mut)]
    pub stake_lott_master: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct LotteryMASter {
    pub bump_original: u8,     // 1
    pub manager: Pubkey, // 32
    pub lottery_count: u64,     // 8
}

#[account]
pub struct SoLotery {
    pub bump_original: u8,     // 1
    pub winner_pubkey: Pubkey, // 32
    pub players: Vec<Pubkey>,  // 4 + (32 * MAX_PLAYERS)
    pub winner_selected: bool, // 1
    pub tickets_sold: u64,     // 8
    pub ticket_price_sol: u64, // 8
    pub ticket_price_cop: u64, // 8
    pub num_players: u64,    
}

impl LotteryMASter {
    pub const SIZE: usize = 1 + 32 + 8 + ANCHOR_BUFFER;
    pub fn add_lottery_created(&mut self) {
        self.lottery_count += 1;
    }
    pub fn init_lottery_created(&mut self) {
        self.lottery_count = 0;
    }
    pub fn set_bump_original(&mut self, bump: u8) {
        self.bump_original = bump;
    }
    pub fn set_manager(&mut self, manager: Pubkey) {
        self.manager = manager;
    }
}

impl SoLotery {
    pub const SIZE: usize = 1 + 32 + 4 + (32 * MAX_PLAYERS) + 8 + 1 + 8 + 8 + 8 + ANCHOR_BUFFER;

    pub fn add_tickets_sold(&mut self) {
        self.tickets_sold += 1;
    }

    pub fn reset_winner_pubkey(&mut self) {
        self.winner_pubkey = system_program::ID;
    }

    pub fn reset_winner_selected(&mut self) {
        self.winner_selected = false;
    }

    pub fn reset_players(&mut self) {
        self.players = [].to_vec();
    }

    pub fn print_transfer_amount(&self, lamports: u64) {
        let amount: f64 = lamports as f64 / 1_000_000_000.0;
        msg!("Total amount: {} SOL", amount);
    }

    pub fn set_winner_pubkey(&mut self, winner: Pubkey) {
        self.winner_pubkey = winner;
        self.winner_selected = true;
    }

    pub fn print_winner(&self) {
        msg!("Chosen winner: {}", self.winner_pubkey);
    }

    pub fn init_ticket_sold(&mut self) {
        self.tickets_sold = 0;
    }

    pub fn init_ticket_price(&mut self, ticket_price_sol: u64, ticket_price_cop: u64) {
        self.ticket_price_sol = ticket_price_sol;
        self.ticket_price_cop = ticket_price_cop;
    }

    pub fn init_num_players(&mut self, num_players: u64) {
        self.num_players = num_players;
    }

    pub fn set_bump_original(&mut self, bump: u8) {
        self.bump_original = bump;
    }

    pub fn select_winner(&mut self) -> Result<()> {
        let players_amount: u64 = self.players.len() as u64;
        msg!("Choosing from {} winners", players_amount);
        let current_time: u128 = Clock::get().unwrap().unix_timestamp as u128;

        let mut rng: Rand64 = Rand64::new(current_time);
        let index_winner: usize = rng.rand_range(0..players_amount).try_into().unwrap();
        // let clock = Clock::get()?;
        // let pseudo_random_number = ((u64::from_le_bytes(
        //     <[u8; 8]>::try_from(&hash(&clock.unix_timestamp.to_be_bytes()).to_bytes()[..8])
        //         .unwrap(),
        // ) * clock.slot)
        //     % u32::MAX as u64) as u32;
        // let index_winner = (pseudo_random_number % (players_amount as u32)) as usize;
        let winner: Pubkey = self.players[index_winner];
        self.set_winner_pubkey(winner);
        self.print_winner();
        Ok(())
    }

    // pub fn transfer_to_winner<'a>(
    //     &mut self,
    //     solotery_ctx: AccountInfo<'a>,
    //     winner_ctx: AccountInfo<'a>,
    // ) -> Result<()> {
    //     let amount_players: u64 = self.players.len() as u64;
    //     let amount: u64 = amount_players * TICKET_PRICE / 40 * 39;
    //     let solotery_account_info = solotery_ctx.to_account_info();
    //     let winner_account_info = winner_ctx.to_account_info();
    //     // Transfer the funds & reset the game
    //     // **solotery_ctx.to_account_info().try_borrow_mut_lamports()? -= amount;
    //     // msg!("Debitted");
    //     // **winner_ctx.to_account_info().try_borrow_mut_lamports()? += amount;
    //     invoke(
    //         &transfer(&solotery_ctx.key(), &winner_ctx.key(), amount),
    //         &[
    //             solotery_account_info,
    //             winner_account_info,
    //         ],
    //     ).expect("Error tranfering SOL from stake to user account");
    //     self.reset_players();
    //     self.reset_winner_pubkey();
    //     self.reset_winner_selected();
    //     self.print_transfer_amount(amount);
    //     Ok(())
    // }

    pub fn reset_game(
        &mut self,
    ) -> Result<()> {
        
        // let solotery_account_info = solotery_ctx.to_account_info();
        // let winner_account_info = winner_ctx.to_account_info();
        // Transfer the funds & reset the game
        
        // invoke(
        //     &transfer(&solotery_ctx.key(), &winner_ctx.key(), amount),
        //     &[
        //         solotery_account_info,
        //         winner_account_info,
        //     ],
        // ).expect("Error tranfering SOL from stake to user account");
        self.reset_players();
        self.reset_winner_pubkey();
        self.reset_winner_selected();
        self.init_ticket_sold();
        //self.print_transfer_amount(amount);
        Ok(())
    }
}
